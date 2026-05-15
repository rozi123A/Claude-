import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getTelegramUser, upsertTelegramUser, createTransaction, createWithdrawal, createAdToken, getAdToken, markAdTokenUsed, getSetting, getTransactions, getUserWithdrawals, updateWithdrawalStatus, getPendingWithdrawals, getReferralStats, getAdminStats, getAllTelegramUsersAdmin, getAllUsersForBroadcast, getInactiveUsers, banTelegramUser, getAllWithdrawals,
  getLeaderboard } from "./db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { ENV } from "./_core/env";

// ── Anti-bot: in-memory rate limiter ──
const tokenRateMap = new Map();
const MIN_AD_SECONDS = 14;
const INSTANT_BAN_SECONDS = 5;
const RATE_WINDOW_MS = 60_000;
const MAX_TOKENS_PER_MIN = 5;

function checkRateLimit(telegramId) {
  const now = Date.now();
  const rec = tokenRateMap.get(telegramId);
  if (!rec || now - rec.windowStart > RATE_WINDOW_MS) {
    tokenRateMap.set(telegramId, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= MAX_TOKENS_PER_MIN) return false;
  rec.count++;
  return true;
}


// Helper to verify Telegram WebApp data
function verifyTelegramWebApp(initData: string) {
  if (!initData) return null;
  const botToken = ENV.botToken;

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    if (!hash) return null;

    urlParams.delete("hash");

    const userRaw = urlParams.get("user") || "{}";
    let userData: any = null;
    try { userData = JSON.parse(userRaw); } catch { return null; }

    // If no bot token configured, allow but log warning (dev/staging fallback)
    if (!botToken) {
      console.warn("[Auth] BOT_TOKEN not set — skipping HMAC verification");
      return userData;
    }

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) {
      console.warn("[Auth] Hash mismatch — rejecting request");
    return null;
    }

    return userData;
  } catch (e) {
    console.error("[Auth] Error verifying Telegram data:", e);
    return null;
  }
}

// Format date as YYYY-MM-DD (max 10 chars, fits in varchar(10))
function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Helper to reset daily limits
function resetDailyIfNeeded(user: any) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const updates: any = {};
  
  const adDate = user.todayAdsDate ? new Date(user.todayAdsDate).getTime() : 0;
  if (adDate < today) {
    updates.todayAds = 0;
    updates.todayAdsDate = toDateString(now);
  }

  const spinDate = user.spinsDate ? new Date(user.spinsDate).getTime() : 0;
  if (spinDate < today) {
    updates.spinsLeft = 5;
    updates.spinsDate = toDateString(now);
  }

  return updates;
}

