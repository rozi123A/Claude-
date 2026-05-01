import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface UserData {
  telegramId: number;
  balance: number;
  spinsLeft: number;
}

interface SpinWheelSectionProps {
  user: UserData;
  onReward: () => void;
}

const PRIZES = [
  { label: "50", value: 50, color: "#e74c3c" },
  { label: "200", value: 200, color: "#f39c12" },
  { label: "100", value: 100, color: "#27ae60" },
  { label: "500", value: 500, color: "#2980b9" },
  { label: "75", value: 75, color: "#8e44ad" },
  { label: "1000", value: 1000, color: "#d35400" },
  { label: "150", value: 150, color: "#16a085" },
  { label: "250", value: 250, color: "#c0392b" },
];

export default function SpinWheelSection({ user, onReward }: SpinWheelSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const { toast } = useToast();

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
    const r = cx - 10;
    const segments = PRIZES.length;
    const arc = (2 * Math.PI) / segments;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw segments
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < segments; i++) {
      const start = i * arc;
      const end = start + arc;

      // Segment
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = PRIZES[i].color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.rotate(start + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      ctx.fillText(PRIZES[i].label, r - 14, 6);
      ctx.restore();
    }

    ctx.restore();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#0a0a0f";
    ctx.fill();
    ctx.strokeStyle = "#f0c040";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#f0c040";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);
  };

  const handleSpin = async () => {
    if (isSpinning || user.spinsLeft <= 0) return;

    setIsSpinning(true);

    try {
      const data = await trpc.spin.perform.mutate({
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

      // Calculate rotation
      const prizeIndex = PRIZES.findIndex((p) => p.value === data.prize);
      const segmentAngle = (2 * Math.PI) / PRIZES.length;
      const targetRotation = rotation + (10 * Math.PI * 2) - (prizeIndex * segmentAngle);

      // Animate spin
      let currentRotation = rotation;
      const startTime = Date.now();
      const duration = 3000; // 3 seconds

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);

        currentRotation = rotation + (targetRotation - rotation) * easeOut;
        setRotation(currentRotation);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          toast({
            title: "🎉 مبروك!",
            description: `حصلت على ${data.prize} نقطة`,
          });
          onReward();
          setIsSpinning(false);
        }
      };

      animate();
    } catch (error: any) {
      console.error("Error spinning:", error);
      toast({
        title: "خطأ في الاتصال",
        description: error.message || "تعذر الوصول إلى الخادم، يرجى المحاولة لاحقاً",
        variant: "destructive",
      });
      setIsSpinning(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-400" />
          عجلة الحظ اليومية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="rounded-full border-4 border-yellow-400/50"
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-400 mb-2">
            سبينات متبقية: <span className="font-bold text-purple-400">{user.spinsLeft}/5</span>
          </p>
          <div className="flex gap-1 justify-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < user.spinsLeft
                    ? "bg-purple-400"
                    : "bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>

        <Button
          onClick={handleSpin}
          disabled={isSpinning || user.spinsLeft <= 0}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold h-12"
        >
          {isSpinning ? (
            <>
              <span className="animate-spin mr-2">🎡</span>
              جاري الدوران...
            </>
          ) : user.spinsLeft <= 0 ? (
            "لا توجد سبينات متبقية"
          ) : (
            "🎡 اضغط للدوران"
          )}
        </Button>

        <p className="text-xs text-gray-400 text-center">
          تُعاد السبينات يومياً في منتصف الليل
        </p>
      </CardContent>
    </Card>
  );
}
