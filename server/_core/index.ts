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
    <!-- Block non-http(s) URL schemes BEFORE any ad script loads -->
    <!-- Telegram WebView crashes on intent://, market://, fb://, etc. -->
    <script>
      (function() {
        // 1. Intercept all link clicks — block unknown URL schemes
        document.addEventListener('click', function(e) {
          var el = e.target;
          while (el && el.tagName !== 'A') el = el.parentElement;
          if (el && el.href) {
            var h = el.href;
            if (!/^https?:\/\//i.test(h) && !/^#/.test(h) && h !== 'javascript:void(0)') {
              e.preventDefault(); e.stopImmediatePropagation(); return false;
            }
          }
        }, true);

        // 2. Intercept window.open to block non-http(s) URLs
        var _open = window.open;
        window.open = function(url, target, features) {
          if (url && typeof url === 'string' && !/^https?:\/\//i.test(url)) return null;
          return _open.call(window, url, target, features);
        };

        // 3. Intercept location.assign / location.replace / location.href
        var _assign  = window.location.assign.bind(window.location);
        var _replace = window.location.replace.bind(window.location);
        try {
          Object.defineProperty(window.location, 'assign',  { value: function(u) { if (/^https?:\/\//i.test(u)) _assign(u);  }, configurable: true });
          Object.defineProperty(window.location, 'replace', { value: function(u) { if (/^https?:\/\//i.test(u)) _replace(u); }, configurable: true });
        } catch(e) {}

        // 4. Catch any unhandled navigation errors silently
        window.addEventListener('error', function(e) { e.preventDefault(); }, true);
        window.addEventListener('unhandledrejection', function(e) { e.preventDefault(); }, true);
      })();
    </script>

    <div class="card">
      <div class="badge">📺 إعلان</div>
      <h2>شاهد الإعلان واربح النقاط</h2>
      <p>الإعلان يعرض أدناه — شاهده كاملاً ثم اضغط "عدت" للحصول على مكافأتك</p>

      <!-- Interstitial Ad — zone 11003103 (injected after URL-scheme guard) -->
      <script>(function(s){s.dataset.zone='11003103',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>

      <script>
        window.addEventListener('load', function() {
          var fn = window['show_11003103'];
          if (typeof fn === 'function') fn();
        });
      </script>

      <button class="back-btn" onclick="try{window.close();}catch(e){} try{history.back();}catch(e){}">
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
