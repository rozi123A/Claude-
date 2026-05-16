import { useEffect, useState, useRef } from "react";

  interface AdOverlayProps {
    seconds?: number;
    rewardLabel?: string;
    onClaim: () => void;
    onClose: () => void;
  }

  export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
    const [timeLeft, setTimeLeft] = useState(seconds);
    const [claimed, setClaimed]   = useState(false);
    const [adOpened, setAdOpened] = useState(false);
    const [returned, setReturned] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const visRef   = useRef<(() => void) | null>(null);

    useEffect(() => {
      const tg  = (window as any).Telegram?.WebApp;
      const adUrl = `${window.location.origin}/ad-view`;

      if (tg?.openLink) {
        tg.openLink(adUrl, { try_instant_view: false });
      } else {
        window.open(adUrl, "_blank");
      }
      setAdOpened(true);

      const onVisible = () => {
        if (document.visibilityState === "visible") {
          setReturned(true);
          document.removeEventListener("visibilitychange", onVisible);
          visRef.current = null;
        }
      };
      visRef.current = onVisible;
      document.addEventListener("visibilitychange", onVisible);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (visRef.current) document.removeEventListener("visibilitychange", visRef.current);
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

    const handleReopen = () => {
      const tg = (window as any).Telegram?.WebApp;
      const adUrl = `${window.location.origin}/ad-view`;
      if (tg?.openLink) {
        tg.openLink(adUrl, { try_instant_view: false });
      } else {
        window.open(adUrl, "_blank");
      }
    };

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center",
        background: "linear-gradient(170deg,#0d1420 0%,#131c35 100%)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
        overflow: "hidden",
      }}>

        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(16,185,129,0.06)", pointerEvents: "none" }} />

        <div style={{
          marginTop: 36,
          background: timeLeft === 0
            ? "linear-gradient(135deg,rgba(22,163,74,0.9),rgba(21,128,61,0.9))"
            : "rgba(255,255,255,0.07)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${timeLeft === 0 ? "rgba(74,222,128,0.5)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 50, padding: "10px 32px",
          fontWeight: 900, fontSize: 26, color: "#fff",
          letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums",
          boxShadow: timeLeft === 0 ? "0 0 30px rgba(22,163,74,0.5)" : "0 2px 20px rgba(0,0,0,0.4)",
          transition: "all 0.4s",
        }}>
          {timeLeft === 0 ? "✅ جاهز!" : `${mm}:${ss}`}
        </div>

        <div style={{
          marginTop: 20,
          width: "calc(100% - 28px)", maxWidth: 420,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24, overflow: "hidden",
          boxShadow: "0 16px 60px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            padding: "20px 20px 16px",
            background: adOpened
              ? "linear-gradient(135deg,rgba(14,165,233,0.12),rgba(99,102,241,0.08))"
              : "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
              background: adOpened ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              boxShadow: adOpened ? "0 4px 16px rgba(14,165,233,0.4)" : "none",
            }}>
              {adOpened ? "✈️" : "📺"}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 17, fontWeight: 900, color: "#fff", margin: 0 }}>
                {adOpened ? "الإعلان مفتوح في Telegram" : "جاري تحميل الإعلان..."}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0", lineHeight: 1.4 }}>
                {returned ? "عدت بنجاح — انتظر انتهاء العداد" : "شاهد الإعلان كاملاً ثم ارجع هنا"}
              </p>
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", alignSelf: "flex-start", marginTop: 2 }}>Ad</span>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "1️⃣", text: "الإعلان يفتح في متصفح Telegram", done: adOpened },
              { icon: "2️⃣", text: "شاهد الإعلان كاملاً",              done: returned },
              { icon: "3️⃣", text: "ارجع هنا واستلم مكافأتك",         done: canClaim },
            ].map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: step.done ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.done ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)"}`,
                borderRadius: 12, padding: "10px 14px", transition: "all 0.3s",
              }}>
                <span style={{ fontSize: 18 }}>{step.done ? "✅" : step.icon}</span>
                <span style={{ fontSize: 13, fontWeight: step.done ? 700 : 400,
                  color: step.done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>

          {adOpened && !canClaim && (
            <div style={{ padding: "0 20px 16px" }}>
              <button onClick={handleReopen} style={{
                width: "100%", height: 44, borderRadius: 12,
                border: "1px solid rgba(14,165,233,0.3)",
                background: "rgba(14,165,233,0.08)", color: "rgba(14,165,233,0.9)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                ✈️ إعادة فتح الإعلان في Telegram
              </button>
            </div>
          )}

          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.18)", margin: 0 }}>
              ads by Monetag
            </p>

            <button onClick={handleClaim} disabled={!canClaim} style={{
              width: "100%", height: 58, borderRadius: 16, border: "none",
              background: canClaim ? "linear-gradient(135deg,#16a34a,#15803d)" : "rgba(255,255,255,0.05)",
              color: canClaim ? "#fff" : "rgba(255,255,255,0.18)",
              fontWeight: 900, fontSize: 18,
              cursor: canClaim ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.3s",
              boxShadow: canClaim ? "0 4px 28px rgba(22,163,74,0.6)" : "none",
              animation: canClaim ? "claimPulse 1.2s ease-in-out infinite" : "none",
            }}>
              {canClaim
                ? <><span style={{ fontSize: 22 }}>🎁</span> انقر للحصول على المكافأة!{rewardLabel ? ` (${rewardLabel})` : ""}</>
                : <><span>⏳</span> انتظر {mm}:{ss}</>}
            </button>

            <button onClick={onClose} style={{
              width: "100%", height: 46, borderRadius: 14, border: "none",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.35)",
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>
              استمر بدون مكافأة
            </button>
          </div>
        </div>

        <style>{`
          @keyframes claimPulse {
            0%,100% { box-shadow: 0 4px 28px rgba(22,163,74,0.6); }
            50%      { box-shadow: 0 4px 40px rgba(22,163,74,0.9), 0 0 0 8px rgba(22,163,74,0.12); }
          }
        `}</style>
      </div>
    );
  }
  