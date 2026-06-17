import { Telegraf, Markup } from "telegraf";
import type { Express } from "express";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

function getEffectiveAdminSecret(): string {
  const explicit = process.env.ADMIN_SECRET || "";
  if (explicit) return explicit;
  const bot = process.env.BOT_TOKEN || "";
  if (!bot) return "";
  return createHash("sha256").update("admin:" + bot).digest("hex");
}
import { getTelegramUser, upsertTelegramUser, getInactiveUsers, createTransaction, getTransactions, getSetting, updateLastReminded } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL;
const BOT_USERNAME = process.env.TELEGRAM_BOT || process.env.VITE_BOT_USER_NAME || process.env.BOT_USERNAME || "";

// Minimum points to trigger withdrawal notification
const WITHDRAW_THRESHOLD = 15000;

// Track which users already received the withdrawal notification this session
const notifiedWithdraw = new Set<number>();

// Track which users received the "near withdrawal" notification this session
const notifiedNearWithdraw = new Set<number>();

export async function notifyNearWithdraw(telegramId: number, balance: number): Promise<void> {
  if (!BOT_TOKEN) return;
  if (notifiedNearWithdraw.has(telegramId)) return;

  try {
    const minWithdraw = Number(await getSetting("minWithdraw", 10000));
    const threshold = minWithdraw * 0.8;

    // Only notify when between 80% and 100% of minWithdraw
    if (balance < threshold || balance >= minWithdraw) return;

    notifiedNearWithdraw.add(telegramId);

    const remaining = minWithdraw - balance;
    const webappUrl = WEBAPP_URL || "";

    const bot = new Telegraf(BOT_TOKEN);
    await bot.telegram.sendMessage(
      telegramId,
      `🔥 أنت قريب جداً من السحب!\n\n` +
      `💰 رصيدك: ${balance.toLocaleString()} نقطة\n` +
      `🎯 لم يبق إلا ${remaining.toLocaleString()} نقطة للوصول!\n\n` +
      `العب أكثر واسحب عملة DigiByte قريباً 🟦`,
      webappUrl ? {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 العب الآن وأكمل الهدف!", web_app: { url: webappUrl } }]
          ]
        }
      } : undefined
    );
  } catch (err: any) {
    if (err?.response?.error_code !== 403) {
      console.warn(`[Bot] Failed to send near-withdraw notification to ${telegramId}:`, err?.message);
    }
  }
}

