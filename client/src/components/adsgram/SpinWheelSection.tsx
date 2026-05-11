import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

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
  { label: "50", value: 50, color: "#FF6B6B" },
  { label: "200", value: 200, color: "#4ECDC4" },
  { label: "100", value: 100, color: "#FFE66D" },
  { label: "500", value: 500, color: "#FF9F43" },
  { label: "75", value: 75, color: "#A29BFE" },
  { label: "1000", value: 1000, color: "#FAB1A0" },
  { label: "150", value: 150, color: "#55E6C1" },
  { label: "250", value: 250, color: "#FD79A8" },
];

export default function SpinWheelSection({ user, onReward, onSwitchToAds }: SpinWheelSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

  const spinMutation = trpc.spin.perform.useMutation();
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  useEffect(() => {
    drawWheel();
  }, [rotation]);

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

  const handleWatchAdForSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    try {
      const adsgram = window.Adsgram;
      if (!adsgram) {
        const script = document.createElement("script");
        script.src = "https://adsgram.ai/sdk/v1/adsgram.js";
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("فشل تحميل SDK"));
          document.head.appendChild(script);
        });
      }

      const blockId = user.adsgramBlockId || "29281";
      const AdController = window.Adsgram!.init({ blockId, debug: false });
      const result = await AdController.show();

      if (result.done) {
        const tokenData = await getTokenMutation.mutateAsync({
          telegramId: user.telegramId,
          initData: window.Telegram?.WebApp?.initData || "",
        });

        if (!tokenData.success || !tokenData.token) {
          throw new Error(tokenData.message || "فشل الحصول على توكن");
        }

        const claimData = await claimMutation.mutateAsync({
          telegramId: user.telegramId,
          token: tokenData.token,
          initData: window.Telegram?.WebApp?.initData || "",
          type: "spin",
        });

        if (claimData.success) {
          toast({
            title: "🎉 مبروك!",
            description: `حصلت على دورة إضافية و ${claimData.reward} نقطة`,
          });
          onReward(
            claimData.balance !== undefined && claimData.spinsLeft !== undefined
              ? { balance: Number(claimData.balance), spinsLeft: Number(claimData.spinsLeft) }
              : undefined
          );
        } else {
          throw new Error(claimData.message || "فشل استلام المكافأة");
        }
      }
    } catch (error: any) {
      console.error("AdsGram Error:", error);
      toast({
        title: "خطأ في الإعلانات",
        description: error.message || "تعذر تحميل نظام الإعلانات حالياً",
        variant: "destructive",
      });
    } finally {
      setIsSpinning(false);
    }
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    
    if (user.spinsLeft <= 0) {
      return;
    }

    setIsSpinning(true);

    try {
      const data = await spinMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (!data.success) {
        toast({
          title: "تنبيه",
          description: data.message || "فشل العجلة",
          variant: "destructive",
        });
        setIsSpinning(false);
        return;
      }

      const prizeIndex = PRIZES.findIndex((p) => p.value === data.prize);
      const segmentAngle = (2 * Math.PI) / PRIZES.length;
      const startRotation = rotation;
      
      const targetPrizeRotation = - (prizeIndex * segmentAngle + segmentAngle / 2) - Math.PI / 2;
      const currentRotationNormalized = startRotation % (Math.PI * 2);
      const extraSpins = 8 * Math.PI * 2;
      const targetRotation = startRotation + extraSpins + (targetPrizeRotation - currentRotationNormalized);

      const startTime = Date.now();
      const duration = 4000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
        setRotation(currentRotation);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          toast({
            title: "🎉 مبروك!",
            description: `لقد ربحت ${data.prize} نقطة!`,
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الدوران، يرجى المحاولة لاحقاً",
        variant: "destructive",
      });
      setIsSpinning(false);
    }
  };

  return (
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
        <div className="relative flex justify-center items-center">
          <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
          
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            onClick={!isSpinning && user.spinsLeft > 0 ? handleSpin : undefined}
            className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-pointer transition-transform ${!isSpinning && user.spinsLeft > 0 ? 'hover:scale-105' : ''}`}
          />
          {!isSpinning && user.spinsLeft > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20"></div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">المحاولات المتبقية</span>
            <span className="text-sm font-bold text-purple-400">{user.spinsLeft} / 5</span>
          </div>
          <div className="flex gap-2 justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < user.spinsLeft ? "bg-gradient-to-r from-purple-500 to-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.4)]" : "bg-slate-800"}`} 
              />
            ))}
          </div>
        </div>

        {user.spinsLeft > 0 ? (
          <Button
            onClick={handleSpin}
            disabled={isSpinning}
            className="w-full h-14 text-lg font-black transition-all duration-300 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:scale-[1.02] active:scale-[0.98] text-slate-950 shadow-[0_4px_15px_rgba(234,179,8,0.3)]"
          >
            {isSpinning ? "جاري الدوران..." : "إبدأ الدوران الآن 🎡"}
          </Button>
        ) : (
          <Button
            onClick={handleWatchAdForSpin}
            disabled={isSpinning}
            className="w-full h-14 text-lg font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5" />
            {isSpinning ? "جاري التحميل..." : "شاهد إعلان للحصول على دورة إضافية"}
          </Button>
        )}

        <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
          تحصل على 5 محاولات مجانية يومياً
        </p>
      </CardContent>
    </Card>
  );
}
