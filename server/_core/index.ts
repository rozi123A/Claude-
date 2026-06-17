import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { getDb, initDb } from "../db";
import { startBot } from "../bot";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── Keep-Alive: prevents Render free-tier sleep (pings every 14 min) ──
function startKeepAlive(baseUrl: string) {
  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
  const pingUrl = `${baseUrl.replace(/\/$/, "")}/ping`;

  const ping = async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(pingUrl, { signal: controller.signal });
      clearTimeout(timer);
      console.log(`[KeepAlive] ✓ Ping OK — ${new Date().toISOString()} (${res.status})`);
    } catch (err: any) {
      console.warn(`[KeepAlive] ✗ Ping failed — ${err?.message}`);
    }
  };

  // First ping after 1 minute, then every 14 minutes
  setTimeout(() => {
    ping();
    setInterval(ping, INTERVAL_MS);
  }, 60_000);

  console.log(`[KeepAlive] Started — pinging ${pingUrl} every 14 min`);
}

async function runMigrations() {
  try {
    const { getPool } = await import("../db");
    const pool = await getPool();
    if (!pool) return;
    await pool.query(`
      ALTER TABLE telegram_users
        ADD COLUMN IF NOT EXISTS last_ip VARCHAR(100),
        ADD COLUMN IF NOT EXISTS device_info TEXT,
        ADD COLUMN IF NOT EXISTS ban_reason TEXT,
        ADD COLUMN IF NOT EXISTS cheat_strikes INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_login_date VARCHAR(10),
        ADD COLUMN IF NOT EXISTS badges TEXT
    `);
    console.log("[Migration] ✅ columns verified");
  } catch (err: any) {
    console.warn("[Migration] ⚠️", err?.message);
  }
}

async function startServer() {
  await initDb();
  await runMigrations();

  const app = express();
  const server = createServer(app);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://telegram.org",
          "https://*.telegram.org",
          "https://libtl.com",
          "https://*.libtl.com",
          "https://n6wxm.com",
          "https://*.monetag.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://telegram.org",
          "https://*.telegram.org",
          "https://api.telegram.org",
          "https://libtl.com",
          "https://*.libtl.com",
          "https:",
        ],
        frameSrc: ["'self'", "https://telegram.org", "https://*.telegram.org", "https://libtl.com", "https://*.libtl.com", "https://*.monetag.com", "https:"],
      },
    },
  }));

  // CORS — allow configured frontend origin
  app.use(cors({
    origin: process.env.FRONTEND_URL || process.env.WEBAPP_URL || "http://localhost:3000",
    credentials: true,
  }));

  // Body parser — 2mb limit to prevent DoS attacks
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  // Trust Render's reverse proxy so we get real client IPs from x-forwarded-for
  app.set("trust proxy", 1);

  // Rate Limiting — use real IP from x-forwarded-for (not proxy IP)
  const getRealIp = (req: any): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
  };

  // Global: 600 req/15min per real IP (generous for active users)
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRealIp,
    message: { error: "Too many requests, please try again later." },
    skip: (req) => req.path === "/ping" || req.path === "/healthz",
  }));

  // Stricter rate limit for admin endpoints — 100 req/15min per real IP
  app.use("/api/trpc/admin", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRealIp,
    message: { error: "Too many admin requests." },
  }));

  // ── /ping — health check + keep-alive target ──
  app.get("/ping", (_req, res) => {
    res.status(200).json({
      status: "alive",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
    });
  });

  // ── /healthz — alias for uptime monitors ──
  app.get("/healthz", (_req, res) => res.status(200).send("OK"));

  // ── /api/adsgram/reward — Adsgram server-to-server reward callback ──
  // Adsgram calls this URL after ad is watched: /api/adsgram/reward?userId={userId}
  app.get("/api/adsgram/reward", async (req, res) => {
    const userId = req.query.userId as string;
    const blockId = req.query.blockId as string | undefined;
    console.log(`[Adsgram] Reward callback — userId:${userId} blockId:${blockId}`);

    if (!userId || isNaN(Number(userId))) {
      console.warn("[Adsgram] Reward callback: missing or invalid userId");
      return res.status(400).json({ success: false, message: "Missing userId" });
    }

    try {
      // Import DB helpers dynamically to avoid circular deps
      const { upsertTelegramUser, getTelegramUser, createTransaction } = await import("../storage");
      const telegramId = Number(userId);
      const user = await getTelegramUser(telegramId);
      if (!user) {
        console.warn(`[Adsgram] Reward callback: user ${telegramId} not found`);
        return res.status(200).json({ success: true, message: "ok" }); // always 200 to Adsgram
      }

      const reward = Number((await import("./../_core/env")).ENV.adReward || 10);
      const currentBalance = Number(user.balance) || 0;
      await upsertTelegramUser({ telegramId, balance: currentBalance + reward });
      await createTransaction({ telegramId, type: "ad", points: reward, metadata: JSON.stringify({ source: "adsgram_callback", blockId }) });
      console.log(`[Adsgram] ✅ Reward ${reward} pts given to userId:${telegramId}`);
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[Adsgram] Reward callback error:", err?.message);
      return res.status(200).json({ success: true }); // always 200 to Adsgram
    }
  });

    // ── Ad view page ──
    const monetagZone = process.env.MONETAG_ZONE_ID || "11043107";
    const monetagScript = process.env.MONETAG_SCRIPT_URL || "https://n6wxm.com/vignette.min.js";
    const AD_IFRAME_CONTENT = encodeURIComponent(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent}</style>
</head><body>
<script>(function(s){s.dataset.zone='${monetagZone}',s.src='${monetagScript}'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))<\/script>
<script>
window.addEventListener('load',function(){
  var fn=window['show_${monetagZone}'];
  if(typeof fn==='function') fn();
});
<\/script>
</body></html>`);

    const AD_VIEW_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>مشاهدة الإعلان</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#0d1117;color:#fff;font-family:'Segoe UI',sans-serif}
    body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
    #ad-frame{
      width:100%;flex:1;border:none;
      min-height:calc(100vh - 60px);
      display:block;background:transparent;
    }
    .back-btn{
      width:100%;height:60px;border:none;
      background:linear-gradient(135deg,#10b981,#059669);
      color:#fff;font-weight:800;font-size:17px;
      cursor:pointer;letter-spacing:0.02em;flex-shrink:0;
    }
  </style>
</head>
<body>
  <iframe
    id="ad-frame"
    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
    src="data:text/html,${AD_IFRAME_CONTENT}"
    scrolling="no"
  ></iframe>
  <button class="back-btn" onclick="try{window.close();}catch(e){} try{history.back();}catch(e){}">
    ✅ انقر للحصول على المكافأة — عدت
  </button>
</body>
</html>`;

    app.get("/ad-view", (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.send(AD_VIEW_HTML);
    });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start Telegram Bot
    startBot(app).catch(err => console.error("[Bot] Error starting bot:", err));

    // Start Keep-Alive self-ping (production only)
    const appUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.WEBAPP_URL ||
      process.env.FRONTEND_URL ||
      "";
    if (appUrl && process.env.NODE_ENV === "production") {
      startKeepAlive(appUrl);
    } else if (process.env.NODE_ENV !== "production") {
      console.log("[KeepAlive] Skipped in development mode");
    } else {
      console.warn("[KeepAlive] No app URL found — set RENDER_EXTERNAL_URL env var");
    }
  });
}

startServer().catch(console.error);
