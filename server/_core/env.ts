export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  botToken: process.env.BOT_TOKEN ?? "",
  adsgramBlockId: (() => {
    const raw = process.env.ADSGRAM_BLOCK_ID ?? "";
    const cleaned = raw.replace(/[^0-9]/g, "");
    // Must be a valid numeric ID of at least 4 digits; fall back to default
    if (cleaned.length >= 4) return cleaned;
    return "29281";
  })(),
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : null,
};
