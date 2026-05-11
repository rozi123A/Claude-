import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { translations, type Language } from "@/lib/i18n";

interface DailyGiftBoxProps {
  telegramId: number;
  lastDailyGift: string | null;
  lang: Language;
  onClaim: (update: { balance: number; totalEarned: number; lastDailyGift: string }) => void;
}

function getTimeLeft(lastGift: string | null): number {
  if (!lastGift) return 0;
  const last = new Date(lastGift).getTime();
  const now = Date.now();
  const diff = 24 * 60 * 60 * 1000 - (now - last);
  return diff > 0 ? diff : 0;
}

function formatTimeLeft(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DailyGiftBox({ telegramId, lastDailyGift, lang, onClaim }: DailyGiftBoxProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(lastDailyGift));
  const [isOpening, setIsOpening] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [reward, setReward] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();
  const t = translations[lang];
  const canClaim = timeLeft === 0;

  const claimMutation = trpc.dailyGift.claim.useMutation();

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1000;
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleClaim = async () => {
    if (!canClaim || isOpening) return;
    setIsOpening(true);

    try {
      let initData = "";
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        initData = window.Telegram.WebApp.initData || "";
      }
      const result = await claimMutation.mutateAsync({ telegramId, initData });
      if (result.success && result.reward) {
        setReward(result.reward);
        setShowReward(true);
        setTimeLeft(24 * 60 * 60 * 1000);
        onClaim({
          balance: result.balance!,
          totalEarned: result.totalEarned!,
          lastDailyGift: new Date().toISOString(),
        });
        setTimeout(() => setShowReward(false), 3000);
      } else {
        toast({ title: t.daily_gift_wait, variant: "destructive" });
      }
    } catch {
      toast({ title: t.daily_gift_error, variant: "destructive" });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* 3D Box Scene */}
      <div
        className="relative cursor-pointer select-none"
        style={{ width: 120, height: 120, perspective: "400px" }}
        onClick={handleClaim}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Glow ring */}
        {canClaim && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(250,204,21,0.35) 0%, transparent 70%)",
              animation: "pulse 2s ease-in-out infinite",
              top: "10%", left: "10%", right: "10%", bottom: "10%",
            }}
          />
        )}

        {/* Box wrapper with 3D transform */}
        <div
          style={{
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: isOpening
              ? "rotateX(15deg) rotateY(360deg) scale(1.1)"
              : isHovered && canClaim
              ? "rotateX(10deg) rotateY(-15deg) scale(1.08)"
              : "rotateX(10deg) rotateY(-10deg)",
            transition: isOpening
              ? "transform 0.6s cubic-bezier(0.68,-0.55,0.27,1.55)"
              : "transform 0.3s ease",
          }}
        >
          {/* Box bottom face */}
          <div
            style={{
              position: "absolute",
              width: "80px",
              height: "80px",
              left: "20px",
              top: "30px",
              background: canClaim
                ? "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
                : "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
              border: canClaim ? "2px solid #a78bfa" : "2px solid #4b5563",
              borderRadius: "8px",
              boxShadow: canClaim
                ? "0 8px 24px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)"
                : "0 4px 12px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Ribbon vertical */}
            <div style={{
              position: "absolute",
              width: "8px",
              height: "100%",
              background: canClaim
                ? "linear-gradient(180deg, #fbbf24, #f59e0b)"
                : "linear-gradient(180deg, #6b7280, #4b5563)",
              top: 0, left: "calc(50% - 4px)",
              borderRadius: "2px",
            }} />
          </div>

          {/* Box lid */}
          <div
            style={{
              position: "absolute",
              width: "88px",
              height: "22px",
              left: "16px",
              top: isOpening ? "0px" : "20px",
              background: canClaim
                ? "linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)"
                : "linear-gradient(135deg, #4b5563 0%, #374151 100%)",
              border: canClaim ? "2px solid #c084fc" : "2px solid #6b7280",
              borderRadius: "6px",
              boxShadow: canClaim
                ? "0 4px 12px rgba(147,51,234,0.5)"
                : "0 2px 6px rgba(0,0,0,0.3)",
              transition: "top 0.4s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Ribbon horizontal on lid */}
            <div style={{
              width: "100%",
              height: "8px",
              background: canClaim
                ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                : "linear-gradient(90deg, #6b7280, #4b5563)",
              borderRadius: "2px",
            }} />
            {/* Bow */}
            {canClaim && (
              <div style={{
                position: "absolute",
                top: "-10px",
                display: "flex",
                gap: "2px",
              }}>
                <div style={{
                  width: "14px", height: "10px",
                  background: "linear-gradient(135deg, #fde68a, #fbbf24)",
                  borderRadius: "50% 50% 0 0",
                  transform: "rotate(-30deg)",
                  boxShadow: "0 2px 4px rgba(251,191,36,0.5)",
                }} />
                <div style={{
                  width: "14px", height: "10px",
                  background: "linear-gradient(135deg, #fde68a, #fbbf24)",
                  borderRadius: "50% 50% 0 0",
                  transform: "rotate(30deg)",
                  boxShadow: "0 2px 4px rgba(251,191,36,0.5)",
                }} />
              </div>
            )}
          </div>

          {/* Stars inside box (visible when available) */}
          {canClaim && (
            <>
              <div style={{
                position: "absolute", top: "35px", left: "25px",
                fontSize: "12px", animation: "float1 2s ease-in-out infinite",
              }}>✨</div>
              <div style={{
                position: "absolute", top: "50px", left: "75px",
                fontSize: "10px", animation: "float2 2.4s ease-in-out infinite",
              }}>⭐</div>
            </>
          )}
        </div>

        {/* Reward burst */}
        {showReward && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "28px",
            fontWeight: "900",
            color: "#fbbf24",
            textShadow: "0 0 20px rgba(251,191,36,0.8)",
            animation: "rewardPop 0.5s ease-out",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}>
            +{reward} PTS
          </div>
        )}
      </div>

      {/* Label */}
      <div className="mt-3 text-center">
        {canClaim ? (
          <div>
            <p className="text-xs font-black text-yellow-400 animate-pulse">{t.daily_gift_ready}</p>
            <p className="text-[10px] text-gray-400">{t.daily_gift_tap}</p>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-bold text-gray-400">{t.daily_gift_next}</p>
            <p className="text-sm font-black text-purple-400">{formatTimeLeft(timeLeft)}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(20deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-15deg); }
        }
        @keyframes rewardPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          60% { transform: translate(-50%, -80%) scale(1.3); opacity: 1; }
          100% { transform: translate(-50%, -120%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
