import { useEffect, useState, useRef } from "react";

const MONETAG_ZONE_ID = 10996226;

interface AdOverlayProps {
  seconds?: number;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

function loadMonetag(zoneId: number): Promise<void> {
  return new Promise((resolve) => {
    const existingScript = document.getElementById("monetag-sdk");
    if (existingScript) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "monetag-sdk";
    s.async = true;
    s.src = `https://vemtoutcheeg.com/400/${zoneId}`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    (document.head || document.body).appendChild(s);
  });
}

function tryShowAd(zoneId: number) {
  try {
    const fnName = `show_${zoneId}`;
    if (typeof (window as any)[fnName] === "function") {
      (window as any)[fnName]();
      return true;
    }
  } catch {}
  return false;
}

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft]   = useState(seconds);
  const [claimed, setClaimed]     = useState(false);
  const [adReady, setAdReady]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load Monetag SDK & show ad immediately when overlay mounts
  useEffect(() => {
    let retries = 0;
    const attemptShow = () => {
      if (tryShowAd(MONETAG_ZONE_ID)) { setAdReady(true); return; }
      retries++;
      if (retries < 10) setTimeout(attemptShow, 300);
    };

    loadMonetag(MONETAG_ZONE_ID).then(() => {
      setTimeout(attemptShow, 300);
    });

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "rgba(15,20,40,0.97)",
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>

      {/* Timer pill — top center, always visible above Monetag overlay */}
      <div style={{
        marginTop: 28, zIndex: 9998,
        background: timeLeft === 0 ? "rgba(22,163,74,0.9)" : "rgba(10,15,35,0.95)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${timeLeft === 0 ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.15)"}`,
        borderRadius: 40, padding: "8px 28px",
        fontWeight: 900, fontSize: 22, color: "#fff",
        letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums",
        boxShadow: "0 2px 20px rgba(0,0,0,0.6)",
        minWidth: 100, textAlign: "center",
        transition: "all 0.3s",
        position: "relative",
      }}>
        {timeLeft === 0 ? "✅ جاهز" : `${mm}:${ss}`}
      </div>

      {/* Ad container — Monetag will inject into this area */}
      <div style={{
        marginTop: 14,
        width: "calc(100% - 24px)", maxWidth: 430,
        minHeight: 200,
        borderRadius: 20, overflow: "hidden",
        background: "#161d30",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 9001,
      }}>
        {!adReady && (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{
              width: 44, height: 44, margin: "0 auto 12px",
              borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "rgba(255,255,255,0.7)",
              animation: "adSpin 0.9s linear infinite",
            }} />
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>
              جاري تحميل الإعلان...
            </p>
          </div>
        )}
        {adReady && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📺</div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: 0 }}>
              الإعلان يُعرض الآن
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 6 }}>
              ads by Monetag
            </p>
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div style={{
        width: "calc(100% - 24px)", maxWidth: 430,
        marginTop: 12, display: "flex", flexDirection: "column", gap: 10,
        position: "relative", zIndex: 9998,
      }}>
        {/* Claim button */}
        <button
          onClick={handleClaim}
          disabled={!canClaim}
          style={{
            width: "100%", height: 56, borderRadius: 16, border: "none",
            background: canClaim
              ? "linear-gradient(135deg,#16a34a,#15803d)"
              : "rgba(255,255,255,0.06)",
            color: canClaim ? "#fff" : "rgba(255,255,255,0.2)",
            fontWeight: 900, fontSize: 17,
            cursor: canClaim ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.3s",
            boxShadow: canClaim ? "0 4px 24px rgba(22,163,74,0.55)" : "none",
            animation: canClaim ? "claimPulse 1.2s ease-in-out infinite" : "none",
          }}
        >
          {canClaim ? (
            <><span style={{ fontSize: 20 }}>✓</span>
            انقر للحصول على المكافأة!{rewardLabel ? ` (${rewardLabel})` : ""}</>
          ) : (
            <>⏳ انتظر {mm}:{ss}</>
          )}
        </button>

        {/* Continue/skip button */}
        <button
          onClick={onClose}
          style={{
            width: "100%", height: 48, borderRadius: 14, border: "none",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.5)",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          استمر بدون مكافأة
        </button>
      </div>

      <style>{`
        @keyframes adSpin { to { transform: rotate(360deg); } }
        @keyframes claimPulse {
          0%,100% { box-shadow: 0 4px 24px rgba(22,163,74,0.55); }
          50% { box-shadow: 0 4px 36px rgba(22,163,74,0.85), 0 0 0 6px rgba(22,163,74,0.15); }
        }
      `}</style>
    </div>
  );
}
