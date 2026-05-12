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

const AD_DURATION = 12;

function loadMonetagScript() {
  if (document.getElementById("monetag-script")) return;
  const s = document.createElement("script");
  s.id = "monetag-script";
  s.src = "https://3nbf4.com/400/10996226";
  s.async = true;
  document.head.appendChild(s);
}

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

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const startCountdown = () => {
    let count = AD_DURATION;
    setCountdown(count);
    setCanClaim(false);
    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setCanClaim(true);
      }
    }, 1000);
  };

  const handleWatchAd = async () => {
    if (user.todayAds >= 50) {
      toast({ title: t.notice, description: t.daily_ad_warning, variant: "destructive" });
      return;
    }
    if (cooldownRemaining > 0) {
      toast({ title: t.notice, description: `${t.wait_before_next} ${Math.ceil(cooldownRemaining)} ${t.seconds}`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const tokenData = await getTokenMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });
      if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || t.ad_error_desc);

      setAdToken(tokenData.token);
      loadMonetagScript();
      setShowOverlay(true);
      startCountdown();
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
        onReward(claimData.balance !== undefined
          ? { balance: Number(claimData.balance), todayAds: user.todayAds + 1, lastAdTime: now }
          : undefined);
        setCooldownRemaining(user.adCooldown);
        handleClose();
      } else {
        throw new Error(claimData.message || t.ad_error_desc);
      }
    } catch (error: any) {
      toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowOverlay(false);
    setAdToken(null);
    setCanClaim(false);
    setCountdown(AD_DURATION);
  };

  return (
    <>
      {showOverlay && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0a0f1e" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60" style={{ background: "#0d1525" }}>
            <span className="text-xs text-gray-400 font-medium">إعلان</span>
            <div className="px-4 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
              <span className="text-xs text-green-400 font-bold">✓ جاهز</span>
            </div>
            <span className="text-xs text-gray-500">مدعوم من Monetag</span>
          </div>

          {/* Ad Visual Area */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6" style={{ background: "#0d1a3e" }}>
            {/* Ad image placeholder */}
            <div className="w-56 h-44 rounded-2xl flex items-center justify-center shadow-2xl"
                 style={{ background: "linear-gradient(135deg, #1a2a6e 0%, #0d1a3e 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-center space-y-3">
                <div className="text-6xl opacity-40">❓</div>
                <div className="w-8 h-1 mx-auto rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>

            {/* Advertiser info */}
            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: "#f39c12", color: "#fff" }}>C</div>
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

          {/* Countdown progress bar */}
          <div className="h-1 bg-slate-800">
            <div
              className="h-full bg-green-500 transition-all duration-1000"
              style={{ width: `${((AD_DURATION - countdown) / AD_DURATION) * 100}%` }}
            />
          </div>

          {/* Buttons */}
          <div className="px-4 py-4 space-y-3" style={{ background: "#0a0f1e", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={handleClaim}
              disabled={!canClaim || loading}
              style={{
                width: "100%", height: 56, borderRadius: 14, fontWeight: 700, fontSize: 16,
                border: "none", cursor: canClaim ? "pointer" : "not-allowed",
                background: canClaim ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(34,197,94,0.12)",
                color: canClaim ? "#fff" : "#4ade80",
                boxShadow: canClaim ? "0 0 28px rgba(34,197,94,0.4)" : "none",
                transition: "all 0.3s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading
                ? "⏳"
                : canClaim
                  ? "✅ استلام المكافأة"
                  : <><span style={{ fontSize: 20 }}>⬇</span><span>جاري الاستلام... {countdown}</span></>
              }
            </button>
            <button
              onClick={handleClose}
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
              {t.earn_per_ad} <span className="font-bold text-yellow-400">{user.adReward}</span> {t.points}
            </p>
            <p className="text-xs text-gray-400">{t.daily_limit_info}: {user.todayAds}/50</p>
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
            {loading
              ? <><span className="animate-spin mr-2">⏳</span>{t.loading}</>
              : cooldownRemaining > 0 ? `${t.wait} ${Math.ceil(cooldownRemaining)}s`
              : user.todayAds >= 50 ? t.daily_limit_reached
              : `${t.watch_ad_btn} (${user.adReward} PTS)`}
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
