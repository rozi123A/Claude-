import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

// Declare Adsgram types
declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean; onReward?: () => void; onError?: (err: any) => void }) => any;
    };
  }
}

interface UserData {
  telegramId: number;
  balance: number;
  adReward: number;
  adCooldown: number;
  lastAdTime: number | null;
  todayAds: number;
}

interface WatchAdsSectionProps {
  user: UserData;
  onReward: () => void;
}

export default function WatchAdsSection({ user, onReward }: WatchAdsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { toast } = useToast();
  
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  // Cooldown timer
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

  const handleWatchAd = async () => {
    if (user.todayAds >= 50) {
      toast({
        title: "تنبيه",
        description: "لقد وصلت للحد الأقصى من الإعلانات اليوم (50 إعلان)",
        variant: "destructive",
      });
      return;
    }

    if (cooldownRemaining > 0) {
      toast({
        title: "انتظر قليلاً",
        description: `يجب الانتظار ${Math.ceil(cooldownRemaining)} ثانية`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Get token from backend
      const tokenData = await getTokenMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (!tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || "فشل الحصول على توكن");
      }

      // 2. Initialize Adsgram
      if (!window.Adsgram) {
        // Try to load script if not present
        const script = document.createElement("script");
        script.src = "https://adsgram.ai/sdk/v1/adsgram.js";
        script.async = true;
        document.body.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load AdsGram SDK"));
        });
      }

      const AdController = window.Adsgram!.init({ 
        blockId: "bot-29281",
        debug: false 
      });

      // 3. Show Ad
      const result = await AdController.show();

      if (result.done) {
        // 4. Claim reward
        const claimData = await claimMutation.mutateAsync({
          telegramId: user.telegramId,
          token: tokenData.token,
          initData: window.Telegram?.WebApp?.initData || "",
        });

        if (claimData.success) {
          toast({
            title: "🎉 مبروك!",
            description: `حصلت على ${claimData.reward} نقطة`,
          });
          onReward();
        } else {
          throw new Error(claimData.message || "فشل استلام المكافأة");
        }
      } else {
        toast({
          title: "تنبيه",
          description: "يجب مشاهدة الإعلان كاملاً للحصول على المكافأة",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("AdsGram Error:", error);
      toast({
        title: "خطأ في الإعلانات",
        description: error.message || "تعذر تحميل نظام الإعلانات حالياً",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
            <span className="font-bold text-yellow-400">10</span>{" "}
            نقاط لكل إعلان
          </p>
          <p className="text-xs text-gray-400">
            الحد اليومي: {user.todayAds}/50 إعلان
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
          disabled={loading || cooldownRemaining > 0 || user.todayAds >= 50}
          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold h-12"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              جاري التحميل...
            </>
          ) : cooldownRemaining > 0 ? (
            `انتظر ${Math.ceil(cooldownRemaining)}s`
          ) : user.todayAds >= 50 ? (
            "وصلت للحد اليومي"
          ) : (
            "▶ مشاهدة إعلان (10 PTS)"
          )}
        </Button>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">المكافأة</p>
            <p className="font-bold text-yellow-400">10 PTS</p>
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
