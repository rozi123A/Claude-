import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Tv2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import AdOverlay from "./AdOverlay";

interface UserData {
  telegramId: number;
  balance: number;
  spinsLeft: number;
  adsgramBlockId: string;
}

interface SpinWheelSectionProps {
  user: UserData;
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

const MAX_AD_SPINS_PER_DAY = 5;
const LS_KEY_COUNT = "spinAdCount";
const LS_KEY_DATE  = "spinAdDate";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}
function getAdSpinsUsed(): number {
  try {
    const date = localStorage.getItem(LS_KEY_DATE);
    if (date !== getTodayStr()) { localStorage.setItem(LS_KEY_COUNT, "0"); localStorage.setItem(LS_KEY_DATE, getTodayStr()); return 0; }
    return parseInt(localStorage.getItem(LS_KEY_COUNT) || "0", 10);
  } catch { return 0; }
}
function incrementAdSpins() {
  try {
    const used = getAdSpinsUsed();
    localStorage.setItem(LS_KEY_COUNT, String(used + 1));
    localStorage.setItem(LS_KEY_DATE, getTodayStr());
  } catch {}
}

function getAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playTick(ctx: AudioContext, time: number) {
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "triangle"; osc.frequency.setValueAtTime(900, time); osc.frequency.exponentialRampToValueAtTime(400, time + 0.04);
  gain.gain.setValueAtTime(0.18, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  osc.start(time); osc.stop(time + 0.05);
}
function playSpinSound(ctx: AudioContext, duration: number) {
  const now = ctx.currentTime; let t = now; let interval = 0.06;
  while (t < now + duration) { playTick(ctx, t); t += interval; interval = 0.06 + ((t - now) / duration) * 0.55; }
}
function playWinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = "sine";
    const t = now + i * 0.13;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.3, t + 0.05); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.4);
  });
}

