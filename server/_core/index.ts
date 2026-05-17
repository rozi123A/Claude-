import "dotenv/config";
import express from "express";
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

async function startServer() {
  await initDb();

  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // ── Ad view page — Monetag OnClick Popunder runs directly on the page ──
    // The script must NOT be inside an iframe/sandbox — popunders require
    // direct page context to work correctly without triggering CAPTCHA.
    const AD_VIEW_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <title>مشاهدة الإعلان</title>

  <!-- Monetag OnClick Popunder — on the page directly, never inside an iframe -->
  <script>(function(s){s.dataset.zone='11003103',s.src='https://al5sm.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))<\/script>

  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#0d1117;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px}
    .icon{font-size:64px;margin-bottom:16px}
    h2{font-size:20px;font-weight:700;margin-bottom:8px;color:#10b981}
    p{font-size:14px;color:#9ca3af;margin-bottom:32px;line-height:1.6}
    .back-btn{
      width:100%;max-width:320px;height:56px;border:none;border-radius:14px;
      background:linear-gradient(135deg,#10b981,#059669);
      color:#fff;font-weight:800;font-size:17px;
      cursor:pointer;letter-spacing:0.02em;
      box-shadow:0 4px 20px rgba(16,185,129,0.4);
    }
    .back-btn:active{transform:scale(0.97)}
  </style>
</head>
<body>
  <div class="icon">📺</div>
  <h2>شاهد الإعلان للحصول على نقاطك</h2>
  <p>سيفتح الإعلان تلقائياً عند النقر على الزر.<br/>بعد مشاهدة الإعلان اضغط "عدت" للحصول على مكافأتك.</p>
  <button class="back-btn" onclick="try{window.close();}catch(e){} try{history.back();}catch(e){}">
    ✅ عدت — استلم مكافأتك
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
  });
}

startServer().catch(console.error);
