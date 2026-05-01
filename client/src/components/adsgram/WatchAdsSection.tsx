import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// ── Ad network config ────────────────────────────────────────────────────────
const AD_SCRIPT_SRC =
  "https://pl29295764.profitablecpmratenetwork.com/3d/54/e6/3d54e6926dde81b8df0c12dca1818750.js";
const AD_WATCH_URL =
  "https://www.profitablecpmratenetwork.com/zz0tahmvj?key=23aa1344c6e3e9cf28733393f88bd734";

/**
 * Inject the ad-network script once into <body> (idempotent).
 * Call this from useEffect so it runs only on the client side.
 */
function injectAdScript() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${AD_SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = AD_SCRIPT_SRC;
  s.async = true;
  document.body.appendChild(s);
}
// ────────────────────────────────────────────────────────────────────────────

interface UserData {
  telegramId: number;
  balance: number;
  adReward: number;
  adCooldown: number;
  lastAdTime: number | null;
}

interface WatchAdsSectionProps {
  user: UserData;
  onReward: () => void;
}

export default function WatchAdsSection({ user, onReward }: WatchAdsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { toast } = useToast();

  // ── Inject ad script once when component mounts ──────────────────────────
  useEffect(() => {
    injectAdScript();
  }, []);

  // ── Cooldown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (user.lastAdTime) {
      const elapsed = (Date.now() - user.lastAdTime) / 1000;
      const remaining = Math.max(0, user.adCooldown - elapsed);
      setCooldownRemaining(remaining);

      if (remaining > 0) {
        const interval = setInterval(() => {
          setCooldownRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(interval);
      }
    }
  }, [user.lastAdTime, user.adCooldown]);

  // ── Watch-ad handler ──────────────────────────────────────────────────────
  const handleWatchAd = async () => {
    if (cooldownRemaining > 0) {
      toast({
        title: "انتظر قليلاً",
        description: `يجب الانتظار ${Math.ceil(cooldownRemaining)} ثانية`,
        variant: "destructive",
      });
      return;
    }

    // 1️⃣ Open the ad URL in a new tab immediately on user gesture
    window.open(AD_WATCH_URL, "_blank", "noopener,noreferrer");

    setLoading(true);
    try {
      // 2️⃣ Get token
      const tokenRes = await fetch("/api/ads.getToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          initData: window.Telegram?.WebApp?.initData || "",
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.success) {
        toast({
          title: "خطأ",
          description: tokenData.message || "فشل الحصول على توكن",
          variant: "destructive",
        });
        return;
      }

      // 3️⃣ Notify user the ad is showing
      toast({
        title: "جاري عرض الإعلان...",
        description: "يرجى الانتظار",
      });

      // 4️⃣ Wait 3 s (mirrors the ad view window)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 5️⃣ Claim reward
      const claimRes = await fetch("/api/ads.claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          token: tokenData.token,
          initData: window.Telegram?.WebApp?.initData || "",
        }),
      });

      const claimData = await claimRes.json();
      if (claimData.success) {
        toast({
          title: "🎉 مبروك!",
          description: `حصلت على ${claimData.reward} نقطة`,
        });
        setCooldownRemaining(user.adCooldown);
        onReward();
      } else {
        toast({
          title: "خطأ",
          description: claimData.message || "فشل استلام المكافأة",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error watching ad:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في الاتصال",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-yellow-400" />
          مشاهدة الإعلانات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700/30">
          <p className="text-sm text-gray-300 mb-2">
            اكسب{" "}
            <span className="font-bold text-yellow-400">{user.adReward}</span>{" "}
            نقطة لكل إعلان
          </p>
          <p className="text-xs text-gray-400">
            يمكنك مشاهدة عدة إعلانات مع فترة انتظار بين كل إعلان
          </p>
        </div>

        {cooldownRemaining > 0 && (
          <Alert className="bg-yellow-950/50 border-yellow-700/50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-200">
              انتظر {Math.ceil(cooldownRemaining)} ثانية قبل الإعلان التالي
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleWatchAd}
          disabled={loading || cooldownRemaining > 0}
          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold h-12"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              جاري عرض الإعلان...
            </>
          ) : cooldownRemaining > 0 ? (
            `انتظر ${Math.ceil(cooldownRemaining)}s`
          ) : (
            "▶ مشاهدة إعلان"
          )}
        </Button>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">الحد الأدنى</p>
            <p className="font-bold text-yellow-400">10,000</p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">المعدل</p>
            <p className="font-bold text-purple-400">1000 = ⭐1</p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">الفترة</p>
            <p className="font-bold text-blue-400">{user.adCooldown}s</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
