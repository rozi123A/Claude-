// Interstitial ad — zone 11003103 (al5sm.com)
// Script is injected ON DEMAND only — never on page load — to avoid
// ERR_UNKNOWN_URL_SCHEME crashing Telegram WebView on startup.

let scriptInjected = false;

function injectAdScript(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptInjected) { resolve(); return; }
    const s = document.createElement("script");
    s.dataset.zone = "11003103";
    s.src = "https://al5sm.com/tag.min.js";
    s.onload = () => { scriptInjected = true; resolve(); };
    s.onerror = () => { resolve(); }; // resolve anyway so caller isn't stuck
    document.body.appendChild(s);
  });
}

export async function showMonetagAd(): Promise<void> {
  try {
    await injectAdScript();
    // Small delay to let the script initialise its global
    await new Promise(r => setTimeout(r, 300));
    const fn = (window as any)["show_11003103"];
    if (typeof fn === "function") fn();
  } catch {}
}
