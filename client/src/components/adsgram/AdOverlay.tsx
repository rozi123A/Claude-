import { useEffect, useState, useRef } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

function triggerMonetagAd() {
  const fn = (window as any)["show_10996226"];
  if (typeof fn === "function") { try { fn(); } catch {} }
}

export default function AdOverlay({ seconds = 15, rewardLabel = "المكافأة", onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [claimed,  setClaimed]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Trigger real Monetag ad in background for impression
    triggerMonetagAd();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
      background: "#1a1f2e",
      overflow: "hidden",
    }}>
      {/* Telegram cat-pattern background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.6' opacity='0.07'%3E%3Ccircle cx='20' cy='20' r='8'/%3E%3Cpath d='M16 17 Q20 12 24 17'/%3E%3Ccircle cx='18' cy='19' r='1.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='22' cy='19' r='1.5' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='60' cy='50' r='6'/%3E%3Cpath d='M57 48 Q60 44 63 48'/%3E%3Ccircle cx='58' cy='49' r='1.2' fill='%23fff' opacity='0.3'/%3E%3Ccircle cx='62' cy='49' r='1.2' fill='%23fff' opacity='0.3'/%3E%3Crect x='35' y='8' width='12' height='8' rx='4'/%3E%3Cpath d='M38 12 h6'/%3E%3Crect x='5' y='55' width='10' height='7' rx='3'/%3E%3Cpath d='M7 59 h6'/%3E%3Ccircle cx='70' cy='15' r='5'/%3E%3Cpath d='M67 13 Q70 9 73 13'/%3E%3C/g%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "80px 80px",
      }} />

      {/* Top countdown bubble */}
      <div style={{
        marginTop: 28, marginBottom: 0,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 30, padding: "6px 22px",
        fontWeight: 900, fontSize: 20, color: "#fff",
        letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
        zIndex: 1,
      }}>
        {mm}:{ss}
      </div>

      {/* Main content card */}
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
        {/* Header row */}
        <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#ef4444,#b91c1c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 900,
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

        {/* Ad content area */}
        <div style={{
          margin: "0 14px",
          height: 200,
          borderRadius: 12,
          background: "#141827",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.08'%3E%3Ccircle cx='15' cy='15' r='6'/%3E%3Cpath d='M12 13 Q15 9 18 13'/%3E%3Ccircle cx='13.5' cy='14' r='1' fill='%23fff'/%3E%3Ccircle cx='16.5' cy='14' r='1' fill='%23fff'/%3E%3Ccircle cx='45' cy='40' r='5'/%3E%3Cpath d='M42 38 Q45 34 48 38'/%3E%3Ccircle cx='43.5' cy='39' r='1' fill='%23fff'/%3E%3Ccircle cx='46.5' cy='39' r='1' fill='%23fff'/%3E%3Crect x='28' y='5' width='8' height='6' rx='3'/%3E%3Cpath d='M30 8 h4'/%3E%3Ccircle cx='50' cy='10' r='4'/%3E%3Cpath d='M47 8 Q50 5 53 8'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "60px 60px",
          }} />

          {timeLeft > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.15)",
                borderTopColor: "rgba(255,255,255,0.6)",
                animation: "adSpin 1s linear infinite",
              }} />
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, margin: 0 }}>جاري تحميل الإعلان...</p>
            </div>
          )}
          {timeLeft === 0 && (
            <div style={{ zIndex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 700, margin: "8px 0 0" }}>اكتمل الإعلان!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0 }}>
            ads by Monetag
          </p>

          <button
            onClick={handleClaim}
            disabled={!canClaim}
            style={{
              width: "100%", height: 50, borderRadius: 12, border: "none",
              background: canClaim
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : "rgba(255,255,255,0.07)",
              color: canClaim ? "#fff" : "rgba(255,255,255,0.2)",
              fontWeight: 900, fontSize: 15,
              cursor: canClaim ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.3s",
              boxShadow: canClaim ? "0 4px 20px rgba(22,163,74,0.45)" : "none",
            }}
          >
            {canClaim ? (
              <>
                <span style={{ fontSize: 16 }}>✓</span>
                انقر للحصول على المكافأة! {rewardLabel && `(${rewardLabel})`}
              </>
            ) : (
              <>⏳ انتظر {mm}:{ss}</>
            )}
          </button>

          <button
            onClick={onClose}
            style={{
              width: "100%", height: 50, borderRadius: 12, border: "none",
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
