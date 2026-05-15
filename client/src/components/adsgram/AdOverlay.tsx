import { useEffect, useState, useRef } from "react";

interface AdOverlayProps {
  blockId: string;
  rewardLabel?: string;
  onClaim: () => void;
  onClose: () => void;
}

export default function AdOverlay({ blockId, rewardLabel = "المكافأة", onClaim, onClose }: AdOverlayProps) {
  const [status, setStatus] = useState<"loading" | "showing" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const AdController = (window as any).Adsgram?.init({ blockId });

    if (!AdController) {
      setStatus("error");
      setErrorMsg("تعذر تحميل الإعلان. تأكد من اتصالك بالإنترنت.");
      return;
    }

    setStatus("showing");

    AdController.show()
      .then(() => {
        setStatus("done");
        onClaim();
        setTimeout(() => onClose(), 400);
      })
      .catch((err: any) => {
        if (err?.description === "Adblock") {
          setStatus("error");
          setErrorMsg("يبدو أن لديك أداة حظر إعلانات. يرجى إيقافها للمتابعة.");
        } else if (err?.description === "no fill") {
          setStatus("error");
          setErrorMsg("لا توجد إعلانات متاحة حالياً. حاول مرة أخرى بعد قليل.");
        } else {
          setStatus("error");
          setErrorMsg("حدث خطأ أثناء عرض الإعلان. حاول مرة أخرى.");
        }
      });
  }, []);

  if (status === "showing") return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(7,7,17,0.95)",
      padding: 24,
    }}>
      {status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "4px solid rgba(139,92,246,0.2)",
            borderTopColor: "#8B5CF6",
            animation: "adSpin 1s linear infinite",
          }} />
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 700 }}>جاري تحميل الإعلان...</p>
        </div>
      )}

      {status === "done" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 800 }}>أحسنت! تم منح المكافأة</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6 }}>{rewardLabel}</p>
        </div>
      )}

      {status === "error" && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: 24, maxWidth: 340, width: "100%", textAlign: "center"
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
          <p style={{ color: "#FCA5A5", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>تعذر عرض الإعلان</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.6, marginBottom: 20 }}>{errorMsg}</p>
          <button
            onClick={onClose}
            style={{
              width: "100%", height: 46, borderRadius: 14, border: "none",
              background: "rgba(139,92,246,0.2)",
              color: "#A78BFA", fontWeight: 800, fontSize: 14, cursor: "pointer"
            }}
          >
            رجوع
          </button>
        </div>
      )}

      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