export async function notifyWithdrawReady(telegramId: number, balance: number): Promise<void> {
  if (!BOT_TOKEN) return;
  if (notifiedWithdraw.has(telegramId)) return;
  if (balance < WITHDRAW_THRESHOLD) return;

  notifiedWithdraw.add(telegramId);

  try {
    const bot = new Telegraf(BOT_TOKEN);
    const webappUrl = WEBAPP_URL || "";
    await bot.telegram.sendMessage(
      telegramId,
      `💰 رصيدك وصل ${balance.toLocaleString()} نقطة!\n\n` +
      `🟦 يمكنك الآن سحب نقاطك كـ DigiByte (DGB)\n\n` +
      `اضغط الزر أدناه للسحب الآن 👇`,
      webappUrl ? {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💸 اسحب الآن", web_app: { url: webappUrl } }]
          ]
        }
      } : undefined
    );
  } catch (err: any) {
    if (err?.response?.error_code !== 403) {
      console.warn(`[Bot] Failed to send withdraw notification to ${telegramId}:`, err?.message);
    }
  }
}
function buildRandomCaption(code: string, reward: number, expiresInHours: number, maxUses: number): string {
  const h = expiresInHours;
  const timeLabel = h === 1 ? "1 Hour Only" : `${h} Hours Only`;
  const timeShort = h === 1 ? "1 Hour" : `${h} Hours`;
  const pts = reward.toLocaleString();

  const templates = [
    // 1 — Original style
    `⚡ *New Redeem Code is LIVE!* ⚡\n\n` +
    `🎟 Code: \`${code}\`\n` +
    `🎁 Reward: ${pts} Points\n` +
    `⏳ Valid For: ${timeLabel}\n` +
    `👥 Limited To: ${maxUses} Users\n\n` +
    `🔥 Time is running out — redeem your reward now before the code expires!\n` +
    `🚀 Open the Mini App and claim it instantly 💎`,

    // 2 — Alert style
    `🚨 *EXCLUSIVE CODE DROP* 🚨\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🎫 Code: \`${code}\`\n` +
    `💰 Reward: ${pts} Points\n` +
    `⌛ Active For: ${timeShort}\n` +
    `🎯 Only ${maxUses} Spots Left!\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⚡ First come, first served!\n` +
    `👉 Claim before it's gone 🏆`,

    // 3 — Premium style
    `💎 *PREMIUM CODE JUST DROPPED* 💎\n\n` +
    `🔑 Code: \`${code}\`\n` +
    `🏆 Earn: ${pts} Points\n` +
    `⏱ Valid: ${timeShort}\n` +
    `🎯 Limited: ${maxUses} Users Only\n\n` +
    `🌟 The fastest win — don't sleep on this!\n` +
    `🚀 Open the Mini App and grab your reward 💰`,

    // 4 — Fire style
    `🔥 *HOT CODE ALERT* 🔥\n\n` +
    `🎟 Code: \`${code}\`\n` +
    `💎 Points: ${pts}\n` +
    `⏳ Time Left: ${timeShort}\n` +
    `👥 Max Users: ${maxUses}\n\n` +
    `💥 Snap it before it's gone!\n` +
    `✅ Tap & claim instantly in the Mini App 🚀`,
  ];

  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

export async function postCodeToChannel(code: string, reward: number, expiresInHours: number, maxUses: number): Promise<void> {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN غير موجود — تحقق من متغيرات البيئة");
  const channel = process.env.REQUIRED_CHANNEL;
  if (!channel) throw new Error("REQUIRED_CHANNEL غير موجود — تحقق من متغيرات البيئة");

  const webappUrl = (WEBAPP_URL || "").replace(/\/$/, "");
  const caption = buildRandomCaption(code, reward, expiresInHours, maxUses);

  const miniAppLink = BOT_USERNAME
    ? `https://t.me/${BOT_USERNAME}?startapp`
    : webappUrl;
  const replyMarkup = miniAppLink
    ? { inline_keyboard: [[{ text: "⚡️ OPEN & CLAIM YOUR REWARD ⚡️", url: miniAppLink }]] }
    : undefined;

  // Try to load the banner image from filesystem (works in both dev & prod)
  const bannerPaths = [
    path.join(process.cwd(), "dist/public/code-banner.png"),
    path.join(process.cwd(), "client/public/code-banner.png"),
  ];
  let bannerBuffer: Buffer | null = null;
  for (const p of bannerPaths) {
    if (fs.existsSync(p)) {
      bannerBuffer = fs.readFileSync(p);
      break;
    }
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);
    let sentMsg: any;
    if (bannerBuffer) {
      // Send photo (buffer) with caption — works without public URL
      sentMsg = await (bot.telegram as any).sendPhoto(
        channel,
        { source: bannerBuffer },
        {
          caption,
          parse_mode: "Markdown",
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }
      );
    } else {
      // Fallback: text-only if image not found
      console.warn("[Bot] code-banner.png not found — sending text-only");
      sentMsg = await (bot.telegram as any).sendMessage(channel, caption, {
        parse_mode: "Markdown",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
    }

    // 📌 تثبيت الرسالة تلقائياً في أعلى القناة
    if (sentMsg?.message_id) {
      try {
        await bot.telegram.pinChatMessage(channel, sentMsg.message_id, { disable_notification: true });
        console.log(`[Bot] Message pinned in channel: ${sentMsg.message_id}`);
      } catch (pinErr: any) {
        console.warn(`[Bot] Could not pin message (check bot is admin with pin permission):`, pinErr?.message);
      }
    }

    console.log(`[Bot] Code posted to channel: ${code}`);
  } catch (err: any) {
    console.error(`[Bot] Failed to post code to channel:`, err?.message);
    throw err;
  }
}

const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (WEBAPP_URL ? new URL(WEBAPP_URL).origin : undefined);

let isBotStarted = false;

// Per-user 24h cooldown is handled in getInactiveUsers via lastRemindedAt

async function sendInactivityReminders(bot: Telegraf, webappUrl: string) {
  try {
    const inactiveUsers = await getInactiveUsers(1, 200);
    let sent = 0;
    for (const user of inactiveUsers) {
      try {
        const name = user.firstName || user.username || "صديقي";
        await bot.telegram.sendMessage(
          user.telegramId,
          `👋 مرحباً ${name}!\n\n` +
          `لاحظنا أنك لم تلعب منذ فترة 😔\n\n` +
          `🎁 لديك 5 دورات مجانية بانتظارك!\n` +
          `💰 رصيدك الحالي: ${user.balance} نقطة\n\n` +
          `تعال والعب الآن واربح أكثر! 🚀`,
          webappUrl ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🎮 العب الآن!", web_app: { url: webappUrl } }]
              ]
            }
          } : undefined
        );
        await updateLastReminded(user.telegramId);
        sent++;
        await new Promise(r => setTimeout(r, 1200));
      } catch (err: any) {
        // 403 = user blocked bot — skip silently
        if (err?.response?.error_code !== 403) {
          console.warn(`[Bot] Failed to notify user ${user.telegramId}:`, err?.message);
        }
      }
    }
    console.log(`[Bot] Sent inactivity reminders to ${sent}/${inactiveUsers.length} users`);
    // Per-user cooldown already saved via updateLastReminded above
  } catch (err) {
    console.error("[Bot] Error in sendInactivityReminders:", err);
  }
}

function scheduleReminders(bot: Telegraf) {
  const check = async () => {
    try {
      // No global lock — per-user lastRemindedAt (24h cooldown) prevents spam
      console.log("[Bot] Running inactivity reminder check...");
      await sendInactivityReminders(bot, WEBAPP_URL || "");
    } catch (err) {
      console.error("[Bot] scheduleReminders check error:", err);
    }
  };

  // Check every 30 minutes — resilient against restarts and Render free-tier sleep
  setInterval(check, 30 * 60 * 1000);

  // Run 1 minute after startup to let DB settle (reduced from 5 min)
  setTimeout(() => {
    console.log("[Bot] Running startup inactivity check...");
    check();
  }, 60 * 1000);
}

