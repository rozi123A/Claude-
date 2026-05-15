import { useEffect, useState, useRef } from "react";

const MONETAG_DIRECT_LINK = "https://omg10.com/4/11009678";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

export default function AdOverlay({ seconds = 15, rewardLabel = "المكافأة", onClaim, onClose }: AdOverlayProps) {
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

  // Open ad in Telegram In-App Browser
  const handleWatchInTelegram = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(MONETAG_DIRECT_LINK, { try_instant_view: false });
    } else {
      window.open(MONETAG_DIRECT_LINK, "_blank");
    }
    setWatchedInTg(true);

    // When user returns to app, mark as viewed
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisible);
        visibilityRef.current = null;
        // Fast-forward countdown to 0 since user watched
        setTimeLeft(0);
        if (timerRef.current) clearInterval(timerRef.current!);
      }
    };
    visibilityRef.current = onVisible;
    document.addEventListener("visibilitychange", onVisible);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
      background: "#1a1f2e",
      overflow: "hidden",
    }}>
      {/* Background pattern */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.6' opacity='0.07'%3E%3Ccircle cx='20' cy='20' r='8'/%3E%3Cpath d='M16 17 Q20 12 24 17'/%3E%3Ccircle cx='18' cy='19' r='1.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='22' cy='19' r='1.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='60' cy='50' r='6'/%3E%3Cpath d='M57 48 Q60 44 63 48'/%3E%3Ccircle cx='58' cy='49' r='1.2' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='62' cy='49' r='1.2' fill='%23fff' opacity='0.3'/%3E%3Crect x='35' y='8' width='12' height='8' rx='4'/%3E%3Cpath d='M38 12 h6'/%3E%3Crect x='5' y='55' width='10' height='7' rx='3'/%3E%3Cpath d='M7 59 h6'/%3E%3Ccircle cx='70' cy='15' r='5'/%3E%3Cpath d='M67 13 Q70 9 73 13'/%3E%3C/g%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "80px 80px",
      }} />

      {/* Countdown bubble */}
      <div style={{
        marginTop: 28,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 30, padding: "6px 22px",
        fontWeight: 900, fontSize: 20, color: "#fff",
        letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        zIndex: 1,
      }}>
        {timeLeft === 0 ? "✅ اكتمل" : `${mm}:${ss}`}
      </div>

      {/* Card */}
      <div style={{
        marginTop: 18,
        width: "calc(100% - 28px)", maxWidth: 420,
        background: "#1c2235",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        overflow: "hidden",
        zIndex: 1,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#ef4444,#b91c1c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900, color: "#fff",
            boxShadow: "0 2px 12px rgba(239,68,68,0.4)",
          }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                هل أنت إنسان؟
              </p>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Ad</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.4 }}>
              تأكد من هويتك للمتابعة
            </p>
          </div>
        </div>

        {/* Ad iframe area */}
        <div style={{
          margin: "0 14px",
          height: 180,
          borderRadius: 12,
          background: "#141827",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          position: "relative",
        }}>
          {!iframeLoaded && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, zIndex: 2, background: "#141827",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.15)",
                borderTopColor: "rgba(255,255,255,0.6)",
                animation: "adSpin 1s linear infinite",
              }} />
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>جاري تحميل الإعلان...</p>
            </div>
          )}
          {watchedInTg && timeLeft === 0 && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 3,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "rgba(20,24,39,0.95)", gap: 8,
            }}>
              <div style={{ fontSize: 44 }}>✅</div>
              <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 14, margin: 0 }}>شاهدت الإعلان بنجاح!</p>
            </div>
          )}
          <iframe
            src={MONETAG_DIRECT_LINK}
            style={{
              width: "100%", height: "100%",
              border: "none", display: "block",
              opacity: iframeLoaded ? 1 : 0,
              transition: "opacity 0.3s",
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setIframeLoaded(true)}
            title="ad"
          />
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            ads by Monetag
          </p>

          {/* Watch in Telegram button */}
          {!watchedInTg && (
            <button
              onClick={handleWatchInTelegram}
              style={{
                width: "100%", height: 46, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#0088cc,#006aaa)",
                color: "#fff",
                fontWeight: 700, fontSize: 14,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 3px 16px rgba(0,136,204,0.4)",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 18 }}>✈️</span>
              شاهد الإعلان في Telegram
            </button>
          )}

          {/* Claim button */}
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            style={{
              width: "100%", height: 50, borderRadius: 12, border: "none",
              background: canClaim
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : "rgba(255,255,255,0.07)",
              color: canClaim ? "#fff" : "rgba(255,255,255,0.25)",
              fontWeight: 900, fontSize: 15,
              cursor: canClaim ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.3s",
              boxShadow: canClaim ? "0 4px 20px rgba(22,163,74,0.45)" : "none",
            }}
          >
            {canClaim ? (
              <>✓ انقر للحصول على المكافأة! {rewardLabel && `(${rewardLabel})`}</>
            ) : (
              <>⏳ انتظر {mm}:{ss}</>
            )}
          </button>

          {/* Continue button */}
          <button
            onClick={onClose}
            style={{
              width: "100%", height: 46, borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#1e40af,#1d4ed8)",
              color: "#fff",
              fontWeight: 700, fontSize: 15,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 12px rgba(29,78,216,0.3)",
            }}
          >
            استمر
          </button>
        </div>
      </div>

      <style>{`
        @keyframes adSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