export default function SpinWheelSection({ user, onReward, onSwitchToAds }: SpinWheelSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [adSpinsUsed, setAdSpinsUsed] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  const spinMutation = trpc.spin.perform.useMutation();
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  // Load ad spins count from localStorage on mount
  useEffect(() => {
    setAdSpinsUsed(getAdSpinsUsed());
  }, []);

  useEffect(() => { drawWheel(); }, [rotation]);

  const drawWheel = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const cx = canvas.width / 2; const cy = canvas.height / 2; const r = cx - 15;
    const segments = PRIZES.length; const arc = (2 * Math.PI) / segments;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI); ctx.fillStyle = "#2d3436"; ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
    for (let i = 0; i < segments; i++) {
      const start = i * arc; const end = start + arc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, start, end); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(start + arc / 2); ctx.textAlign = "right";
      ctx.fillStyle = "#2d3436"; ctx.font = "bold 18px 'Inter', sans-serif";
      ctx.fillText(PRIZES[i].label, r - 25, 7); ctx.restore();
    }
    ctx.restore();
    const gradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, 30);
    gradient.addColorStop(0, "#f1c40f"); gradient.addColorStop(1, "#e67e22");
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI); ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - r - 5); ctx.lineTo(cx + 10, cy - r - 5); ctx.lineTo(cx, cy - r + 15); ctx.closePath();
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
  };

  const handleClaimSpinAd = async () => {
    const initData = window.Telegram?.WebApp?.initData || "";
    const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
    if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || "فشل");
    const claimData = await claimMutation.mutateAsync({
      telegramId: user.telegramId, token: tokenData.token, initData, type: "spin",
    });
    if (!claimData.success) throw new Error(claimData.message || "فشل استلام المكافأة");

    // Track locally
    incrementAdSpins();
    const newUsed = getAdSpinsUsed();
    setAdSpinsUsed(newUsed);

    toast({ title: "🎉 مبروك!", description: `حصلت على دورة إضافية و ${claimData.reward} نقطة!` });
    onReward(claimData.balance !== undefined && claimData.spinsLeft !== undefined
      ? { balance: Number(claimData.balance), spinsLeft: Number(claimData.spinsLeft) } : undefined
    );
    setShowAd(false);
  };

  const handleSpin = async () => {
    if (isSpinning || user.spinsLeft <= 0) return;
    setIsSpinning(true);
    if (!audioCtxRef.current) audioCtxRef.current = getAudioCtx();
    const actx = audioCtxRef.current;
    if (actx && actx.state === "suspended") await actx.resume();
    try {
      const data = await spinMutation.mutateAsync({ telegramId: user.telegramId, initData: window.Telegram?.WebApp?.initData || "" });
      if (!data.success) { toast({ title: "تنبيه", description: data.message || "فشل العجلة", variant: "destructive" }); setIsSpinning(false); return; }
      const prizeIndex = PRIZES.findIndex(p => p.value === data.prize);
      const segmentAngle = (2 * Math.PI) / PRIZES.length;
      const targetPrizeRotation = -(prizeIndex * segmentAngle + segmentAngle / 2) - Math.PI / 2;
      const currentRotationNormalized = rotation % (Math.PI * 2);
      const targetRotation = rotation + 8 * Math.PI * 2 + (targetPrizeRotation - currentRotationNormalized);
      const duration = 4000; const startTime = Date.now(); const startRotation = rotation;
      if (actx) playSpinSound(actx, duration / 1000);
      const animate = () => {
        const elapsed = Date.now() - startTime; const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        setRotation(startRotation + (targetRotation - startRotation) * easeOut);
        if (progress < 1) { requestAnimationFrame(animate); }
        else {
          if (actx) playWinSound(actx);
          toast({ title: "🎉 مبروك!", description: `لقد ربحت ${data.prize} نقطة!` });
          onReward(data.balance !== undefined && data.spinsLeft !== undefined
            ? { balance: Number(data.balance), spinsLeft: Number(data.spinsLeft) } : undefined
          );
          setIsSpinning(false);
        }
      };
      animate();
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الدوران", variant: "destructive" });
      setIsSpinning(false);
    }
  };

  const adSpinsRemaining = MAX_AD_SPINS_PER_DAY - adSpinsUsed;
  const canWatchAdForSpin = adSpinsRemaining > 0 && !isSpinning;

  return (
    <>
      {showAd && (
        <AdOverlay
          seconds={15}
          rewardLabel="🎡 دورة إضافية"
          onClaim={handleClaimSpinAd}
          onClose={() => setShowAd(false)}
        />
      )}

      <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950 border-slate-700/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Gift className="h-5 w-5 text-purple-400" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                عجلة الحظ اليومية
              </span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <Sparkles className="h-3 w-3 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">جوائز كبرى</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-8 pb-6 space-y-6">
          {/* Wheel */}
          <div className="relative flex justify-center items-center">
            <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              onClick={!isSpinning && user.spinsLeft > 0 ? handleSpin : undefined}
              className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-transform ${!isSpinning && user.spinsLeft > 0 ? "cursor-pointer hover:scale-105" : "cursor-default opacity-70"}`}
            />
            {!isSpinning && user.spinsLeft > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20" />
              </div>
            )}
          </div>

          {/* Free spins progress */}
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">السبينات المجانية</span>
              <span className="text-sm font-bold text-purple-400">{user.spinsLeft} / 5</span>
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < user.spinsLeft ? "bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]" : "bg-slate-800"}`} />
              ))}
            </div>
          </div>

          {/* Spin button */}
          {user.spinsLeft > 0 ? (
            <Button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full h-14 text-lg font-black transition-all duration-300 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:scale-[1.02] active:scale-[0.98] text-slate-950 shadow-[0_4px_15px_rgba(234,179,8,0.3)]"
            >
              {isSpinning ? "جاري الدوران..." : "إبدأ الدوران الآن 🎡"}
            </Button>
          ) : (
            <div className="flex items-center justify-center py-2 px-4 bg-slate-800/40 rounded-xl border border-slate-700/30">
              <p className="text-xs text-gray-500 font-bold">انتهت سبيناتك المجانية — شاهد إعلان للحصول على المزيد ↓</p>
            </div>
          )}

          {/* ══════════════════════════════════════════
              Watch Ad → Get Spin  (always visible)
          ══════════════════════════════════════════ */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "rgba(139,92,246,0.35)", background: "linear-gradient(135deg,rgba(88,28,135,0.25),rgba(49,46,129,0.25))" }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
              <div className="flex items-center gap-2">
                <Tv2 className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-black text-purple-300 uppercase tracking-wide">إعلانات السبينات اليومية</span>
              </div>
              {/* Counter badge */}
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black"
                style={{
                  background: adSpinsRemaining > 0 ? "rgba(139,92,246,0.3)" : "rgba(71,85,105,0.4)",
                  color: adSpinsRemaining > 0 ? "#c4b5fd" : "#6b7280",
                  border: adSpinsRemaining > 0 ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(71,85,105,0.4)",
                }}
              >
                <span>{adSpinsUsed}</span>
                <span className="opacity-50">/</span>
                <span>{MAX_AD_SPINS_PER_DAY}</span>
                <span className="ml-1">🎡</span>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 px-4 py-2">
              {Array.from({ length: MAX_AD_SPINS_PER_DAY }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full transition-all duration-500"
                  style={{
                    background: i < adSpinsUsed
                      ? "linear-gradient(90deg,#7c3aed,#6d28d9)"
                      : "rgba(71,85,105,0.4)"
                  }}
                />
              ))}
            </div>

            {/* Button area */}
            <div className="px-4 pb-4">
              {adSpinsRemaining > 0 ? (
                <>
                  <Button
                    onClick={() => setShowAd(true)}
                    disabled={isSpinning}
                    className="w-full h-12 font-black text-sm text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
                  >
                    <Tv2 className="h-4 w-4" />
                    شاهد إعلان ← دورة مجانية 🎡
                    <span
                      className="mr-1 px-2 py-0.5 rounded-full text-[10px] font-black"
                      style={{ background: "rgba(255,255,255,0.2)" }}
                    >
                      {adSpinsRemaining} متبقية
                    </span>
                  </Button>
                  <p className="text-center text-[10px] text-gray-600 mt-2">
                    كل إعلان = دورة واحدة مجانية • يتجدد كل يوم
                  </p>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500 font-bold">وصلت لحد الإعلانات اليومي</p>
                  <p className="text-[10px] text-gray-600 mt-1">تجدد الدورات المجانية غداً 🌙</p>
                </div>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </>
  );
}
