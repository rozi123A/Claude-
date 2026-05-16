import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "@/components/adsgram/AdOverlay";

interface DailyGiftBoxProps {
  telegramId: number;
  initData: string;
  lang: Language;
  adsgramBlockId: string;
  onClaim: (update: { balance: number; totalEarned: number }) => void;
}

const LS_KEY = (id: number) => `daily_gift_next_${id}`;

function getTimeLeft(nextClaim: number): number {
  const diff = nextClaim - Date.now();
  return diff > 0 ? diff : 0;
}
function fmt(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DailyGiftBox({ telegramId, initData, lang, adsgramBlockId, onClaim }: DailyGiftBoxProps) {
  const [nextClaim, setNextClaim] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(LS_KEY(telegramId)) || "0"); } catch { return 0; }
  });
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(nextClaim));
  const [isOpening, setIsOpening] = useState(false);
  const [reward, setReward] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const t = translations[lang];
  const claimMutation = trpc.dailyGift.claim.useMutation();

  const canClaim = timeLeft === 0;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) { clearInterval(intervalRef.current!); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [nextClaim]);

  const handleBoxClick = () => {
    if (!canClaim || isOpening) return;
    setShowAdOverlay(true);
  };

  const handleAdClaim = async () => {
    setIsOpening(true);
    try {
      const result = await claimMutation.mutateAsync({ telegramId, initData });
      if (result.success && result.reward) {
        setReward(result.reward);
        setShowReward(true);
        const next = result.nextClaim ?? Date.now() + 24 * 60 * 60 * 1000;
        setNextClaim(next);
        setTimeLeft(getTimeLeft(next));
        try { localStorage.setItem(LS_KEY(telegramId), String(next)); } catch {}
        onClaim({ balance: Number(result.balance ?? 0), totalEarned: Number(result.totalEarned ?? 0) });
        setTimeout(() => setShowReward(false), 2500);
      } else {
        if (result.nextClaim) {
          const next = result.nextClaim as number;
          setNextClaim(next);
          setTimeLeft(getTimeLeft(next));
          try { localStorage.setItem(LS_KEY(telegramId), String(next)); } catch {}
        }
        toast({ title: t.daily_gift_wait, variant: "destructive" });
      }
    } catch {
      toast({ title: t.daily_gift_error, variant: "destructive" });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <>
      {showAdOverlay && (
        <AdOverlay
          seconds={15}
          rewardLabel={t.daily_gift_title}
          onClaim={handleAdClaim}
          onClose={() => setShowAdOverlay(false)}
        />
      )}

      <div className="flex flex-col items-center gap-3">
        {/* 3D Gift Box */}
        <div
          onClick={handleBoxClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ width: 130, height: 130, perspective: "500px", cursor: canClaim ? "pointer" : "default", userSelect: "none", position: "relative" }}
        >
          {canClaim && (
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(circle, rgba(250,204,21,0.3) 0%, transparent 70%)",
              borderRadius: "50%",
              animation: "giftPulse 2s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}

          <div style={{
            width: "100%", height: "100%",
            transformStyle: "preserve-3d",
            transform: isOpening
              ? "rotateY(720deg) rotateX(20deg) scale(1.15)"
              : isHovered && canClaim
              ? "rotateX(12deg) rotateY(-18deg) scale(1.08)"
              : "rotateX(10deg) rotateY(-10deg)",
            transition: isOpening ? "transform 0.7s cubic-bezier(0.68,-0.55,0.27,1.55)" : "transform 0.3s ease",
          }}>
            {/* Box body */}
            <div style={{
              position: "absolute", width: 84, height: 84, left: 23, top: 32,
              background: canClaim ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "linear-gradient(135deg,#374151,#1f2937)",
              border: canClaim ? "2px solid #a78bfa" : "2px solid #4b5563",
              borderRadius: 10,
              boxShadow: canClaim ? "0 10px 30px rgba(124,58,237,0.55),inset 0 1px 0 rgba(255,255,255,0.15)" : "0 4px 14px rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                position: "absolute", width: 9, height: "100%",
                background: canClaim ? "linear-gradient(180deg,#fbbf24,#f59e0b)" : "linear-gradient(180deg,#6b7280,#4b5563)",
                top: 0, left: "calc(50% - 4.5px)", borderRadius: 3,
              }} />
            </div>
            {/* Box lid */}
            <div style={{
              position: "absolute", width: 92, height: 24, left: 19, top: isOpening ? 2 : 22,
              background: canClaim ? "linear-gradient(135deg,#9333ea,#6d28d9)" : "linear-gradient(135deg,#4b5563,#374151)",
              border: canClaim ? "2px solid #c084fc" : "2px solid #6b7280",
              borderRadius: 7,
              boxShadow: canClaim ? "0 4px 14px rgba(147,51,234,0.5)" : "0 2px 8px rgba(0,0,0,0.3)",
              transition: "top 0.4s ease",
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible",
            }}>
              {/* Bow */}
              {canClaim && (
                <div style={{ position: "absolute", top: -14, display: "flex", gap: 4, alignItems: "center" }}>
                  <div style={{ width: 20, height: 16, borderRadius: "50% 50% 50% 0", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", transform: "rotate(-20deg)" }} />
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fcd34d", boxShadow: "0 0 8px rgba(251,191,36,0.6)" }} />
                  <div style={{ width: 20, height: 16, borderRadius: "50% 50% 0 50%", background: "linear-gradient(135deg,#fbbf24,#f59e0b)", transform: "rotate(20deg)" }} />
                </div>
              )}
            </div>

            {/* Stars */}
            {canClaim && (
              <>
                {[{ top: 5, left: 8, size: 10, delay: "0s" }, { top: 20, left: 95, size: 8, delay: "0.3s" }, { top: 60, left: 3, size: 6, delay: "0.6s" }, { top: 85, left: 90, size: 10, delay: "0.9s" }].map((s, i) => (
                  <div key={i} style={{ position: "absolute", top: s.top, left: s.left, fontSize: s.size, animation: `starFloat 2.5s ease-in-out ${s.delay} infinite`, pointerEvents: "none" }}>⭐</div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Reward flash */}
        {showReward && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ background: "rgba(0,0,0,0.85)", borderRadius: 28, padding: "28px 40px", textAlign: "center", border: "2px solid rgba(250,204,21,0.5)", boxShadow: "0 0 60px rgba(250,204,21,0.3)", animation: "rewardPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <div style={{ fontSize: 52, marginBottom: 10 }}>🎁</div>
              <p style={{ fontSize: 28, fontWeight: 900, color: "#FDE68A", margin: 0 }}>+{reward.toLocaleString()}</p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>{t.points}</p>
            </div>
          </div>
        )}

        {/* Timer */}
        <div style={{ textAlign: "center" }}>
          {canClaim ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{t.daily_gift_ready || "الهدية جاهزة!"}</span>
              <div style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", borderRadius: 14, padding: "8px 20px", cursor: "pointer", border: "1px solid rgba(167,139,250,0.4)" }} onClick={handleBoxClick}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>🎁 {t.open_gift || "افتح الهدية"}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{t.daily_gift_wait || "الهدية القادمة في"}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#C4B5FD", fontVariantNumeric: "tabular-nums" }}>{fmt(timeLeft)}</span>
            </div>
          )}
        </div>

        <style>{`
          @keyframes giftPulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.3);opacity:0.7} }
          @keyframes starFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.2)} }
          @keyframes rewardPop { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        `}</style>
      </div>
    </>
  );
}
