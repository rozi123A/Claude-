import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const MAX_AD_SPINS = 5;
const LS_COUNT = "spinAdCount";
const LS_DATE  = "spinAdDate";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function getAdSpinsUsed(): number {
  try {
    if (localStorage.getItem(LS_DATE) !== todayStr()) {
      localStorage.setItem(LS_COUNT, "0");
      localStorage.setItem(LS_DATE, todayStr());
      return 0;
    }
    return parseInt(localStorage.getItem(LS_COUNT) || "0", 10);
  } catch { return 0; }
}
function bumpAdSpins() {
  try {
    localStorage.setItem(LS_COUNT, String(getAdSpinsUsed() + 1));
    localStorage.setItem(LS_DATE, todayStr());
  } catch {}
}

function getAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playTick(ctx: AudioContext, t: number) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t); o.stop(t + 0.05);
}
function playSpinSound(ctx: AudioContext, dur: number) {
  const now = ctx.currentTime; let t = now, iv = 0.06;
  while (t < now + dur) { playTick(ctx, t); t += iv; iv = 0.06 + ((t - now) / dur) * 0.55; }
}
function playWinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sine";
    const t = now + i * 0.13;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.start(t); o.stop(t + 0.4);
  });
}

/** Wait up to `ms` milliseconds for window.Adsgram to become available. */
function waitForAdsgram(ms = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Adsgram) {
      resolve((window as any).Adsgram);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if ((window as any).Adsgram) {
        clearInterval(interval);
        resolve((window as any).Adsgram);
      } else if (Date.now() - start > ms) {
        clearInterval(interval);
        reject(new Error("Adsgram SDK failed to load. Please refresh and try again."));
      }
    }, 100);
  });
}