export async function startBot(app?: Express) {
  if (!BOT_TOKEN) {
    console.warn("[Bot] BOT_TOKEN is not set. Bot will not start.");
    return;
  }

  if (isBotStarted) {
    console.warn("[Bot] Bot is already starting or started. Skipping duplicate call.");
    return;
  }
  isBotStarted = true;

  const bot = new Telegraf(BOT_TOKEN);

  scheduleReminders(bot);

  // ── Admin command middleware (top-level, runs before everything else) ──
  bot.use(async (ctx, next) => {
    const text = (ctx.message as any)?.text || "";
    const fromId = ctx.from?.id;
    const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;

    // /ping — تشخيص: يعمل لأي شخص بدون شروط
    if (text === "/ping" || text.startsWith("/ping ")) {
      await ctx.reply(`🏓 pong!\nID: ${fromId}\nAdmin: ${ADMIN_ID}\nMatch: ${fromId === ADMIN_ID}`).catch(() => {});
      return;
    }

    if (text === "/botbalance" || text.startsWith("/botbalance ")) {
      if (fromId !== ADMIN_ID) {
        await ctx.reply("❌ غير مصرح. ID الخاص بك: " + fromId).catch(() => {});
        return;
      }
      try {
        // Paginate all transactions to compute real balance
        let offset = 0;
        let received = 0;
        let sent = 0;
        let pages = 0;
        while (pages < 20) {
          const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getStarTransactions?limit=100&offset=${offset}`);
          const d = (await r.json()) as any;
          if (!d.ok || !d.result?.transactions?.length) break;
          for (const tx of d.result.transactions) {
            if (tx.receiver) { sent += (tx.amount || 0); }
            else { received += (tx.amount || 0); }
          }
          if (d.result.transactions.length < 100) break;
          offset += 100;
          pages++;
        }
        const balance = received - sent;
        await ctx.reply(
          `⭐ رصيد البوت الحالي: ${balance} نجمة\n\n` +
          `📥 مستلم: ${received} نجمة\n` +
          `📤 مُرسل: ${sent} نجمة\n\n` +
          `لشحن النجوم: /topup <العدد>\nمثال: /topup 100`
        );
      } catch (e: any) {
        await ctx.reply("❌ خطأ: " + (e?.message || "تعذّر الاتصال")).catch(() => {});
      }
      return;
    }

    if (text === "/topup" || text.startsWith("/topup ")) {
      const parts = text.trim().split(/\s+/);
      const amount = parseInt(parts[1] || "");
      if (!amount || amount < 1) {
        await ctx.reply("⚠️ الاستخدام: /topup <عدد النجوم>\nمثال: /topup 100");
        return;
      }
      try {
        const invoiceLink = await ctx.telegram.createInvoiceLink({
          title: "شحن خزينة البوت ⭐",
          description: `إيداع ${amount} نجمة في البوت لإرسالها تلقائياً`,
          payload: `admin_topup_${amount}_${Date.now()}`,
          provider_token: "",
          currency: "XTR",
          prices: [{ label: `${amount} نجمة`, amount }],
        });
        await ctx.reply(`⭐ لشحن البوت بـ ${amount} نجمة:\n${invoiceLink}`);
      } catch (e: any) {
        await ctx.reply("❌ فشل: " + (e?.message || "خطأ غير معروف")).catch(() => {});
      }
      return;
    }

    return next();
  });


  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    const startPayload = ctx.payload || "";
    let referrerId: string | null = null;
    if (startPayload.startsWith("ref_")) {
      const rid = startPayload.replace("ref_", "");
      if (/^\d+$/.test(rid)) referrerId = rid;
    }

    console.log(`[Bot] New user started bot: ${telegramId} (@${username}) ref=${referrerId || "none"}`);

    try {
      let user = await getTelegramUser(telegramId);
      const isNewUser = !user;
      if (!user) {
        user = await upsertTelegramUser({
          telegramId,
          username,
          firstName,
          lastName,
          referralCode: "ref_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
          referredBy: referrerId ? parseInt(referrerId) : undefined,
        }) || null;
        await createTransaction({ telegramId, type: "bonus", points: 0, metadata: JSON.stringify({ action: "registration" }) });

        // 🔔 إشعار الأدمن بمستخدم جديد
        const adminId = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;
        if (adminId) {
          const displayName = [firstName, lastName].filter(Boolean).join(" ");
          const usernameStr = username ? ` (@${username})` : "";
          const refStr = referrerId ? `\n👥 جاء عن طريق دعوة` : "";
          const notifMsg = `🆕 مستخدم جديد انضم!\n\n👤 الاسم: ${displayName}${usernameStr}\n🆔 ID: ${telegramId}${refStr}`;
          try { await bot.telegram.sendMessage(adminId, notifMsg); } catch (_) { /* لا تعطّل التسجيل إذا فشل الإشعار */ }
        }
      }

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\n🎮 العب الآن واربح النقاط!\n🚀 كلما لعبت أكثر ربحت أكثر.\n💰 اجمع النقاط واستبدلها بالجوائز.`;

      if (WEBAPP_URL) {
        const appUrl = referrerId
          ? WEBAPP_URL.replace(/\/+$/, "") + "?ref=" + referrerId
          : WEBAPP_URL;

        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.webApp("فتح التطبيق 📱", appUrl)],
            [Markup.button.url("قناة التحديثات 📢", "https://t.me/ads_reward123")],
          ])
        );
      } else {
        await ctx.reply(welcomeMessage + "\n\n(ملاحظة: WEBAPP_URL غير مهيأ حالياً)");
      }
    } catch (error) {
      console.error("[Bot] Error in start command:", error);
      try { await ctx.reply("حدث خطأ أثناء تهيئة حسابك. يرجى المحاولة لاحقاً."); } catch (e) { /* ignore */ }
    }
  });

  const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;

  bot.command("admin", async (ctx) => {
    const ak = process.env.ADMIN_SECRET ? encodeURIComponent(process.env.ADMIN_SECRET) : '';
    const adminUrl = WEBAPP_URL ? `${WEBAPP_URL.replace(/\/+$/, "")}/admin${ak ? '?ak=' + ak : ''}` : null;
    if (adminUrl) {
      await ctx.reply(
        "🛡️ لوحة الإدارة — ستحتاج كلمة المرور إن لم تكن مشرفاً:",
        Markup.inlineKeyboard([
          [Markup.button.webApp("🛡️ فتح لوحة الإدارة", adminUrl)]
        ])
      );
    } else {
      await ctx.reply("⚠️ WEBAPP_URL غير مهيأ.");
    }
  });

  bot.help((ctx) => {
    ctx.reply("استخدم الزر 'فتح التطبيق' للوصول إلى واجهة الكسب الخاصة بك.");
  });

  // /buy — شراء نقاط بالنجوم
  bot.command("buy", async (ctx) => {
    const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
    await ctx.reply(
      `🛒 *متجر النقاط*\n\n` +
      `اشترِ نقاطاً بنجوم تيليغرام واستخدمها في البوت:\n\n` +
      `🌟 *باقة البداية* — 50 ⭐ ← 5,000 نقطة\n` +
      `⭐ *باقة الذهب* — 100 ⭐ ← 12,000 نقطة (+20%)\n` +
      `💎 *باقة الماس* — 250 ⭐ ← 35,000 نقطة (+40%)\n\n` +
      `اختر باقتك:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌟 50 ⭐ ← 5,000 نقطة",   callback_data: "buy_pkg_1" }],
            [{ text: "⭐ 100 ⭐ ← 12,000 نقطة",  callback_data: "buy_pkg_2" }],
            [{ text: "💎 250 ⭐ ← 35,000 نقطة",  callback_data: "buy_pkg_3" }],
            ...(webappUrl ? [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] : []),
          ],
        },
      } as any
    );
  });

  // ── أوامر الأدمن: رصيد البوت وشحن النجوم ──────────────────────────────

  // /botbalance — يعرض رصيد النجوم الحالي في البوت
  bot.command("botbalance", async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) {
      await ctx.reply("❌ غير مصرح | ID: " + ctx.from?.id + " expected: " + ADMIN_TELEGRAM_ID);
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getStarTransactions?limit=1`);
      const data = (await res.json()) as any;
      if (data.ok) {
        const balance = data.result?.amount ?? 0;
        await ctx.reply(`⭐ رصيد البوت الحالي: ${balance} نجمة\n\nلشحن النجوم استخدم: /topup <عدد النجوم>\nمثال: /topup 100`);
      } else {
        await ctx.reply("❌ فشل جلب الرصيد: " + (data.description || "خطأ غير معروف"));
      }
    } catch (e: any) {
      await ctx.reply("❌ خطأ: " + (e?.message || "تعذّر الاتصال"));
    }
  });

  // /givespins <telegramId> <quantity> — يعطي دورات مجاناً للتجربة (أدمن فقط)
  bot.command("givespins", async (ctx) => {
    if (ctx.from?.id !== ADMIN_TELEGRAM_ID) {
      await ctx.reply("❌ غير مصرح");
      return;
    }
    const args = ctx.message?.text?.trim().split(/\s+/);
    const targetId = parseInt(args?.[1] || "");
    const qty      = parseInt(args?.[2] || "1");
    if (!targetId || isNaN(qty) || qty < 1 || qty > 50) {
      await ctx.reply(
        "⚠️ الاستخدام:\n/givespins <telegram_id> <عدد الدورات>\n\nمثال:\n/givespins 5279238199 5\nيعطي 5 دورات مجانية للاختبار"
      );
      return;
    }
    try {
      const user = await getTelegramUser(targetId);
      if (!user) {
        await ctx.reply(`❌ المستخدم ${targetId} غير موجود في قاعدة البيانات.\n\nتأكد أنه فتح البوت مرة واحدة على الأقل.`);
        return;
      }
      const currentSpins = Number(user.spinsLeft) || 0;
      await upsertTelegramUser({ telegramId: targetId, spinsLeft: currentSpins + qty });
      await createTransaction({
        telegramId: targetId,
        type: "bonus",
        points: 0,
        metadata: JSON.stringify({ action: "admin_give_spins", quantity: qty, by: ctx.from?.id }),
      });
      await ctx.reply(
        `✅ تم!\n🎡 أُضيفت ${qty} دورة للمستخدم ${targetId}\n📊 الدورات الآن: ${currentSpins + qty}`
      );
      // إشعار المستخدم
      try {
        await bot.telegram.sendMessage(targetId, `🎁 حصلت على ${qty} دورة مجانية في عجلة الحظ!\nافتح التطبيق والعب الآن 🎡`);
      } catch (_) {}
    } catch (e: any) {
      await ctx.reply("❌ خطأ: " + (e?.message || "فشل"));
    }
  });

  // /topup <amount> — ينشئ رابط دفع لشحن خزينة البوت من نجوم الأدمن
  bot.command("topup", async (ctx) => {
    const args = ctx.message?.text?.trim().split(/\s+/);
    const amount = parseInt(args?.[1] || "");
    if (!amount || amount < 1) {
      await ctx.reply(
        "⚠️ الاستخدام الصحيح:\n/topup <عدد النجوم>\n\nمثال: /topup 100\nيشحن 100 نجمة من حسابك إلى خزينة البوت."
      );
      return;
    }
    try {
      const invoiceLink = await ctx.telegram.createInvoiceLink({
        title: "شحن خزينة البوت ⭐",
        description: `إيداع ${amount} نجمة في البوت لإرسالها تلقائياً عند الموافقة على طلبات السحب`,
        payload: `admin_topup_${amount}_${Date.now()}`,
        currency: "XTR",
        prices: [{ label: `${amount} نجمة`, amount }],
      });
      await ctx.reply(
        `⭐ لشحن البوت بـ ${amount} نجمة اضغط الرابط أدناه:\n${invoiceLink}\n\n` +
        `✅ بعد الدفع ستُرسل النجوم تلقائياً للمستخدمين عند كل موافقة على سحب.`
      );
    } catch (e: any) {
      await ctx.reply("❌ فشل إنشاء رابط الدفع: " + (e?.message || "خطأ غير معروف"));
    }
  });

  // قبول دفع شحن الخزينة تلقائياً
  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  // تأكيد نجاح الشحن وإشعار الأدمن
  bot.on("message", async (ctx, next) => {
    const msg = ctx.message as any;
    if (msg?.successful_payment && msg.successful_payment.invoice_payload?.startsWith("admin_topup_")) {
      const stars = msg.successful_payment.total_amount;
      try {
        await ctx.reply(
          `✅ تم شحن البوت بنجاح!\n⭐ المبلغ: ${stars} نجمة\n\nالبوت الآن قادر على إرسال النجوم تلقائياً عند الموافقة على طلبات السحب.`
        );
      } catch (_) {}
      return;
    }

    // شراء دورات عجلة الحظ بالنجوم
    if (msg?.successful_payment && msg.successful_payment.invoice_payload?.startsWith("spin_stars_")) {
      const parts = (msg.successful_payment.invoice_payload as string).split("_");
      // format: spin_stars_<telegramId>_<qty>_<timestamp>
      const telegramId = parseInt(parts[2] || "0");
      const quantity   = parseInt(parts[3] || "1");
      const stars      = msg.successful_payment.total_amount;
      if (telegramId > 0 && quantity > 0) {
        try {
          const user = await getTelegramUser(telegramId);
          if (user) {
            const currentSpins = Number(user.spinsLeft) || 0;
            await upsertTelegramUser({ telegramId, spinsLeft: currentSpins + quantity });
            await createTransaction({
              telegramId,
              type: "bonus",
              points: 0,
              metadata: JSON.stringify({ action: "buy_spins_stars", quantity, stars }),
            });
          }
        } catch (_) {}
      }
      try {
        await ctx.reply(
          `✅ تم الدفع بنجاح!\n⭐ دفعت: ${stars} نجمة\n🎡 حصلت على: ${quantity} دورة في عجلة الحظ\n\nافتح التطبيق والعب الآن! 🎁`
        );
      } catch (_) {}
      return;
    }

    // شراء نقاط بالنجوم — buy_points_<telegramId>_<packageId>_<points>_<timestamp>
    if (msg?.successful_payment && msg.successful_payment.invoice_payload?.startsWith("buy_points_")) {
      const parts  = (msg.successful_payment.invoice_payload as string).split("_");
      const telegramId = parseInt(parts[2] || "0");
      const points     = parseInt(parts[4] || "0");
      const stars      = msg.successful_payment.total_amount;
      if (telegramId > 0 && points > 0) {
        try {
          const { getTelegramUser, upsertTelegramUser, createTransaction } = await import("./db");
          const user = await getTelegramUser(telegramId);
          if (user) {
            const newBalance = (Number(user.balance) || 0) + points;
            await upsertTelegramUser({ telegramId, balance: newBalance });
            await createTransaction({
              telegramId,
              type: "bonus",
              points,
              metadata: JSON.stringify({ action: "buy_points_stars", stars, points }),
            });
          }
        } catch (_) {}
      }
      try {
        const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
        await ctx.reply(
          `✅ *تم الشراء بنجاح!*\n\n` +
          `⭐ دفعت: *${stars} نجمة*\n` +
          `💰 حصلت على: *${points.toLocaleString()} نقطة* أُضيفت لرصيدك فوراً\n\n` +
          `العب أكثر واجمع نقاطك لطلب السحب! 🚀`,
          {
            parse_mode: "Markdown",
            ...(webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}),
          } as any
        );
      } catch (_) {}
      return;
    }

    return next();
  });

  bot.on("chat_member", async (ctx) => {
    try {
      const update = (ctx.update as any).chat_member;
      if (!update) return;
      const wasActive = ["member","administrator","creator"].includes(update.old_chat_member?.status || "");
      const nowLeft = ["left","kicked","banned"].includes(update.new_chat_member?.status || "");
      if (!wasActive || !nowLeft) return;
      const telegramId = update.from.id;
      const chatId = String(update.chat.id);
      const { getTasks, getUserTasks, removeUserTask, getTelegramUser, upsertTelegramUser, createTransaction } = await import("./db");
      const [allTasks, userTasks] = await Promise.all([getTasks(), getUserTasks(telegramId)]);
      for (const task of allTasks) {
        if (task.channelId !== chatId) continue;
        const ut = userTasks.find(u => u.taskId === task.id);
        if (!ut) continue;
        const dbUser = await getTelegramUser(telegramId);
        if (!dbUser) continue;
        const newBal = Math.max(0, (dbUser.balance || 0) - ut.pointsEarned);
        await Promise.all([
          removeUserTask(telegramId, task.id),
          upsertTelegramUser({ telegramId, balance: newBal }),
          createTransaction({ telegramId, type: "task_penalty", points: -ut.pointsEarned, metadata: JSON.stringify({ taskId: task.id }) }),
        ]);
        const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
        await ctx.telegram.sendMessage(telegramId,
          `⚠️ غادرت ${task.name} وتم خصم ${ut.pointsEarned} نقطة من رصيدك!`,
          webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}
        ).catch(() => {});
      }
    } catch (e) { console.error("[Bot] chat_member error:", e); }
  });

  // ── معالجة أزرار الموافقة/الرفض اليدوي للسحب (للأدمن فقط) ──────────────
  bot.on("callback_query", async (ctx) => {
    const fromId = ctx.from?.id;
    const ADMIN_ID = Number(process.env.ADMIN_TELEGRAM_ID) || 5279238199;
    const data = (ctx.callbackQuery as any).data || "";

    // withdraw_done_dgb_<withdrawalId>_<userTelegramId>
    if (data.startsWith("withdraw_done_dgb_")) {
      if (fromId !== ADMIN_ID) {
        await ctx.answerCbQuery("❌ غير مصرح").catch(() => {});
        return;
      }
      const parts = data.split("_"); // [withdraw, done, dgb, id, telegramId]
      const withdrawalId = parseInt(parts[3] || "0");
      const userTelegramId = parseInt(parts[4] || "0");
      const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";

      try {
        const { updateWithdrawalStatus } = await import("./db");
        await updateWithdrawalStatus(withdrawalId, "completed");

        // إشعار المستخدم بنجاح الإرسال
        await bot.telegram.sendMessage(
          userTelegramId,
          `🎉 *تم إرسال DigiByte (DGB) بنجاح!*\n\n` +
          `🟦 تم تحويل المبلغ إلى محفظتك المسجلة لدينا.\n\n` +
          `شكراً لك، استمر باللعب لتربح المزيد! 🚀`,
          {
            parse_mode: "Markdown",
            ...(webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}),
          }
        ).catch(() => {});

        // تحديث رسالة الأدمن
        await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ تم إرسال DGB — مكتمل", callback_data: "noop" }]] }).catch(() => {});
        await ctx.answerCbQuery("✅ تم إشعار المستخدم بنجاح إرسال DGB").catch(() => {});
      } catch (e: any) {
        await ctx.answerCbQuery("❌ خطأ: " + (e?.message || "فشل")).catch(() => {});
      }
      return;
    }

    // withdraw_done_<withdrawalId>_<userTelegramId>_<stars>
    if (data.startsWith("withdraw_done_")) {
      if (fromId !== ADMIN_ID) {
        await ctx.answerCbQuery("❌ غير مصرح").catch(() => {});
        return;
      }
      const parts = data.split("_"); // [withdraw, done, id, telegramId, stars]
      const withdrawalId = parseInt(parts[2] || "0");
      const userTelegramId = parseInt(parts[3] || "0");
      const stars = parseInt(parts[4] || "0");
      const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";

      try {
        const { updateWithdrawalStatus } = await import("./db");
        await updateWithdrawalStatus(withdrawalId, "completed");

        // إشعار المستخدم بنجاح الإرسال
        await bot.telegram.sendMessage(
          userTelegramId,
          `🎉 *تم إرسال DigiByte بنجاح!*\n\n` +
          `🟦 تم تحويل DGB إلى محفظتك المسجلة.\n\n` +
          `شكراً لك، استمر باللعب لتربح المزيد! 🚀`,
          {
            parse_mode: "Markdown",
            ...(webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}),
          }
        ).catch(() => {});

        // تحديث رسالة الأدمن
        await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: "✅ تم الإرسال — مكتمل", callback_data: "noop" }]] }).catch(() => {});
        await ctx.answerCbQuery("✅ تم إشعار المستخدم بنجاح الإرسال").catch(() => {});
      } catch (e: any) {
        await ctx.answerCbQuery("❌ خطأ: " + (e?.message || "فشل")).catch(() => {});
      }
      return;
    }

    // withdraw_reject_<withdrawalId>_<userTelegramId>_<amount>
    if (data.startsWith("withdraw_reject_")) {
      if (fromId !== ADMIN_ID) {
        await ctx.answerCbQuery("❌ غير مصرح").catch(() => {});
        return;
      }
      const parts = data.split("_"); // [withdraw, reject, id, telegramId, amount]
      const withdrawalId = parseInt(parts[2] || "0");
      const userTelegramId = parseInt(parts[3] || "0");
      const amount = parseInt(parts[4] || "0");
      const webappUrl = process.env.WEBAPP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || "";

      try {
        const { updateWithdrawalStatus, getTelegramUser, upsertTelegramUser, createTransaction, getAllWithdrawals } = await import("./db");

        // استرداد رصيد المستخدم
        const allW = await getAllWithdrawals();
        const w = allW.find((p: any) => p.id === withdrawalId);
        if (w) {
          const user = await getTelegramUser(userTelegramId);
          if (user) {
            await upsertTelegramUser({ ...user, balance: Number(user.balance) + amount });
            await createTransaction({
              telegramId: userTelegramId,
              type: "refund",
              points: amount,
              metadata: JSON.stringify({ action: "withdraw_rejected_by_admin", withdrawalId }),
            });
          }
        }
        await updateWithdrawalStatus(withdrawalId, "rejected", "رُفض يدوياً من الإدارة");

        // إشعار المستخدم بالرفض
        await bot.telegram.sendMessage(
          userTelegramId,
          `❌ *تم رفض طلب السحب*\n\n` +
          `نأسف، لم يتم إتمام عملية إرسال DGB.\n` +
          `💰 تم إعادة نقاطك إلى رصيدك تلقائياً.\n\n` +
          `تواصل مع الدعم إذا كان لديك استفسار.`,
          {
            parse_mode: "Markdown",
            ...(webappUrl ? { reply_markup: { inline_keyboard: [[{ text: "🎮 افتح التطبيق", web_app: { url: webappUrl } }]] } } : {}),
          }
        ).catch(() => {});

        // تحديث رسالة الأدمن
        await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: "❌ تم الرفض — مكتمل", callback_data: "noop" }]] }).catch(() => {});
        await ctx.answerCbQuery("✅ تم رفض الطلب وإعادة نقاط المستخدم").catch(() => {});
      } catch (e: any) {
        await ctx.answerCbQuery("❌ خطأ: " + (e?.message || "فشل")).catch(() => {});
      }
      return;
    }

    // buy_pkg_<1|2|3> — إنشاء فاتورة شراء نقاط وإرسالها للمستخدم
    if (data.startsWith("buy_pkg_")) {
      const pkgId = parseInt(data.split("_")[2] || "0");
      const packages: Record<number, { stars: number; points: number; label: string; bonus: string }> = {
        1: { stars: 50,  points: 5000,  label: "باقة البداية 🌟",  bonus: "" },
        2: { stars: 100, points: 12000, label: "باقة الذهب ⭐",   bonus: "20% مكافأة" },
        3: { stars: 250, points: 35000, label: "باقة الماس 💎",   bonus: "40% مكافأة" },
      };
      const pkg = packages[pkgId];
      if (!pkg || !fromId) {
        await ctx.answerCbQuery("❌ باقة غير صالحة").catch(() => {});
        return;
      }
      try {
        const botToken = process.env.BOT_TOKEN!;
        const payload = `buy_points_${fromId}_${pkgId}_${pkg.points}_${Date.now()}`;
        const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: pkg.label,
            description: `احصل على ${pkg.points.toLocaleString()} نقطة${pkg.bonus ? ` — ${pkg.bonus}!` : "!"}`,
            payload,
            currency: "XTR",
            prices: [{ label: `${pkg.points.toLocaleString()} نقطة`, amount: pkg.stars }],
          }),
        });
        const result = (await res.json()) as any;
        if (result.ok) {
          await ctx.answerCbQuery("").catch(() => {});
          await bot.telegram.sendMessage(fromId,
            `💳 *${pkg.label}*\n\n` +
            `⭐ السعر: *${pkg.stars} نجمة*\n` +
            `💰 تحصل على: *${pkg.points.toLocaleString()} نقطة*${pkg.bonus ? `\n🎁 ${pkg.bonus}` : ""}\n\n` +
            `اضغط الزر أدناه للدفع:`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: `💳 ادفع ${pkg.stars} ⭐`, url: result.result }]] },
            } as any
          ).catch(() => {});
        } else {
          await ctx.answerCbQuery("❌ فشل إنشاء الفاتورة").catch(() => {});
        }
      } catch (_) {
        await ctx.answerCbQuery("❌ خطأ في الاتصال").catch(() => {});
      }
      return;
    }

    if (data === "noop") {
      await ctx.answerCbQuery("").catch(() => {});
    }
  });

  try {
    console.log("[Bot] Clearing existing webhook/polling state to prevent 409...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err: any) {
    console.warn("[Bot] Pre-launch cleanup warning:", err?.message);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && PUBLIC_URL && app) {
    const secretPath = `/telegraf/${bot.secretPathComponent()}`;
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}${secretPath}`;

    try {
      app.use(bot.webhookCallback(secretPath));
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true, allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member", "pre_checkout_query"] });
      console.log(`[Bot] ✅ Webhook mode ENABLED (Anti-409): ${webhookUrl}`);
      return;
    } catch (err) {
      console.error("[Bot] Webhook setup failed, this may cause 409:", err);
    }
  }

  if (!isProduction) {
    console.log("[Bot] Starting in long polling mode (Development)...");
    try {
      await bot.launch({ dropPendingUpdates: true });
      console.log("[Bot] ✅ Telegram bot launched (long polling)");
    } catch (err: any) {
      console.error("[Bot] Polling launch failed:", err?.message);
      isBotStarted = false;
    }
  } else {
    console.error("[Bot] ❌ CRITICAL: Webhook could not be established in production. Polling disabled to prevent 409.");
  }

  const stopBot = (reason: string) => {
    bot.stop(reason);
    isBotStarted = false;
  };
  process.once("SIGINT", () => stopBot("SIGINT"));
  process.once("SIGTERM", () => stopBot("SIGTERM"));
}

// ── إرسال نجوم تلقائياً عبر sendGift (Bot API 8.3+) ──────────────────────
// يعمل مع أي مبلغ بما فيه الحد الأدنى 10 نجوم:
// 1) يحاول المطابقة التامة أولاً (هدايا كبيرة + صغيرة)
// 2) إذا تعذّرت المطابقة التامة يرسل أصغر هدية متاحة ≥ المبلغ المتبقي (فرق بسيط للمستخدم)
export async function sendStarsGift(
  botToken: string,
  telegramId: number,
  starsCount: number
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    // جلب الهدايا المتاحة من تيليغرام
    const giftsRes = await fetch(`https://api.telegram.org/bot${botToken}/getAvailableGifts`);
    const giftsData = (await giftsRes.json()) as any;

    if (!giftsData.ok || !Array.isArray(giftsData.result?.gifts)) {
      return { success: false, sent: 0, error: giftsData.description || 'لا توجد هدايا متاحة' };
    }

    // تصفية هدايا النجوم فقط
    const starGifts: Array<{ id: string; star_count: number }> = giftsData.result.gifts
      .filter((g: any) => typeof g.star_count === 'number' && g.star_count > 0);

    if (starGifts.length === 0) {
      return { success: false, sent: 0, error: 'لا تتوفر هدايا نجوم في المتجر حالياً' };
    }

    // ترتيب تنازلي للخوارزمية الجشعة
    const descGifts = [...starGifts].sort((a, b) => b.star_count - a.star_count);
    // ترتيب تصاعدي للعثور على أصغر هدية تغطي المتبقي
    const ascGifts  = [...starGifts].sort((a, b) => a.star_count - b.star_count);

    let remaining = starsCount;
    let totalSent  = 0;

    // دالة مساعدة لإرسال هدية واحدة
    async function sendOne(giftId: string, giftStars: number): Promise<string | null> {
      const res  = await fetch(`https://api.telegram.org/bot${botToken}/sendGift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: telegramId, gift_id: giftId }),
      });
      const data = (await res.json()) as any;
      return data.ok ? null : (data.description || 'فشل إرسال الهدية — تحقق من رصيد النجوم في البوت');
    }

    // المرحلة 1: خوارزمية جشعة — أكبر هدية أولاً (مطابقة تامة قدر الإمكان)
    for (const gift of descGifts) {
      while (remaining >= gift.star_count) {
        const err = await sendOne(gift.id, gift.star_count);
        if (err) return { success: totalSent > 0, sent: totalSent, error: err };
        totalSent += gift.star_count;
        remaining -= gift.star_count;
      }
    }

    // المرحلة 2: إذا بقي مبلغ لم يُغطَّ — أرسل أقرب هدية ≥ remaining
    // (المستخدم يحصل على الفرق كمكافأة بسيطة لأن الهدايا بفئات ثابتة)
    if (remaining > 0) {
      const cover = ascGifts.find(g => g.star_count >= remaining);
      if (cover) {
        const err = await sendOne(cover.id, cover.star_count);
        if (err) return { success: totalSent > 0, sent: totalSent, error: err };
        totalSent += cover.star_count;
        remaining  = 0;
      } else if (totalSent === 0) {
        // المبلغ أكبر من أكبر هدية متاحة — أرسل أكبر هدية متاحة
        const biggest = descGifts[0];
        if (biggest) {
          const err = await sendOne(biggest.id, biggest.star_count);
          if (err) return { success: false, sent: 0, error: err };
          totalSent += biggest.star_count;
        }
      }
    }

    if (totalSent === 0) {
      return { success: false, sent: 0, error: 'لا توجد هدايا نجوم متاحة في تيليغرام حالياً' };
    }

    return { success: true, sent: totalSent };
  } catch (err: any) {
    return { success: false, sent: 0, error: err?.message || 'خطأ غير متوقع أثناء إرسال النجوم' };
  }
}

