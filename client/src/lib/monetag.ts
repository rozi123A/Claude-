// Monetag interstitial — zone 10996226
// Call this function at key moments to display a Monetag ad.
export function showMonetagAd(): void {
  try {
    // Monetag creates a global function named show_ZONEID when their script loads
    const fn = (window as any)["show_10996226"];
    if (typeof fn === "function") {
      fn();
      return;
    }
    // Fallback: create a temporary hidden link and click it to trigger popunder
    const a = document.createElement("a");
    a.href = "https://alwingulla.com/88/tag.min.js";
    a.style.display = "none";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 1000);
  } catch {}
}