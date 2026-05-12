import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

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

const AD_DURATION = 10;

export default function WatchAdsSection({ user, lang, onReward }: WatchAdsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [countdown, setCountdown] = useState(AD_DURATION);
  const [canClaim, setCanClaim] = useState(false);
  const [adToken, setAdToken] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const t = translations[lang];

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
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [user.lastAdTime, user.adCooldown]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

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
      const tokenData = await getTokenMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (!tokenData.success || !tokenData.token) {
        throw new Error(tokenData.message || t.ad_error_desc);
      }

      setAdToken(tokenData.token);
      setShowOverlay(true);
      setCountdown(AD_DURATION);
      setCanClaim(false);

      let count = AD_DURATION;
      countdownRef.current = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setCanClaim(true);
        }
      }, 1000);
    } catch (error: any) {
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!adToken || !canClaim) return;
    setLoading(true);
    try {
      const claimData = await claimMutation.mutateAsync({
        telegramId: user.telegramId,
        token: adToken,
        initData: window.Telegram?.WebApp?.initData || "",
        type: "points",
      });

      if (claimData.success) {
        toast({ title: t.congrats, description: `${t.earned_points}: ${claimData.reward}` });
        const now = Date.now();
        onReward(
          claimData.balance !== undefined
            ? { balance: Number(claimData.balance), todayAds: user.todayAds + 1, lastAdTime: now }
            : undefined
        );
        setCooldownRemaining(user.adCooldown);
        handleCloseOverlay();
      } else {
        throw new Error(claimData.message || t.ad_error_desc);
      }
    } catch (error: any) {
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseOverlay = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowOverlay(false);
    setAdToken(null);
    setCanClaim(false);
    setCountdown(AD_DURATION);
  };

  return (
    <>
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0f1e" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60"
               style={{ background: "#0d1525" }}>
            <span className="text-xs text-gray-400 font-medium">إعلان</span>
            <div className="px-4 py-1 rounded-full border border-green-500/40"
                 style={{ background: "rgba(34,197,94,0.12)" }}>
              <span className="text-xs text-green-400 font-bold">✓ جاهز</span>
            </div>
            <span className="text-xs text-gray-500">مدعوم من Monetag</span>
          </div>

          <div className="flex-1 overflow-hidden" style={{ background: "#0d1a3e" }}>
            <iframe
              src="/monetag.html"
              className="w-full h-full border-0"
              title="advertisement"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
          </div>

          <div className="px-4 py-4 space-y-3 border-t border-slate-800/80"
               style={{ background: "#0a0f1e" }}>
            <button
              onClick={handleClaim}
              disabled={!canClaim || loading}
              className="w-full h-14 rounded-xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: canClaim
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "rgba(34,197,94,0.15)",
                color: canClaim ? "#fff" : "#4ade80",
                boxShadow: canClaim ? "0 0 24px rgba(34,197,94,0.35)" : "none",
                cursor: canClaim ? "pointer" : "not-allowed",
                border: "none",
              }}
            >
              {loading ? (
                <span>⏳</span>
              ) : canClaim ? (
                "✅ استلام المكافأة"
              ) : (
                <>
                  <span style={{ fontSize: 18 }}>⬇</span>
                  <span>جاري الاستلام... {countdown}</span>
                </>
              )}
            </button>

            <button
              onClick={handleCloseOverlay}
              className="w-full h-12 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              › استمر
            </button>
          </div>
        </div>
      )}

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

          <p className="text-center text-xs text-gray-600">ads by Monetag</p>
        </CardContent>
      </Card>
    </>
  );
}
