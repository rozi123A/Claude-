import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter, authRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getTelegramUser, upsertTelegramUser, createTransaction, createWithdrawal, createAdToken, getAdToken, markAdTokenUsed, getSetting, getAllTelegramUsers } from "./db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { ENV } from "./_core/env";

// Helper to verify Telegram WebApp data
function verifyTelegramWebApp(initData: string) {
  if (!initData) return null;
  
  const botToken = ENV.botToken;
  
  // In development mode without bot token, accept any valid initData for testing
  if (!botToken || botToken === "your_bot_token_here") {
    try {
      const urlParams = new URLSearchParams(initData);
      const userData = urlParams.get("user");
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) return null;
    return JSON.parse(urlParams.get("user") || "{}");
  } catch (e) {
    return null;
  }
}

// Helper to reset daily limits
function resetDailyIfNeeded(user: any) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  
  const updates: any = {};
  
  // Check and reset todayAds if it's a new day
  const adDate = user.todayAdsDate ? String(user.todayAdsDate) : "";
  if (!adDate || adDate < todayStr) {
    updates.todayAds = 0;
    updates.todayAdsDate = todayStr;
  }

  // Check and reset spins if it's a new day
  const spinDate = user.spinsDate ? String(user.spinsDate) : "";
  if (!spinDate || spinDate < todayStr) {
    updates.spinsLeft = 1; // 1 free spin per day
    updates.spinsDate = todayStr;
  }

  return updates;
}

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  
  telegram: router({
    getUser: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string(), referralCode: z.string().optional() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid Telegram data" };
        }

        let user = await getTelegramUser(input.telegramId);
        const now = new Date();

        if (!user) {
          // New user - check for referral
          let referredByUser = null;
          if (input.referralCode) {
            const allUsers = await getAllTelegramUsers();
            referredByUser = allUsers.find(u => u.referralCode === input.referralCode);
          }
          
          const newReferralCode = `REF${input.telegramId}`;
          
          user = await upsertTelegramUser({
            telegramId: input.telegramId,
            username: verified.username,
            firstName: verified.first_name,
            lastName: verified.last_name,
            photoUrl: verified.photo_url,
            balance: 0,
            totalEarned: 0,
            todayAds: 0,
            todayAdsDate: now.toISOString().split("T")[0],
            spinsLeft: 1,
            spinsDate: now.toISOString().split("T")[0],
            referralCode: newReferralCode,
            referredBy: referredByUser?.telegramId,
          });
        } else {
          const dailyUpdates = resetDailyIfNeeded(user);
          if (Object.keys(dailyUpdates).length > 0) {
            user = await upsertTelegramUser({ ...user, ...dailyUpdates });
          }
        }

        const starsRate = await getSetting("starsRate", 1000);
        const minWithdraw = await getSetting("minWithdraw", 10000);
        const adsgramBlockId = ENV.adsgramBlockId || "demo-block-id";

        return {
          success: true,
          user: {
            ...user,
            adReward: 10,
            adCooldown: 30,
            starsRate,
            minWithdraw,
            adsgramBlockId,
            lastAdTime: user?.lastAdTime?.getTime() || null,
          },
        };
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

        if (user.todayAds >= 50) return { success: false, message: "Daily limit reached" };

        const token = uuidv4();
        await createAdToken(token, input.telegramId);
        return { success: true, token };
      }),

    claim: publicProcedure
      .input(z.object({ telegramId: z.number(), token: z.string(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const adToken = await getAdToken(input.token);
        if (!adToken || adToken.telegramId !== input.telegramId || adToken.used === "true") {
          return { success: false, message: "Invalid token" };
        }

        await markAdTokenUsed(input.token);
        let user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        const reward = 10;
        // When watching an ad, user gets 10 points AND 1 spin if they have 0 spins
        const newSpins = user.spinsLeft === 0 ? 1 : user.spinsLeft;

        user = await upsertTelegramUser({
          ...user,
          balance: user.balance + reward,
          totalEarned: user.totalEarned + reward,
          todayAds: user.todayAds + 1,
          lastAdTime: new Date(),
          spinsLeft: newSpins,
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "ad",
          points: reward,
          metadata: JSON.stringify({ token: input.token }),
        });

        return { success: true, reward, balance: user?.balance };
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

        user = await upsertTelegramUser({
          ...user,
          balance: user.balance + prize,
          totalEarned: user.totalEarned + prize,
          spinsLeft: user.spinsLeft - 1,
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "spin",
          points: prize,
          metadata: JSON.stringify({ prize }),
        });

        return { success: true, prize, balance: user?.balance, spinsLeft: user?.spinsLeft };
      }),
  }),

  withdraw: router({
    create: publicProcedure
      .input(z.object({ telegramId: z.number(), amount: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) return { success: false, message: "Invalid data" };

        const user = await getTelegramUser(input.telegramId);
        if (!user) return { success: false, message: "User not found" };

        const minWithdraw = await getSetting("minWithdraw", 10000);
        if (user.balance < input.amount) return { success: false, message: "Insufficient balance" };
        if (input.amount < minWithdraw) return { success: false, message: `Minimum withdrawal is ${minWithdraw}` };

        const starsRate = await getSetting("starsRate", 1000);
        const stars = Math.floor(input.amount / starsRate);

        const withdrawal = await createWithdrawal({
          telegramId: input.telegramId,
          amount: input.amount,
          stars,
        });

        const withdrawalId = withdrawal ? (withdrawal as any).insertId : undefined;

        await upsertTelegramUser({
          ...user,
          balance: user.balance - input.amount,
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "withdraw",
          points: -input.amount,
          metadata: JSON.stringify({ withdrawalId }),
        });

        return { success: true, stars };
      }),
  }),

  // Daily gift - free coins every day
  dailyGift: router({
    claim: publicProcedure
      .input(z.object({ telegramId: z.number(), initData: z.string() }))
      .mutation(async ({ input }) => {
        const verified = verifyTelegramWebApp(input.initData);
        if (!verified || verified.id !== input.telegramId) {
          return { success: false, message: "Invalid data", reward: 0 };
        }

        const user = await getTelegramUser(input.telegramId);
        if (!user) {
          return { success: false, message: "User not found", reward: 0 };
        }

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        
        // Check if already claimed today
        if (user.lastGiftDate === todayStr) {
          return { 
            success: false, 
            message: "You have already received today's gift! Come back tomorrow.", 
            reward: 0,
            canClaim: false,
            nextGiftTime: "24:00:00"
          };
        }

        // Gift amounts: 50, 100, 150, 200, 500
        const giftAmounts = [50, 100, 150, 200, 500];
        const reward = giftAmounts[Math.floor(Math.random() * giftAmounts.length)];

        const updatedUser = await upsertTelegramUser({
          ...user,
          balance: user.balance + reward,
          totalEarned: user.totalEarned + reward,
          lastGiftDate: todayStr,
        });

        await createTransaction({
          telegramId: input.telegramId,
          type: "bonus",
          points: reward,
          metadata: JSON.stringify({ giftType: "daily" }),
        });

        return { 
          success: true, 
          reward, 
          canClaim: true,
          nextGiftDate: now.toISOString().split("T")[0]
        };
      }),
  }),
});
