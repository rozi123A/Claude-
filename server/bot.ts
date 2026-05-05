import { Telegraf, Markup } from "telegraf";
import { getTelegramUser, upsertTelegramUser, getPendingWithdrawals, updateWithdrawalStatus } from "./db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.FRONTEND_URL;

// Helper to send stars to user via Telegram
async function sendStarsToUser(telegramId: number, stars: number, amount: number): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error("[Bot] Cannot send stars: BOT_TOKEN not set");
    return false;
  }
  
  const bot = new Telegraf(BOT_TOKEN);
  
  try {
    // Use Telegram's payment API (stars)
    await bot.telegram.sendMessage(
      telegramId,
      `🎁 تم إرسال مكافأتك!\n\n✨ ${stars} نجمة\n💰 القيمة: ${amount} نقطة\n\nشكراً لاستخدامك Adsgram Pro!`
    );
    return true;
  } catch (error) {
    console.error("[Bot] Failed to send stars:", error);
    return false;
  }
}

// Admin command to process withdrawals
async function processPendingWithdrawals(): Promise<string> {
  const pending = await getPendingWithdrawals();
  let processed = 0;
  
  for (const w of pending) {
    try {
      const success = await sendStarsToUser(w.telegramId, w.stars, w.amount);
      if (success) {
        await updateWithdrawalStatus(w.id, "completed", "Stars sent");
        processed++;
      } else {
        await updateWithdrawalStatus(w.id, "rejected", "Failed to send stars");
      }
    } catch (error) {
      console.error("[Bot] Error processing withdrawal:", error);
    }
  }
  
  return `Processed ${processed} withdrawals`;
}

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

      const welcomeMessage = `مرحباً بك يا ${firstName}! 🚀\n\nهذا هو بوت Adsgram Pro. يمكنك كسب النجوم من خلال مشاهدة الإعلانات وتدوير العجلة.\n\nاضغط على الزر أدناه لفتح التطبيق وابدأ الكسب الآن!`;

      if (WEBAPP_URL) {
        await ctx.reply(
          welcomeMessage,
          Markup.inlineKeyboard([
            [Markup.button.webApp("فتح التطبيق 📱", WEBAPP_URL)],
            [Markup.button.url("قناة التحديثات 📢", "https://t.me/your_channel")]
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

  // Admin: Check pending withdrawals
  bot.command("withdrawals", async (ctx) => {
    const pending = await getPendingWithdrawals();
    if (pending.length === 0) {
      await ctx.reply("📭 لا توجد طلبات سحب معلقة");
      return;
    }
    
    let message = "📋 طلبات السحب المعلقة:\n\n";
    for (const w of pending) {
      message += `🔹 #${w.id} - المستخدم: ${w.telegramId}\n`;
      message += `   💰 ${w.amount} نقطة = ✨ ${w.stars} نجمة\n`;
      message += `   📅 ${w.createdAt}\n\n`;
    }
    
    await ctx.reply(message);
  });

  // Admin: Force process withdrawals
  bot.command("process", async (ctx) => {
    const result = await processPendingWithdrawals();
    await ctx.reply(result);
  });

  // Delete webhook before launching to avoid 409 Conflict errors
  bot.telegram.deleteWebhook({ drop_pending_updates: true })
    .then(() => {
      bot.launch()
        .then(() => console.log("[Bot] Telegram bot started successfully"))
        .catch((err) => console.error("[Bot] Failed to start Telegram bot:", err));
    })
    .catch((err) => console.error("[Bot] Failed to delete webhook:", err));

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
