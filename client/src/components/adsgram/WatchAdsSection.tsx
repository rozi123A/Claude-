import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

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
  adsgramBlockId: string;
  lastAdTime: number | null;
  todayAds: number;
}

interface WatchAdsSectionProps {
  user: UserData;
  lang: Language;
  onReward: (update?: { balance: number; todayAds: number; lastAdTime: number }) => void;
}

export default function WatchAdsSection({ user, lang, onReward }: WatchAdsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { toast } = useToast();
  const t = translations[lang];

  useEffect(() => {
    const loadSdk = async () => {
      if (window.Adsgram) return;
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://adsgram.ai/sdk/v1/adsgram.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      } catch (e) {
        console.error("Failed to pre-load AdsGram SDK");
      }
    };
    loadSdk();
  }, []);

  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

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
      toast({ title: t.notice, description: t.daily_ad_warning, variant: "destructive" });
      return;
    }

    if (cooldownRemaining > 0) {
      toast({
        title: t.notice,
        description: `${t.wait_before_next} ${Math.ceil(cooldownRemaining)} ${t.seconds}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (!window.Adsgram) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://adsgram.ai/sdk/v1/adsgram.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(t.ad_error_desc));
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
          throw new Error(tokenData.message || t.ad_error_desc);
        }

        const claimData = await claimMutation.mutateAsync({
          telegramId: user.telegramId,
          token: tokenData.token,
          initData: window.Telegram?.WebApp?.initData || "",
          type: "points",
        });

        if (claimData.success) {
          toast({
            title: t.congrats,
            description: `${t.earned_points}: ${claimData.reward}`,
          });
          const now = Date.now();
          onReward(
            claimData.balance !== undefined
              ? { balance: Number(claimData.balance), todayAds: user.todayAds + 1, lastAdTime: now }
              : undefined
          );
          setCooldownRemaining(user.adCooldown);
        } else {
          throw new Error(claimData.message || t.ad_error_desc);
        }
      } else {
        toast({ title: t.notice, description: t.watch_full_ad, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("AdsGram Error:", error);
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-yellow-400" />
          {t.watch_ad}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700/30">
          <p className="text-sm text-gray-300 mb-2">
            {t.earn_per_ad}{" "}
            <span className="font-bold text-yellow-400">{user.adReward}</span>{" "}
            {t.points}
          </p>
          <p className="text-xs text-gray-400">
            {t.daily_limit_info}: {user.todayAds}/50
          </p>
        </div>

        {cooldownRemaining > 0 && (
          <Alert className="bg-yellow-950/50 border-yellow-700/50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-200">
              {t.wait_before_next} {Math.ceil(cooldownRemaining)} {t.seconds}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleWatchAd}
          disabled={loading || cooldownRemaining > 0 || user.todayAds >= 50}
          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold h-12"
        >
          {loading ? (
            <><span className="animate-spin mr-2">⏳</span>{t.loading}</>
          ) : cooldownRemaining > 0 ? (
            `${t.wait} ${Math.ceil(cooldownRemaining)}s`
          ) : user.todayAds >= 50 ? (
            t.daily_limit_reached
          ) : (
            `${t.watch_ad_btn} (${user.adReward} PTS)`
          )}
        </Button>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">{t.reward_label}</p>
            <p className="font-bold text-yellow-400">{user.adReward} PTS</p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded">
            <p className="text-gray-400">{t.period_label}</p>
            <p className="font-bold text-blue-400">{user.adCooldown}s</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
