import { useEffect, useState, useRef } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [claimed, setClaimed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fn = (window as any)["show_10996226"];
    if (typeof fn === "function") { try { fn(); } catch {} }

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

  const CAT_SVG = encodeURIComponent(`<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.07"><circle cx="20" cy="20" r="8"/><path d="M16 17 Q20 12 24 17"/><circle cx="17" cy="19" r="1.5" fill="#fff"/><circle cx="23" cy="19" r="1.5" fill="#fff"/><line x1="12" y1="20" x2="8" y2="18"/><line x1="12" y1="21" x2="8" y2="23"/><line x1="28" y1="20" x2="32" y2="18"/><line x1="28" y1="21" x2="32" y2="23"/><circle cx="60" cy="55" r="6"/><path d="M57 52 Q60 48 63 52"/><circle cx="58" cy="54" r="1.2" fill="#fff"/><circle cx="62" cy="54" r="1.2" fill="#fff"/><rect x="35" y="8" width="12" height="8" rx="4"/><path d="M38 12 h6"/><rect x="5" y="55" width="10" height="7" rx="3"/><path d="M7 59 h6"/><circle cx="70" cy="15" r="5"/><path d="M67 13 Q70 9 73 13"/><circle cx="68.5" cy="14" r="1" fill="#fff"/><circle cx="71.5" cy="14" r="1" fill="#fff"/><circle cx="15" cy="65" r="4"/><path d="M13 63 Q15 60 17 63"/><path d="M55" cy="20" r="3"/><circle cx="55" cy="20" r="3"/><path d="M53 18 Q55 16 57 18"/><path d="M40" cy="70" r="5"/><circle cx="40" cy="70" r="5"/><path d="M37 68 Q40 64 43 68"/></g></svg>`);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
      background: "#1a2035",
      overflow: "hidden",
    }}>
      {/* Cat pattern background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,${CAT_SVG}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "80px 80px",
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

      {/* Main card */}
      <div style={{
        marginTop: 16,
        width: "calc(100% - 24px)", maxWidth: 430,
        background: "#1c2438",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 20, overflow: "hidden", zIndex: 1,
        boxShadow: "0 12px 50px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header: ! icon + text + Ad label */}
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
              <p style={{ fontSize: 19, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.25 }}>
                هل أنت إنسان؟
              </p>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>Ad</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "5px 0 0", lineHeight: 1.5 }}>
              تأكد من هويتك للمتابعة
            </p>
          </div>
        </div>

        {/* Ad display area with cat pattern */}
        <div style={{
          margin: "0 14px",
          height: 210,
          borderRadius: 14,
          background: "#141a2c",
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Inner pattern */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url("data:image/svg+xml,${CAT_SVG}")`,
            backgroundRepeat: "repeat", backgroundSize: "70px 70px",
            opacity: 0.6,
          }} />

          {/* Loading state */}
          {timeLeft > 0 && (
            <div style={{ zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.12)",
                borderTopColor: "rgba(255,255,255,0.65)",
                animation: "adSpin 1s linear infinite",
              }} />
              <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, margin: 0 }}>
                جاري تحميل الإعلان...
              </p>
            </div>
          )}

          {/* Done state */}
          {timeLeft === 0 && (
            <div style={{ zIndex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 800, margin: 0 }}>
                اكتمل الإعلان!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.22)", margin: 0 }}>
            ads by Monetag
          </p>

          {/* Green reward button */}
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            style={{
              width: "100%", height: 52, borderRadius: 14, border: "none",
              background: canClaim
                ? "linear-gradient(135deg,#16a34a,#15803d)"
                : "rgba(255,255,255,0.06)",
              color: canClaim ? "#fff" : "rgba(255,255,255,0.18)",
              fontWeight: 900, fontSize: 16,
              cursor: canClaim ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.3s",
              boxShadow: canClaim ? "0 4px 22px rgba(22,163,74,0.5)" : "none",
            }}
          >
            {canClaim ? (
              <>
                <span style={{ fontSize: 18 }}>∨</span>
                انقر للحصول على المكافأة!{rewardLabel ? ` (${rewardLabel})` : ""}
              </>
            ) : (
              <>⏳ انتظر {mm}:{ss}</>
            )}
          </button>

          {/* Blue continue button */}
          <button
            onClick={onClose}
            style={{
              width: "100%", height: 52, borderRadius: 14, border: "none",
              background: "linear-gradient(135deg,#1d4ed8,#1e40af)",
              color: "#fff", fontWeight: 700, fontSize: 16,
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: "0 3px 14px rgba(29,78,216,0.35)",
            }}
          >
            استمر
          </button>
        </div>
      </div>

      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
