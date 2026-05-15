import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "./AdOverlay";

interface DailyGiftBoxProps {
  telegramId: number;
  initData: string;
  lang: Language;
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

export default function DailyGiftBox({ telegramId, initData, lang, onClaim }: DailyGiftBoxProps) {
  const [nextClaim, setNextClaim] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(LS_KEY(telegramId)) || "0"); } catch { return 0; }
  });
  const [timeLeft,      setTimeLeft]      = useState(() => getTimeLeft(nextClaim));
  const [isOpening,     setIsOpening]     = useState(false);
  const [reward,        setReward]        = useState(0);
  const [showReward,    setShowReward]    = useState(false);
  const [isHovered,     setIsHovered]     = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [adWatched,     setAdWatched]     = useState(false);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast }     = useToast();
  const t             = translations[lang];
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
    if (!adWatched) {
      setShowAdOverlay(true);
    } else {
      handleClaim();
    }
  };

  const handleAdClaim = async () => {
    setAdWatched(true);
  };

  const handleAdClose = () => {
    setShowAdOverlay(false);
    if (adWatched) {
      handleClaim();
    }
  };

  const handleClaim = async () => {
    if (!canClaim || isOpening) return;
    setIsOpening(true);
    try {
      const result = await claimMutation.mutateAsync({ telegramId, initData });
      if (result.success && result.reward) {
        setReward(result.reward);
        setShowReward(true);
        setAdWatched(false);
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
          rewardLabel="هدية يومية 🎁"
          onClaim={handleAdClaim}
          onClose={handleAdClose}
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
              <div style={{ width: "100%", height: 9, background: canClaim ? "linear-gradient(90deg,#fbbf24,#f59e0b)" : "linear-gradient(90deg,#6b7280,#4b5563)", borderRadius: 3 }} />
              {canClaim && (
                <div style={{ position: "absolute", top: -14, display: "flex", gap: 1 }}>
                  <div style={{ width: 16, height: 12, background: "linear-gradient(135deg,#fde68a,#fbbf24)", borderRadius: "50% 50% 0 0", transform: "rotate(-28deg)", boxShadow: "0 2px 5px rgba(251,191,36,0.5)" }} />
                  <div style={{ width: 16, height: 12, background: "linear-gradient(135deg,#fde68a,#fbbf24)", borderRadius: "50% 50% 0 0", transform: "rotate(28deg)", boxShadow: "0 2px 5px rgba(251,191,36,0.5)" }} />
                </div>
              )}
            </div>
            {/* Sparkles */}
            {canClaim && (
              <>
                <div style={{ position: "absolute", top: 36, left: 28, fontSize: 13, animation: "giftFloat1 2s ease-in-out infinite", pointerEvents: "none" }}>✨</div>
                <div style={{ position: "absolute", top: 52, left: 78, fontSize: 11, animation: "giftFloat2 2.5s ease-in-out infinite", pointerEvents: "none" }}>⭐</div>
              </>
            )}
          </div>

          {/* Reward popup */}
          {showReward && (
            <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 26, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 18px rgba(251,191,36,0.9)", animation: "giftRewardPop 0.5s ease-out forwards", whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none" }}>
              +{reward} PTS
            </div>
          )}
        </div>

        {/* Label */}
        <div className="text-center">
          {canClaim ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-black text-yellow-400" style={{ animation: "giftPulse 1.5s ease-in-out infinite" }}>
                {t.daily_gift_ready}
              </p>
              <p className="text-[10px] text-gray-500">شاهد إعلاناً للحصول على الهدية</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-gray-500 font-bold">{t.daily_gift_next}</p>
              <p className="text-sm font-black text-purple-400">{fmt(timeLeft)}</p>
            </>
          )}
        </div>

        <style>{`
          @keyframes giftPulse  { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
          @keyframes giftFloat1 { 0%,100%{transform:translateY(0)rotate(0deg)} 50%{transform:translateY(-7px)rotate(18deg)} }
          @keyframes giftFloat2 { 0%,100%{transform:translateY(0)rotate(0deg)} 50%{transform:translateY(-9px)rotate(-15deg)} }
          @keyframes giftRewardPop { 0%{opacity:0;transform:translate(-50%,-50%)scale(.4)} 55%{opacity:1;transform:translate(-50%,-90%)scale(1.25)} 100%{opacity:0;transform:translate(-50%,-140%)scale(1)} }
        `}</style>
      </div>
    </>
  );
}
