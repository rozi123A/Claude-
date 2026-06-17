import { useEffect, useRef, useState } from "react";

interface AdOverlayProps {
  onClaim: () => void;
  onClose: () => void;
  lang?: string;
  monetagZoneId?: string;
  monetagScriptUrl?: string;
  telegramId?: number;
  seconds?: number;
  rewardLabel?: string;
}

export default function AdOverlay({
  onClaim,
  onClose,
  lang,
  monetagZoneId,
}: AdOverlayProps) {
  const ran = useRef(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let closed = false;

    // Try zone ID from props first, then fall back to 11127757
    const zoneId = monetagZoneId || "11127757";
    const fnName = `show_${zoneId}`;

    function tryShow(attempts: number) {
      const showFn = (window as any)[fnName];

      if (typeof showFn === "function") {
        // Hide our loader so Monetag ad shows freely
        setShowLoader(false);
        showFn()
          .then(() => {
            if (!closed) { closed = true; onClaim(); }
          })
          .catch(() => {
            if (!closed) { closed = true; onClose(); }
          });
      } else if (attempts > 0) {
        setTimeout(() => tryShow(attempts - 1), 300);
      } else {
        if (!closed) { closed = true; onClose(); }
      }
    }

    tryShow(40);
  }, []);

  if (!showLoader) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(6,6,16,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          border: "4px solid rgba(255,255,255,0.15)",
          borderTop: "4px solid #a78bfa",
          borderRadius: "50%",
          animation: "adspin 0.9s linear infinite",
        }}
      />
      <style>{`@keyframes adspin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>
        {lang === "ar" ? "جاري تحميل الإعلان..." : "Loading ad..."}
      </p>
      <p style={{ fontSize: 13, color: "#a78bfa", margin: 0 }}>+10 نقطة</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, textAlign: "center", padding: "0 24px" }}>
        {lang === "ar"
          ? "شاهد الإعلان بالكامل للحصول على مكافأتك"
          : "Watch the full ad to earn your reward"}
      </p>
    </div>
  );
}
