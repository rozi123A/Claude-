import { Telegraf, Markup } from "telegraf";
import { getTelegramUser, upsertTelegramUser } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL;

export async function startBot() {
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

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\n🎮 العب الآن واربح النقاط!\n🚀 كلما لعبت أكثر ربحت أكثر.\n💰 اجمع النقاط يومياً.\n🏆 تحدَّ نفسك واربح المكافآت.\n\nاضغط على الزر أدناه لفتح التطبيق وابدأ الكسب الآن!`;

      if (WEBAPP_URL) {
        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.webApp("فتح التطبيق 📱", WEBAPP_URL)],
            [Markup.button.url("قناة التحديثات 📢", "https://t.me/ads_reward123")]
          ])
        );
      } else {
        await ctx.reply(welcomeMessage + "\n\n(ملاحظة: WEBAPP_URL غير مهيأ حالياً)");
      }
    } catch (error) {
      console.error("[Bot] Error in start command:", error);
      await ctx.reply("حدث خطأ أثناء تهيئة حسابك. يرجى المحاولة لاحقاً.");
    }
  });

  bot.help((ctx) => {
    ctx.reply("استخدم الزر 'فتح التطبيق' للوصول إلى واجهة الكسب الخاصة بك.");
  });

  // Delete webhook and drop pending updates to avoid 409 Conflict errors
  try {
    console.log("[Bot] Attempting to delete webhook...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    // Wait for 2 seconds to ensure Telegram processes the deletion
    await new Promise(resolve => setTimeout(resolve, 2000));

    await bot.launch({
      polling: {
        allowedUpdates: [],
        dropPendingUpdates: true,
      }
    });
    console.log("[Bot] Telegram bot started successfully");
  } catch (err: any) {
    console.error("[Bot] Failed to start Telegram bot:", err);
    // If it's a conflict, wait longer and retry
    if (err.response?.error_code === 409) {
      console.log("[Bot] Conflict detected (409), retrying in 10 seconds...");
      setTimeout(() => startBot(), 10000);
    } else {
      // Retry for other errors too to ensure uptime
      setTimeout(() => startBot(), 15000);
    }
  }

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
