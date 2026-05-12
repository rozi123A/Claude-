import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Tv2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

interface UserData {
  telegramId: number;
  balance: number;
  spinsLeft: number;
  adsgramBlockId: string;
}

interface SpinWheelSectionProps {
  user: UserData;
  lang: Language;
  onReward: (update?: { balance: number; spinsLeft: number; totalEarned?: number }) => void;
  onSwitchToAds: () => void;
}

const PRIZES = [
  { label: "50",   value: 50,   color: "#FF6B6B" },
  { label: "200",  value: 200,  color: "#4ECDC4" },
  { label: "100",  value: 100,  color: "#FFE66D" },
  { label: "500",  value: 500,  color: "#FF9F43" },
  { label: "75",   value: 75,   color: "#A29BFE" },
  { label: "1000", value: 1000, color: "#FAB1A0" },
  { label: "150",  value: 150,  color: "#55E6C1" },
  { label: "250",  value: 250,  color: "#FD79A8" },
];

const AD_DURATION = 12;

function loadMonetagScript() {
  if (document.getElementById("monetag-script")) return;
  const s = document.createElement("script");
  s.id = "monetag-script";
  s.src = "https://3nbf4.com/400/10996226";
  s.async = true;
  document.head.appendChild(s);
}

export default function SpinWheelSection({ user, lang, onReward }: SpinWheelSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Monetag ad overlay state
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [adCountdown, setAdCountdown] = useState(AD_DURATION);
  const [adCanClaim, setAdCanClaim] = useState(false);
  const [adToken, setAdToken] = useState<string | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();
  const t = translations[lang];

  const spinMutation = trpc.spin.perform.useMutation();
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  useEffect(() => { drawWheel(); }, [rotation]);
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = cx - 15;
    const segments = PRIZES.length;
    const arc = (2 * Math.PI) / segments;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#2d3436";
    ctx.fill();
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < segments; i++) {
      const start = i * arc;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = PRIZES[i].color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#2d3436";
      ctx.font = "bold 18px 'Inter', sans-serif";
      ctx.fillText(PRIZES[i].label, r - 25, 7);
      ctx.restore();
    }

    ctx.restore();

    const gradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, 30);
    gradient.addColorStop(0, "#f1c40f");
    gradient.addColorStop(1, "#e67e22");
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);

    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - r - 5);
    ctx.lineTo(cx + 10, cy - r - 5);
    ctx.lineTo(cx, cy - r + 15);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // ─── Monetag ad for spin ───────────────────────────────────────────────────

  const startAdCountdown = () => {
    let count = AD_DURATION;
    setAdCountdown(count);
    setAdCanClaim(false);
    countdownRef.current = setInterval(() => {
      count--;
      setAdCountdown(count);
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setAdCanClaim(true);
      }
    }, 1000);
  };

  const handleWatchAdForSpin = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const tokenData = await getTokenMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });
      if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || t.ad_error_desc);

      setAdToken(tokenData.token);
      loadMonetagScript();
      setShowAdOverlay(true);
      startAdCountdown();
    } catch (error: any) {
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setAdLoading(false);
    }
  };

  const handleAdClaim = async () => {
    if (!adToken || !adCanClaim) return;
    setAdLoading(true);
    try {
      const claimData = await claimMutation.mutateAsync({
        telegramId: user.telegramId,
        token: adToken,
        initData: window.Telegram?.WebApp?.initData || "",
        type: "spin",
      });
      if (claimData.success) {
        toast({ title: t.congrats, description: `${t.extra_spin_reward}: ${claimData.reward}` });
        onReward(
          claimData.balance !== undefined && claimData.spinsLeft !== undefined
            ? { balance: Number(claimData.balance), spinsLeft: Number(claimData.spinsLeft) }
            : undefined
        );
        closeAdOverlay();
      } else {
        throw new Error(claimData.message || t.ad_error_desc);
      }
    } catch (error: any) {
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setAdLoading(false);
    }
  };

  const closeAdOverlay = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowAdOverlay(false);
    setAdToken(null);
    setAdCanClaim(false);
    setAdCountdown(AD_DURATION);
  };

  // ─── Spin wheel ───────────────────────────────────────────────────────────

  const handleSpin = async () => {
    if (isSpinning || user.spinsLeft <= 0) return;
    setIsSpinning(true);

    try {
      const data = await spinMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (!data.success) {
        toast({ title: t.notice, description: data.message || t.spin_failed, variant: "destructive" });
        setIsSpinning(false);
        return;
      }

      const prizeIndex = PRIZES.findIndex((p) => p.value === data.prize);
      const segmentAngle = (2 * Math.PI) / PRIZES.length;
      const startRotation = rotation;
      const targetPrizeRotation = -(prizeIndex * segmentAngle + segmentAngle / 2) - Math.PI / 2;
      const currentRotationNormalized = startRotation % (Math.PI * 2);
      const extraSpins = 8 * Math.PI * 2;
      const targetRotation = startRotation + extraSpins + (targetPrizeRotation - currentRotationNormalized);

      const startTime = Date.now();
      const duration = 4000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        setRotation(startRotation + (targetRotation - startRotation) * easeOut);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          toast({
            title: t.congrats,
            description: `${t.won_points} ${data.prize} PTS`,
          });
          onReward(
            data.balance !== undefined && data.spinsLeft !== undefined
              ? { balance: Number(data.balance), spinsLeft: Number(data.spinsLeft) }
              : undefined
          );
          setIsSpinning(false);
        }
      };

      animate();
    } catch (error: any) {
      console.error("Error spinning:", error);
      toast({ title: t.error, description: t.spin_error, variant: "destructive" });
      setIsSpinning(false);
    }
  };

  return (
    <>
      {/* ── Monetag Ad Overlay ─────────────────────────────────────────── */}
      {showAdOverlay && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0a0f1e" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60" style={{ background: "#0d1525" }}>
            <span className="text-xs text-gray-400 font-medium">إعلان</span>
            <div className="px-4 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
              <span className="text-xs text-green-400 font-bold">✓ جاهز</span>
            </div>
            <span className="text-xs text-gray-500">مدعوم من Monetag</span>
          </div>

          {/* Ad Content */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6" style={{ background: "#0d1a3e" }}>
            <div className="w-56 h-44 rounded-2xl flex items-center justify-center shadow-2xl"
                 style={{ background: "linear-gradient(135deg, #1a2a6e 0%, #0d1a3e 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-center space-y-3">
                <div className="text-6xl opacity-40">❓</div>
                <div className="w-8 h-1 mx-auto rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                     style={{ background: "#f39c12", color: "#fff" }}>C</div>
                <div>
                  <p className="font-bold text-white text-sm">CryptoFarm 🌾</p>
                  <p className="text-xs text-gray-400">Farm crypto every day!</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Collect coins, upgrade your farm and earn real USDT rewards daily. Join millions of players now!
              </p>
              <div className="inline-block px-2 py-0.5 rounded text-xs text-gray-500" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>Ad</div>
            </div>

            <p className="text-xs text-gray-600">ads by Monetag</p>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-800">
            <div
              className="h-full bg-purple-500 transition-all duration-1000"
              style={{ width: `${((AD_DURATION - adCountdown) / AD_DURATION) * 100}%` }}
            />
          </div>

          {/* Buttons */}
          <div className="px-4 py-4 space-y-3" style={{ background: "#0a0f1e", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={handleAdClaim}
              disabled={!adCanClaim || adLoading}
              style={{
                width: "100%", height: 56, borderRadius: 14, fontWeight: 700, fontSize: 16,
                border: "none", cursor: adCanClaim ? "pointer" : "not-allowed",
                background: adCanClaim ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(34,197,94,0.12)",
                color: adCanClaim ? "#fff" : "#4ade80",
                boxShadow: adCanClaim ? "0 0 28px rgba(34,197,94,0.4)" : "none",
                transition: "all 0.3s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {adLoading
                ? "⏳"
                : adCanClaim
                  ? "✅ استلام دورة مجانية 🎡"
                  : <><span style={{ fontSize: 20 }}>⬇</span><span>جاري الاستلام... {adCountdown}</span></>
              }
            </button>
            <button
              onClick={closeAdOverlay}
              style={{
                width: "100%", height: 48, borderRadius: 12, fontWeight: 500, fontSize: 14,
                background: "rgba(255,255,255,0.04)", color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
              }}
            >
              › استمر
            </button>
          </div>
        </div>
      )}

      {/* ── Spin Wheel Card ───────────────────────────────────────────── */}
      <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950 border-slate-700/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                {t.spin_title}
              </span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <Sparkles className="h-3 w-3 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">{t.big_prizes}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="relative flex justify-center items-center">
            <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              onClick={!isSpinning && user.spinsLeft > 0 ? handleSpin : undefined}
              className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer transition-transform ${!isSpinning && user.spinsLeft > 0 ? "hover:scale-105" : ""}`}
            />
            {!isSpinning && user.spinsLeft > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20" />
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">{t.remaining_tries}</span>
              <span className="text-sm font-bold text-purple-400">{user.spinsLeft} / 5</span>
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    i < user.spinsLeft
                      ? "bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                      : "bg-slate-800"
                  }`}
                />
              ))}
            </div>
          </div>

          {user.spinsLeft > 0 ? (
            <>
              <Button
                onClick={handleSpin}
                disabled={isSpinning}
                className="w-full h-14 text-lg font-black transition-all duration-300 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:scale-[1.02] active:scale-[0.98] text-slate-950 shadow-[0_4px_15px_rgba(234,179,8,0.3)]"
              >
                {isSpinning ? t.spinning : t.spin_btn}
              </Button>
              <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                {t.daily_spins_info}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-purple-700/40 rounded-xl p-4 text-center space-y-1">
                <p className="text-yellow-400 font-bold text-sm">{t.no_spins_left}</p>
                <p className="text-gray-400 text-xs">{t.watch_ad_for_spin_desc}</p>
              </div>
              <Button
                onClick={handleWatchAdForSpin}
                disabled={adLoading}
                className="w-full h-14 text-base font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {adLoading
                  ? <><span className="animate-spin">⏳</span> {t.loading_ad}</>
                  : <><Tv2 className="h-5 w-5" /> {t.watch_ad_earn_spin}</>
                }
              </Button>
              <p className="text-[10px] text-gray-500 text-center tracking-widest font-bold">
                {t.daily_renewal}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
