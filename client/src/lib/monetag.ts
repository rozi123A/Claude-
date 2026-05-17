// Interstitial ad — zone 11003103 (al5sm.com)
// Call showMonetagAd() at key moments to trigger the interstitial popup.
export function showMonetagAd(): void {
  try {
    // The ad script exposes a global function named show_ZONEID once loaded
    const fn = (window as any)["show_11003103"];
    if (typeof fn === "function") {
      fn();
      return;
    }
    // Fallback: inject the script again to force the popup
    const s = document.createElement("script");
    s.dataset.zone = "11003103";
    s.src = "https://al5sm.com/tag.min.js";
    document.body.appendChild(s);
  } catch {}
}
