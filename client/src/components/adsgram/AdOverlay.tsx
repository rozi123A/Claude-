import { useEffect, useState, useRef } from "react";

const MONETAG_DIRECT_LINK = "https://omg10.com/4/11009678";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [claimed, setClaimed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [watchedInTg, setWatchedInTg] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibilityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current!);
      if (visibilityRef.current) document.removeEventListener("visibilitychange", visibilityRef.current);
    };
  }, []);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const canClaim = timeLeft === 0 && !claimed;

  const handleClaim = () => {
    if (!canClaim) return;
    setClaimed(true);
    onClaim();
    setTimeout(() => onClose(), 400);
  };

  const handleWatchInTelegram = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(MONETAG_DIRECT_LINK, { try_instant_view: false });
    } else {
      window.open(MONETAG_DIRECT_LINK, "_blank");
    }
    setWatchedInTg(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisible);
        visibilityRef.current = null;
        setTimeLeft(0);
        if (timerRef.current) clearInterval(timerRef.current!);
      }
    };
    visibilityRef.current = onVisible;
    document.addEventListener("visibilitychange", onVisible);
  };

  const CAT_SVG = encodeURIComponent(`<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.07"><circle cx="20" cy="20" r="8"/><path d="M16 17 Q20 12 24 17"/><circle cx="17" cy="19" r="1.5" fill="#fff"/><circle cx="23" cy="19" r="1.5" fill="#fff"/><line x1="12" y1="20" x2="8" y2="18"/><line x1="28" y1="20" x2="32" y2="18"/><circle cx="60" cy="55" r="6"/><path d="M57 52 Q60 48 63 52"/><circle cx="58" cy="54" r="1.2" fill="#fff"/><circle cx="62" cy="54" r="1.2" fill="#fff"/></g></svg>`);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
      background: "#1a2035", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,${CAT_SVG}")`,
        backgroundRepeat: "repeat", backgroundSize: "80px 80px",
      }} />

      {/* Countdown pill */}
      <div style={{
        marginTop: 32, zIndex: 1,
        background: "rgba(10,15,35,0.85)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 40, padding: "7px 26px",
        fontWeight: 900, fontSize: 21, color: "#fff",
        letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums",
        boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
        minWidth: 90, textAlign: "center",
      }}>
        {timeLeft === 0 ? "✅" : `${mm}:${ss}`}
      </div>

      {/* Card */}
      <div style={{
        marginTop: 16,
        width: "calc(100% - 24px)", maxWidth: 430,
        background: "#1c2438",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20, overflow: "hidden", zIndex: 1,
        boxShadow: "0 12px 50px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#dc2626,#991b1b)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 900, color: "#fff",
            boxShadow: "0 3px 14px rgba(220,38,38,0.45)",
          }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p style={{ fontSize: 19, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.25 }}>هل أنت إنسان؟</p>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>Ad</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "5px 0 0", lineHeight: 1.5 }}>تأكد من هويتك للمتابعة</p>
          </div>
        </div>

        {/* Ad iframe */}
        <div style={{
          margin: "0 14px", height: 180, borderRadius: 14,
          background: "#141a2c", border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden", position: "relative",
        }}>
          {!iframeLoaded && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 2, background: "#141a2c",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.12)",
                borderTopColor: "rgba(255,255,255,0.65)",
                animation: "adSpin 1s linear infinite",
              }} />
              <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, margin: 0 }}>جاري تحميل الإعلان...</p>
            </div>
          )}
          {watchedInTg && timeLeft === 0 && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 3,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "rgba(20,26,44,0.96)", gap: 8,
            }}>
              <div style={{ fontSize: 44 }}>✅</div>
              <p style={{ color: "#4ade80", fontWeight: 800, fontSize: 14, margin: 0 }}>شاهدت الإعلان بنجاح!</p>
            </div>
          )}
          <iframe
            src={MONETAG_DIRECT_LINK}
            style={{ width: "100%", height: "100%", border: "none", display: "block", opacity: iframeLoaded ? 1 : 0, transition: "opacity 0.3s" }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setIframeLoaded(true)}
            title="ad"
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.22)", margin: 0 }}>ads by Monetag</p>

          {/* Watch in Telegram button */}
          {!watchedInTg && (
            <button onClick={handleWatchInTelegram} style={{
              width: "100%", height: 46, borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#0088cc,#006aaa)", color: "#fff",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 3px 16px rgba(0,136,204,0.4)",
            }}>
              <span style={{ fontSize: 18 }}>✈️</span> شاهد الإعلان في Telegram
            </button>
          )}

          {/* Claim button */}
          <button onClick={handleClaim} disabled={!canClaim} style={{
            width: "100%", height: 52, borderRadius: 14, border: "none",
            background: canClaim ? "linear-gradient(135deg,#16a34a,#15803d)" : "rgba(255,255,255,0.06)",
            color: canClaim ? "#fff" : "rgba(255,255,255,0.18)",
            fontWeight: 900, fontSize: 16, cursor: canClaim ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.3s",
            boxShadow: canClaim ? "0 4px 22px rgba(22,163,74,0.5)" : "none",
          }}>
            {canClaim
              ? <><span style={{ fontSize: 18 }}>✓</span> انقر للحصول على المكافأة!{rewardLabel ? ` (${rewardLabel})` : ""}</>
              : <>⏳ انتظر {mm}:{ss}</>
            }
          </button>

          {/* Continue button */}
          <button onClick={onClose} style={{
            width: "100%", height: 52, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg,#1d4ed8,#1e40af)",
            color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer",
            boxShadow: "0 3px 14px rgba(29,78,216,0.35)",
          }}>
            استمر
          </button>
        </div>
      </div>
      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
