import { Telegraf, Markup } from "telegraf";
import type { Express } from "express";
import { getTelegramUser, upsertTelegramUser } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL;
// Public URL where this server is reachable from the internet (for webhook)
// On Render: set RENDER_EXTERNAL_URL is auto-injected, fall back to WEBHOOK_URL or PUBLIC_URL
const PUBLIC_URL =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.RENDER_EXTERNAL_URL;

export async function startBot(app?: Express) {
  if (!BOT_TOKEN) {
    console.warn("[Bot] BOT_TOKEN is not set. Bot will not start.");
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "";
    const lastName = ctx.from.last_name || "";

    console.log(`[Bot] New user started bot: ${telegramId} (@${username})`);

    try {
      // Check if user exists, if not create them
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

  // Delete webhook first to reduce chance of conflict, but tolerate failures
  try {
    console.log("[Bot] Attempting to delete webhook (if any)...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    // brief pause to let Telegram process deletion
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err) {
    console.warn("[Bot] deleteWebhook failed or no webhook present:", err?.message || err);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && PUBLIC_URL && app) {
    // Use webhook mode in production when PUBLIC_URL is set
    const secretPath = `/telegraf/${bot.secretPathComponent()}`;
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}${secretPath}`;

    // Attach express webhook handler so incoming requests are processed
    try {
      app.use(bot.webhookCallback(secretPath));
    } catch (e) {
      console.warn("[Bot] Failed to attach webhook callback to express app:", e);
    }

    try {
      await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
      console.log(`[Bot] ✅ Webhook set to: ${webhookUrl}`);
    } catch (err) {
      console.error("[Bot] Failed to set webhook:", err);
    }
    return;
  }

  // Fallback to long polling mode (dev or when PUBLIC_URL missing)
  if (isProduction) {
    console.warn(
      "[Bot] ⚠️ Running in LONG POLLING in production because PUBLIC_URL/RENDER_EXTERNAL_URL is not set. " +
        "Set RENDER_EXTERNAL_URL or PUBLIC_URL to enable webhook mode (recommended)."
    );
  }

  // Before starting polling, check Telegram webhook info to avoid 409
  try {
    const info = await bot.telegram.getWebhookInfo();
    const existing = (info as any)?.url || "";
    if (existing) {
      console.warn(`[Bot] Webhook already set on Telegram: ${existing}. Skipping long polling to avoid 409 conflict.`);
      return;
    }
  } catch (err) {
    console.warn("[Bot] getWebhookInfo failed, proceeding to long polling. Error:", err?.message || err);
  }

  console.log("[Bot] Starting in long polling mode...");
  try {
    await bot.launch();
    console.log("[Bot] ✅ Telegram bot launched (long polling)");
  } catch (err: any) {
    // Detect 409 conflict (another getUpdates or webhook active)
    const code = err?.response?.error_code || err?.code;
    const desc = err?.response?.description || err?.description || String(err || "");
    if (code === 409 || String(desc).includes("getUpdates")) {
      console.error("[Bot] Failed to start Telegram bot due to 409 conflict: another getUpdates/webhook is active. Skipping polling.", err);
      return;
    }
    console.error("[Bot] Failed to start Telegram bot:", err);
  }

  // Graceful stop handlers
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
