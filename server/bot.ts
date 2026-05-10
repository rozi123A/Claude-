import { Telegraf, Markup } from "telegraf";
import type { Express } from "express";
import { getTelegramUser, upsertTelegramUser } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL;
const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.RENDER_EXTERNAL_URL;

// Global flag to prevent multiple instances in the same process
let isBotStarted = false;

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

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    console.log(`[Bot] New user started bot: ${telegramId} (@${username})`);

    try {
      let user = await getTelegramUser(telegramId);
      if (!user) {
        await upsertTelegramUser({
          telegramId,
          username,
          firstName,
          lastName,
          referralCode: "ref_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        });
      }

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\n🎮 العب الآن واربح النقاط!\n🚀 كلما لعبت أكثر ربحت أكثر.\n💰 اجمع النقاط واستبدلها بالجوائز.`;

      if (WEBAPP_URL) {
        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.webApp("فتح التطبيق 📱", WEBAPP_URL)],
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

  bot.help((ctx) => {
    ctx.reply("استخدم الزر 'فتح التطبيق' للوصول إلى واجهة الكسب الخاصة بك.");
  });

  // CRITICAL: Always delete webhook and drop pending updates to clear any old polling/webhook state
  try {
    console.log("[Bot] Force clearing any existing webhook/polling state...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    // Wait a bit for Telegram to process the deletion
    await new Promise((r) => setTimeout(r, 2000));
  } catch (err: any) {
    console.warn("[Bot] deleteWebhook failed:", err?.message || err);
  }

  const isProduction = process.env.NODE_ENV === "production";

  // If we have a PUBLIC_URL and an app, we prefer Webhook mode to avoid 409 conflicts
  if (isProduction && PUBLIC_URL && app) {
    const secretPath = `/telegraf/${bot.secretPathComponent()}`;
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}${secretPath}`;

    try {
      app.use(bot.webhookCallback(secretPath));
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
      console.log(`[Bot] ✅ Webhook mode enabled: ${webhookUrl}`);
      return;
    } catch (err) {
      console.error("[Bot] Failed to set webhook, falling back to polling:", err);
    }
  }

  // Long Polling Mode
  console.log("[Bot] Starting in long polling mode...");
  try {
    // Launch with drop_pending_updates to clear any backlog that might cause issues
    await bot.launch({
      allowedUpdates: ["message", "callback_query"],
      dropPendingUpdates: true
    });
    console.log("[Bot] ✅ Telegram bot launched (long polling)");
  } catch (err: any) {
    const code = err?.response?.error_code || err?.code;
    if (code === 409) {
      console.error("[Bot] ❌ 409 Conflict: Another instance is still running. Please check other deployments or wait.");
      isBotStarted = false; // Allow retry if needed
    } else {
      console.error("[Bot] Failed to launch bot:", err);
    }
  }

  // Graceful stop handlers
  process.once("SIGINT", () => {
    bot.stop("SIGINT");
    isBotStarted = false;
  });
  process.once("SIGTERM", () => {
    bot.stop("SIGTERM");
    isBotStarted = false;
  });
}