export default function SpinWheelSection({ user, lang, onReward }: SpinWheelSectionProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [isSpinning,  setIsSpinning]  = useState(false);
  const [rotation,    setRotation]    = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [adSpinsUsed, setAdSpinsUsed] = useState(0);
  const { toast } = useToast();
  const t = translations[lang];

  // Validate blockId — must be non-empty and numeric
  const blockId = user.adsgramBlockId?.replace(/[^0-9]/g, "") || "29281";

  const spinMutation     = trpc.spin.perform.useMutation();
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation    = trpc.ads.claim.useMutation();

  useEffect(() => { setAdSpinsUsed(getAdSpinsUsed()); }, []);
  useEffect(() => { drawWheel(); }, [rotation]);

  function drawWheel() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 15;
    const seg = PRIZES.length, arc = (2 * Math.PI) / seg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#2d3436"; ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.stroke();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
    for (let i = 0; i < seg; i++) {
      const s = i * arc, e = s + arc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s, e); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(s + arc / 2); ctx.textAlign = "right";
      ctx.fillStyle = "#2d3436"; ctx.font = "bold 18px 'Inter',sans-serif";
      ctx.fillText(PRIZES[i].label, r - 25, 7); ctx.restore();
    }
    ctx.restore();

    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 30);
    grad.addColorStop(0, "#f1c40f"); grad.addColorStop(1, "#e67e22");
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);

    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - r - 5); ctx.lineTo(cx + 10, cy - r - 5); ctx.lineTo(cx, cy - r + 15);
    ctx.closePath(); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
  }

  async function handleWatchSpinAd() {
    const initData = (window as any).Telegram?.WebApp?.initData || "";
    setAdLoading(true);
    try {
      // 1. Get one-time server token first
      const tok = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
      if (!tok.success || !tok.token) throw new Error(tok.message || "فشل الحصول على التوكن");

      // 2. Wait for Adsgram SDK
      const Adsgram = await waitForAdsgram(5000);

      // 3. Always create a fresh controller
      const controller = Adsgram.init({ blockId });
      setAdLoading(false);

      // 4. Show ad — resolves only when fully watched
      await controller.show();

      // 5. Claim spin reward
      const cl = await claimMutation.mutateAsync({
        telegramId: user.telegramId,
        token: tok.token,
        initData,
        type: "spin",
      });

      if (cl.success) {
        bumpAdSpins();
        setAdSpinsUsed(getAdSpinsUsed());
        // Always update balance and spins — never skip even if server returns undefined
        const newBalSpin = cl.balance !== undefined ? Number(cl.balance) : user.balance + 100;
        const newSpinCount = cl.spinsLeft !== undefined ? Number(cl.spinsLeft) : user.spinsLeft + 1;
        onReward({ balance: newBalSpin, spinsLeft: newSpinCount });
        toast({ title: "🎡 تم!", description: "حصلت على دورة مجانية!" });
      } else {
        toast({ title: "خطأ", description: cl.message || "فشل الحصول على الدورة", variant: "destructive" });
      }
    } catch (e: any) {
      setAdLoading(false);
      if (e?.type === "no_ad" || e?.message?.includes("no_ad")) {
        toast({ title: "لا يوجد إعلان", description: "لا توجد إعلانات الآن، حاول لاحقاً", variant: "destructive" });
      } else if (e?.type === "skip") {
        toast({ title: "تم تخطي الإعلان", description: "يجب مشاهدة الإعلان كاملاً", variant: "destructive" });
      } else if (e?.type === "banner_not_found" || e?.message?.toLowerCase().includes("not found")) {
        toast({ title: "خطأ في الإعلان", description: "معرّف الإعلان غير صالح. يرجى التواصل مع المطور.", variant: "destructive" });
        console.error("[Adsgram] blockId not found:", blockId, e);
      } else {
        toast({ title: "خطأ", description: e?.message || "فشل", variant: "destructive" });
      }
    }
  }

  async function handleSpin() {
    if (isSpinning || user.spinsLeft <= 0) return;
    setIsSpinning(true);
    if (!audioCtxRef.current) audioCtxRef.current = getAudioCtx();
    const actx = audioCtxRef.current;
    if (actx?.state === "suspended") await actx.resume();

    try {
      const data = await spinMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: (window as any).Telegram?.WebApp?.initData || "",
      });
      if (!data.success) {
        toast({ title: t.notice, description: data.message || t.spin_failed, variant: "destructive" });
        setIsSpinning(false); return;
      }

      const idx = PRIZES.findIndex(p => p.value === data.prize);
      const segAngle = (2 * Math.PI) / PRIZES.length;
      const target = rotation + 8 * Math.PI * 2 + (-(idx * segAngle + segAngle / 2) - Math.PI / 2 - rotation % (Math.PI * 2));
      const dur = 4000, t0 = Date.now(), r0 = rotation;

      if (actx) playSpinSound(actx, dur / 1000);

      const animate = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        setRotation(r0 + (target - r0) * (1 - Math.pow(1 - p, 4)));
        if (p < 1) { requestAnimationFrame(animate); }
        else {
          if (actx) playWinSound(actx);
          toast({ title: t.congrats, description: `${t.won_points} ${data.prize} PTS` });
          const wonBalance = data.balance !== undefined ? Number(data.balance) : user.balance + (data.prize || 0);
          const wonSpins = data.spinsLeft !== undefined ? Number(data.spinsLeft) : Math.max(0, user.spinsLeft - 1);
          onReward({ balance: wonBalance, spinsLeft: wonSpins });
          setIsSpinning(false);
        }
      };
      animate();
    } catch {
      toast({ title: t.error, description: t.spin_error, variant: "destructive" });
      setIsSpinning(false);
    }
  }

  const adSpinsLeft = MAX_AD_SPINS - adSpinsUsed;

  return (
    <>
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
          {/* Wheel */}
          <div className="relative flex justify-center items-center">
            <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <canvas
              ref={canvasRef}
              width={320} height={320}
              onClick={!isSpinning && user.spinsLeft > 0 ? handleSpin : undefined}
              className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer transition-transform ${!isSpinning && user.spinsLeft > 0 ? "hover:scale-105" : ""}`}
            />
            {!isSpinning && user.spinsLeft > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20" />
              </div>
            )}
          </div>

          {/* Spins indicator */}
          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">{t.remaining_tries}</span>
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
            <>
              <button
                onClick={handleSpin}
                disabled={isSpinning}
                className="w-full h-14 text-lg font-black transition-all duration-300 rounded-xl"
                style={{
                  background: "linear-gradient(135deg,#eab308,#ca8a04,#eab308)",
                  color: "#0f172a",
                  boxShadow: "0 4px 15px rgba(234,179,8,0.3)",
                  border: "none", cursor: isSpinning ? "not-allowed" : "pointer",
                  opacity: isSpinning ? 0.7 : 1,
                }}
              >
                {isSpinning ? t.spinning : t.spin_btn}
              </button>
              <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                {t.daily_spins_info}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-purple-700/40 rounded-xl p-4 text-center space-y-1">
                <p className="text-yellow-400 font-bold text-sm">{t.no_spins_left}</p>
                <p className="text-gray-400 text-xs">{t.watch_ad_for_spin_desc}</p>
                {adSpinsLeft > 0 && (
                  <p className="text-purple-400 text-xs font-bold">
                    {adSpinsLeft}/{MAX_AD_SPINS} {lang === "ar" ? "إعلان متبقي اليوم" : lang === "ru" ? "реклама осталась" : "ads left today"}
                  </p>
                )}
              </div>

              {adSpinsLeft > 0 ? (
                <button
                  onClick={handleWatchSpinAd} disabled={adLoading}
                  className="w-full h-14 text-base font-black rounded-xl flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
                    border: "none", cursor: adLoading ? "not-allowed" : "pointer",
                    opacity: adLoading ? 0.7 : 1,
                  }}
                >
                  {adLoading
                    ? <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    : <Tv2 className="h-5 w-5" />
                  }
                  {adLoading ? "جاري تحميل الإعلان..." : t.watch_ad_earn_spin}
                </button>
              ) : (
                <div className="text-center py-3 text-xs text-gray-500">{t.daily_renewal}</div>
              )}

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
