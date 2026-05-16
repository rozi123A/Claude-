import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { exec } from "child_process";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { getDb, initDb } from "../db";
import { startBot } from "../bot";
import { migrate } from "drizzle-orm/mysql2/migrator";
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

// Monetag service worker content
const MONETAG_SW = `self.options = {
    "domain": "3nbf4.com",
    "zoneId": 10996226
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')`;

async function startServer() {
  await initDb();

  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Monetag verification & service worker ──
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.send(MONETAG_SW);
  });


    // ── Ad view page — served inside Telegram's built-in browser ──
    const AD_VIEW_HTML = `<!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <title>مشاهدة الإعلان</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#0d1117;color:#fff;font-family:'Segoe UI',sans-serif;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           min-height:100vh;padding:24px;text-align:center}
      .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
            border-radius:20px;padding:28px 20px;max-width:380px;width:100%}
      h2{font-size:18px;font-weight:800;margin-bottom:8px;color:#fff}
      p{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;margin-bottom:20px}
      .badge{display:inline-block;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);
             color:#34d399;border-radius:50px;padding:6px 18px;font-size:12px;font-weight:700;margin-bottom:20px}
      .back-btn{display:inline-block;margin-top:24px;padding:14px 32px;border-radius:14px;
                background:linear-gradient(135deg,#10b981,#059669);color:#fff;
                font-weight:800;font-size:15px;text-decoration:none;border:none;cursor:pointer;width:100%}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">📺 ads by Monetag</div>
      <h2>شاهد الإعلان واربح النقاط</h2>
      <p>الإعلان يعرض أدناه — شاهده كاملاً ثم اضغط "عدت" للحصول على مكافأتك</p>

      <!-- Monetag Interstitial Zone -->
      <script async data-cfasync="false" src="//alwingulla.com/88/tag.min.js" data-zone="10996226" data-type="1"></script>

      <script>
        // Auto-trigger the interstitial once the script loads
        window.addEventListener('load', function() {
          if (typeof show_10996226 === 'function') {
            show_10996226();
          }
        });
      </script>

      <button class="back-btn" onclick="window.close(); history.back();">
        ✅ عدت — استلم مكافأتك
      </button>
    </div>
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
