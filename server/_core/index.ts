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
    // The ad script runs inside a sandboxed iframe (no allow-top-navigation)
    // so intent:// / market:// redirects are blocked by the browser itself —
    // they cannot reach or crash the parent page.
    const AD_IFRAME_CONTENT = encodeURIComponent(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent}</style>
</head><body>
<script>(function(s){s.dataset.zone='11003103',s.src='https://al5sm.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')))<\/script>
<script>
window.addEventListener('load',function(){
  var fn=window['show_11003103'];
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
    /* Ad iframe fills most of the screen */
    #ad-frame{
      width:100%;flex:1;border:none;
      min-height:calc(100vh - 80px);
      display:block;background:transparent;
    }
    .back-btn{
      width:100%;height:56px;border:none;
      background:linear-gradient(135deg,#10b981,#059669);
      color:#fff;font-weight:800;font-size:16px;
      cursor:pointer;letter-spacing:0.02em;
      flex-shrink:0;
    }
  </style>
</head>
<body>
  <!-- sandbox: no allow-top-navigation → intent:// links are silently blocked -->
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
  });
}

startServer().catch(console.error);
