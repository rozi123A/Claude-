import "dotenv/config";
import { Telegraf } from "telegraf";

const BOT_TOKEN = process.env.BOT_TOKEN;

async function cleanup() {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing in .env");
    return;
  }

  const bot = new Telegraf(BOT_TOKEN);

  try {
    console.log("Cleaning up Telegram Bot state...");
    
    // 1. Delete Webhook
    console.log("Deleting webhook...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    
    // 2. Log status
    const info = await bot.telegram.getWebhookInfo();
    console.log("Webhook info:", info);
    
    const me = await bot.telegram.getMe();
    console.log(`Bot @${me.username} is now clean and ready for a single instance.`);
    
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanup();