export const appRouter = router({
  system: systemRouter,
  
  telegram: router({
    getUser: publicProcedure
      .input(z.object({ 
        telegramId: z.number(), 
        initData: z.string(),
        referredBy: z.number().optional()
      }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid Telegram data" };
        }

        let user = await getTelegramUser(input.telegramId);
        const now = new Date();

        if (!user) {
          // New user registration
          user = await upsertTelegramUser({
            telegramId: input.telegramId,
            username: verified.username,
            firstName: verified.first_name,
            lastName: verified.last_name,
            photoUrl: verified.photo_url,
            balance: 0,
            totalEarned: 0,
            todayAds: 0,
            todayAdsDate: toDateString(now),
            spinsLeft: 5,
            spinsDate: toDateString(now),
            referredBy: input.referredBy && input.referredBy !== input.telegramId ? input.referredBy : null,
          });

          // Create registration log
          await createTransaction({
            telegramId: input.telegramId,
            type: "bonus",
            points: 0,
            metadata: JSON.stringify({ action: "registration" }),
          });

          // Handle referral bonus
          if (input.referredBy && input.referredBy !== input.telegramId) {
            const inviter = await getTelegramUser(input.referredBy);
            if (inviter) {
              // Inviter gets 100 points
              const inviterBonus = 100;
              await upsertTelegramUser({
                ...inviter,
                balance: Number(inviter.balance) + inviterBonus,
                totalEarned: Number(inviter.totalEarned) + inviterBonus,
              });
              await createTransaction({
                telegramId: input.referredBy,
                type: "referral",
                points: inviterBonus,
                metadata: JSON.stringify({ referredId: input.telegramId, action: "friend_joined" }),
              });

              // New user also gets a 300-point welcome bonus
              const welcomeBonus = 300;
              await upsertTelegramUser({
                telegramId: input.telegramId,
                balance: welcomeBonus,
                totalEarned: welcomeBonus,
              });
              await createTransaction({
                telegramId: input.telegramId,
                type: "bonus",
                points: welcomeBonus,
                metadata: JSON.stringify({ action: "referral_welcome", invitedBy: input.referredBy }),
              });
              // Refresh user object with updated balance
              user = await getTelegramUser(input.telegramId);
            }
          }
        } else {
          const dailyUpdates = resetDailyIfNeeded(user);
          if (Object.keys(dailyUpdates).length > 0) {
            user = await upsertTelegramUser({ ...user, ...dailyUpdates });
          }
        }

        const starsRate = await getSetting("starsRate", 1000);
        const minWithdraw = await getSetting("minWithdraw", 10000);

        return {
          success: true,
          user: {
            ...user,
            adReward: 100,
            adCooldown: 30,
            starsRate,
            minWithdraw,
            adsgramBlockId: ENV.adsgramBlockId,
            lastAdTime: user?.lastAdTime ? new Date(user.lastAdTime).getTime() : null,
          },
        };
      }),
    getTransactions: publicProcedure
      .input(z.object({ telegramId: z.number() }))
      .query(async ({ input }) => {
        return await getTransactions(input.telegramId);
      }),

    getReferralStats: publicProcedure
      .input(z.object({ telegramId: z.number() }))
      .query(async ({ input }) => {
        return await getReferralStats(input.telegramId);
      }),
  }),

  ads: router({
    getToken: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        // ── Anti-bot checks ──
        if (user.isBanned === "true") return { success: false, message: "تم تعليق حسابك بسبب نشاط مشبوه" };
        if (user.todayAds >= 50) return { success: false, message: "Daily limit reached" };
        if (!checkRateLimit(input.telegramId)) {
          return { success: false, message: "طلبات كثيرة جداً — انتظر دقيقة" };
        }

        const token = uuidv4();
        await createAdToken(token, input.telegramId);
        return { success: true, token };
      }),

    claim: publicProcedure
      .input(z.object({ 
        telegramId: z.number(), 
        token: z.string(), 
        initData: z.string(),
        type: z.enum(["points", "spin"]).default("points")
      }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const adToken = await getAdToken(input.token);
        if (!adToken || Number(adToken.telegramId) !== Number(input.telegramId) || adToken.used === "true") {
          return { success: false, message: "Invalid token" };
        }

        // ── Anti-bot: enforce minimum viewing time ──
        const tokenAge = (Date.now() - new Date(adToken.createdAt).getTime()) / 1000;
        if (tokenAge < INSTANT_BAN_SECONDS) {
          // Claimed in <5s = bot → auto-ban + alert admin
          await markAdTokenUsed(input.token);
          await banTelegramUser(input.telegramId, true);
          const _bt = process.env.BOT_TOKEN;
          const _ai = process.env.ADMIN_TELEGRAM_ID || process.env.ADMIN_CHAT_ID;
          if (_bt && _ai) {
            fetch(`https://api.telegram.org/bot${_bt}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: _ai,
                text: `🤖 <b>بوت مكتشف وتم حظره</b>\n\nTelegram ID: <code>${input.telegramId}</code>\nالوقت بين التوكن والـ claim: <b>${tokenAge.toFixed(2)}s</b>`,
                parse_mode: "HTML",
              }),
            }).catch(() => {});
          }
          return { success: false, message: "تم اكتشاف نشاط آلي — تم تعليق حسابك" };
        }
        if (tokenAge < MIN_AD_SECONDS) {
          return { success: false, message: `يجب مشاهدة الإعلان ${MIN_AD_SECONDS} ثانية على الأقل` };
        }

        await markAdTokenUsed(input.token);
        let user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };
        if (user.isBanned === "true") return { success: false, message: "تم تعليق حسابك" };

        const reward = 100;
        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;
        const currentTodayAds = Number(user.todayAds) || 0;
        const currentSpins = Number(user.spinsLeft) || 0;

        const updates: any = {
          ...user,
          todayAds: currentTodayAds + 1,
          lastAdTime: new Date().toISOString().replace("T", " ").replace("Z", ""),
        };

        if (input.type === "spin") {
          updates.spinsLeft = currentSpins + 1;
          // Also give points as a bonus
          updates.balance = currentBalance + reward;
          updates.totalEarned = currentTotalEarned + reward;
        } else {
          updates.balance = currentBalance + reward;
          updates.totalEarned = currentTotalEarned + reward;
        }

        user = await upsertTelegramUser(updates);

        await createTransaction({
          telegramId: input.telegramId,
          type: "ad",
          points: reward,
          metadata: JSON.stringify({ token: input.token, adType: input.type }),
        });

        // Always return balance — use computed value as fallback if upsert returned null
          return { 
            success: true, 
            reward, 
            balance: user?.balance ?? updates.balance, 
            spinsLeft: user?.spinsLeft ?? updates.spinsLeft 
          };
      }),
  }),

  spin: router({
    perform: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        let user = await getTelegramUser(input.telegramId);
        if (!user || user.spinsLeft <= 0) return { success: false, message: "No spins left" };

        const prizes = [50, 75, 100, 150, 200, 250, 500, 1000];
        const weights = [40, 25, 15, 10, 5, 3, 1.5, 0.5];
        
        // Weighted random
        let totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        let prize = prizes[0];
        for (let i = 0; i < weights.length; i++) {
          if (random < weights[i]) {
            prize = prizes[i];
            break;
          }
          random -= weights[i];
        }

        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;
        const currentSpins = Number(user.spinsLeft) || 0;

        user = await upsertTelegramUser({
          telegramId: input.telegramId,
          balance: currentBalance + prize,
          totalEarned: currentTotalEarned + prize,
          spinsLeft: Math.max(0, currentSpins - 1),
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "spin",
          points: prize,
          metadata: JSON.stringify({ prize }),
        });

        return { success: true, prize, balance: user?.balance ?? (currentBalance + prize), spinsLeft: user?.spinsLeft ?? Math.max(0, currentSpins - 1) };
      }),
  }),


  dailyGift: router({
    claim: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid data" };
        }

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        // Check 24h cooldown using completedTasks JSON field (no schema change needed)
        let completedTasksData: any = {};
        try {
          completedTasksData = user.completedTasks ? JSON.parse(user.completedTasks) : {};
        } catch { completedTasksData = {}; }

        const lastGift = completedTasksData.lastDailyGift;
        if (lastGift) {
          const diff = Date.now() - new Date(lastGift).getTime();
          if (diff < 24 * 60 * 60 * 1000) {
            return { success: false, message: "Already claimed today", nextClaim: new Date(lastGift).getTime() + 24 * 60 * 60 * 1000 };
          }
        }

         // الهدية اليومية ثابتة: 10 نقاط فقط (بعد مشاهدة إعلان)
          const reward = 10;

        const now = new Date();
        completedTasksData.lastDailyGift = now.toISOString();

        const currentBalance = Number(user.balance) || 0;
        const currentTotalEarned = Number(user.totalEarned) || 0;

        const updated = await upsertTelegramUser({
          ...user,
          balance: currentBalance + reward,
          totalEarned: currentTotalEarned + reward,
          completedTasks: JSON.stringify(completedTasksData),
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "bonus",
          points: reward,
          metadata: JSON.stringify({ action: "daily_gift", reward }),
        });

        return {
          success: true,
          reward,
          balance: updated?.balance,
          totalEarned: updated?.totalEarned,
          nextClaim: now.getTime() + 24 * 60 * 60 * 1000,
        };
      }),
  }),

  withdraw: router({
    // Create a new withdrawal request
    request: publicProcedure
      .input(z.object({ telegramId: z.number(), amount: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "بيانات غير صالحة" };
        }

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "المستخدم غير موجود" };

        const minWithdraw = await getSetting("minWithdraw", 10000);
        const starsRate = await getSetting("starsRate", 1000);
        const currentBalance = Number(user.balance) || 0;

        if (input.amount < minWithdraw) {
          return { success: false, message: `الحد الأدنى للسحب ${minWithdraw.toLocaleString()} نقطة` };
        }
        if (input.amount > currentBalance) {
          return { success: false, message: "رصيدك غير كافٍ" };
        }

        // Check no already-pending withdrawal for this user
        const userWithdrawals = await getUserWithdrawals(input.telegramId, 5);
        const hasPending = userWithdrawals.some((w: any) => w.status === "pending");
        if (hasPending) {
          return { success: false, message: "لديك طلب سحب قيد المعالجة، انتظر حتى تتم معالجته" };
        }

        const stars = Math.floor(input.amount / starsRate);

        // Deduct balance
        await upsertTelegramUser({
          ...user,
          balance: currentBalance - input.amount,
        });

        // Create withdrawal record
        const withdrawal = await createWithdrawal({
          telegramId: input.telegramId,
          amount: input.amount,
          stars,
          method: "telegram_stars",
          status: "pending",
        });

        // Create transaction record
        await createTransaction({
          telegramId: input.telegramId,
          type: "withdraw",
          points: -input.amount,
          metadata: JSON.stringify({ stars, status: "pending" }),
        });

        // Notify admin via Telegram Bot API
        const botToken = ENV.botToken;
        const adminId = ENV.adminTelegramId;
        if (botToken && adminId) {
          const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "مجهول";
          const username = user.username ? `@${user.username}` : "بدون username";
          const msg = [
            `🔔 <b>طلب سحب جديد</b>`,
            ``,
            `👤 الاسم: <b>${name}</b>`,
            `🔗 المعرف: ${username}`,
            `🆔 Telegram ID: <code>${input.telegramId}</code>`,
            ``,
            `💰 النقاط: <b>${input.amount.toLocaleString()}</b>`,
            `⭐ النجوم: <b>${stars}</b>`,
            ``,
            `📋 حالة الطلب: قيد المعالجة`,
            `⏰ الوقت: ${new Date().toLocaleString("ar-SA")}`,
            ``,
            `للموافقة أو الرفض استخدم لوحة الأدمن في التطبيق.`,
          ].join("\n");

          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: adminId, text: msg, parse_mode: "HTML" }),
          }).catch(() => {});
        }

        return { success: true, stars, message: "تم إرسال طلب السحب بنجاح! سيتم المعالجة خلال 24 ساعة." };
      }),

    // Get current user's withdrawal history
    getHistory: publicProcedure
      .input(z.object({ telegramId: z.number() }))
      .query(async ({ input }) => {
        return await getUserWithdrawals(input.telegramId, 10);
      }),

    // Admin: get all pending withdrawals (only if adminId matches env)
    adminGetPending: publicProcedure
      .input(z.object({ telegramId: z.number() }))
      .query(async ({ input }) => {
        if (!ENV.adminTelegramId || input.telegramId !== ENV.adminTelegramId) {
          return { success: false, message: "غير مصرح", withdrawals: [] };
        }
        const list = await getPendingWithdrawals();
        return { success: true, withdrawals: list };
      }),

    // Admin: approve or reject a withdrawal
    adminUpdate: publicProcedure
      .input(z.object({
        telegramId: z.number(),
        withdrawalId: z.number(),
        status: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        if (!ENV.adminTelegramId || input.telegramId !== ENV.adminTelegramId) {
          return { success: false, message: "غير مصرح" };
        }

        // If rejected, restore user's balance
        if (input.status === "rejected") {
          const pendingList = await getPendingWithdrawals();
          const w = pendingList.find((p: any) => p.id === input.withdrawalId);
          if (w) {
            const user = await getTelegramUser(w.telegramId);
            if (user) {
              await upsertTelegramUser({
                ...user,
                balance: Number(user.balance) + Number(w.amount),
              });
            }
          }
        }

        await updateWithdrawalStatus(
          input.withdrawalId,
          input.status as "approved" | "rejected",
          input.note
        );

        // Notify user via bot
        const botToken = ENV.botToken;
        if (botToken) {
          const pendingList = await getPendingWithdrawals();
          const allList = pendingList; // simplified — we already updated it
          const emoji = input.status === "approved" ? "✅" : "❌";
          const statusText = input.status === "approved" ? "تمت الموافقة على طلبك" : "تم رفض طلبك";
          // We stored telegramId in withdrawal, get it from pending list before update or pass it separately
          // For simplicity, the note can include user ID info
        }

        return { success: true, message: `تم ${input.status === "approved" ? "الموافقة" : "رفض"} الطلب بنجاح` };
      }),
  }),


    admin: router({
      // Verify admin access — checks secret against env
      verify: publicProcedure
        .input(z.object({ secret: z.string() }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          const isValid = adminSecret.length > 0 && input.secret === adminSecret;
          return { success: isValid };
        }),

      // Full stats for dashboard
      getStats: publicProcedure
        .input(z.object({ secret: z.string() }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!adminSecret || input.secret !== adminSecret) return { success: false, data: null };
          const stats = await getAdminStats();
          return { success: true, data: stats };
        }),

      // Paginated users list
      getUsers: publicProcedure
        .input(z.object({ secret: z.string(), page: z.number().default(1) }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!adminSecret || input.secret !== adminSecret) return { success: false, users: [] };
          const limit = 20;
          const offset = (input.page - 1) * limit;
          const users = await getAllTelegramUsersAdmin(limit, offset);
          return { success: true, users };
        }),

      // All withdrawals (with optional status filter)
      getWithdrawals: publicProcedure
        .input(z.object({ secret: z.string(), status: z.string().optional() }))
        .query(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!adminSecret || input.secret !== adminSecret) return { success: false, withdrawals: [] };
          const list = await getAllWithdrawals(input.status);
          return { success: true, withdrawals: list };
        }),

      // Ban / unban a user
      banUser: publicProcedure
        .input(z.object({ secret: z.string(), telegramId: z.number(), ban: z.boolean() }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!adminSecret || input.secret !== adminSecret) return { success: false, message: "غير مصرح" };
          await banTelegramUser(input.telegramId, input.ban);
          return { success: true };
        }),

      // Broadcast message to all users (or inactive only)
      broadcast: publicProcedure
        .input(z.object({
          secret: z.string(),
          message: z.string().min(1).max(1000),
          targetGroup: z.enum(["all", "inactive"]).default("all"),
        }))
        .mutation(async ({ input }) => {
          const adminSecret = process.env.ADMIN_SECRET || "";
          if (!adminSecret || input.secret !== adminSecret) return { success: false, sent: 0, message: "غير مصرح" };

          const botToken = ENV.botToken;
          const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || "";
          if (!botToken) return { success: false, sent: 0, message: "BOT_TOKEN غير مضبوط" };

          let users: any[] = [];
          if (input.targetGroup === "inactive") {
            users = await getInactiveUsers(3, 300);
          } else {
            users = await getAllUsersForBroadcast(500);
          }

          let sent = 0;
          const keyboard = webappUrl ? {
            inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]]
          } : undefined;

          for (const u of users) {
            try {
              const payload: any = { chat_id: u.telegramId, text: input.message, parse_mode: "HTML" };
              if (keyboard) payload.reply_markup = keyboard;
              const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (r.ok) sent++;
              await new Promise(res => setTimeout(res, 50));
            } catch {}
          }
          return { success: true, sent, total: users.length };
        }),
    }),
  
    leaderboard: router({
      get: publicProcedure
        .input(z.object({ telegramId: z.number().optional() }))
        .query(async ({ input }) => {
          const rows = await getLeaderboard(20);
          const myRank = input.telegramId
            ? rows.findIndex(r => r.telegramId === input.telegramId) + 1
            : 0;
          return { success: true, rows, myRank };
        }),
    }),

  });