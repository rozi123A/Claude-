import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "./AdOverlay";

interface UserData {
  telegramId: number; balance: number; adReward: number; adCooldown: number;
  adsgramBlockId: string; lastAdTime: number | null; todayAds: number;
}
interface WatchAdsSectionProps {
  user: UserData;
  lang: Language;
  onReward: (update?: { balance: number; todayAds: number; lastAdTime: number }) => void;
}

export default function WatchAdsSection({ user, lang, onReward }: WatchAdsSectionProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation    = trpc.ads.claim.useMutation();

  useEffect(() => {
    if (!user.lastAdTime) return;
    const elapsed   = (Date.now() - user.lastAdTime) / 1000;
    const remaining = Math.max(0, user.adCooldown - elapsed);
    setCooldownRemaining(Math.ceil(remaining));
    if (remaining <= 0) return;
    const iv = setInterval(() => {
      setCooldownRemaining(prev => { if (prev <= 1) { clearInterval(iv); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(iv);
  }, [user.lastAdTime, user.adCooldown]);

  const canWatch = cooldownRemaining === 0 && user.todayAds < 50;

  const handleClaim = async () => {
    const initData = window.Telegram?.WebApp?.initData || "";
    const tok = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
    if (!tok.success || !tok.token) throw new Error(tok.message || "failed");
    const cl = await claimMutation.mutateAsync({ telegramId: user.telegramId, token: tok.token, initData, type: "points" });
    if (!cl.success) throw new Error(cl.message || "failed");
    toast({ title: t.congrats, description: `${t.watch_ad} +${cl.reward} ${t.pts_unit}!` });
    onReward({ balance: Number(cl.balance), todayAds: user.todayAds + 1, lastAdTime: Date.now() });
    setCooldownRemaining(user.adCooldown);
    setShowAd(false);
  };

  return (
    <>
      {showAd && <AdOverlay seconds={15} rewardLabel="100 PTS" lang={lang} onClaim={handleClaim} onClose={() => setShowAd(false)} />}

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Play className="h-5 w-5 text-yellow-400" />
            {t.watch_ads_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700/30">
            <p className="text-sm text-gray-300 mb-1">
              {lang === "ar" ? "اكسب" : lang === "en" ? "Earn" : "Зарабатывай"}{" "}
              <span className="font-bold text-yellow-400">100</span>{" "}
              {t.earn_per_ad}
            </p>
            <p className="text-xs text-gray-400">{t.daily_limit_text}: {user.todayAds}/50 {t.ad_count_unit}</p>
          </div>

          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-950/40 border border-yellow-800/40 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-xs text-yellow-300">{t.next_ad_in} <span className="font-black">{cooldownRemaining}</span> {t.seconds_unit}</p>
            </div>
          )}

          {user.todayAds >= 50 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-800/40 rounded-lg">
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{t.daily_limit_reached_msg}</p>
            </div>
          )}

          <Button onClick={() => canWatch && setShowAd(true)} disabled={!canWatch}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-black h-12 rounded-xl disabled:opacity-50">
            {user.todayAds >= 50 ? t.daily_limit_btn
              : cooldownRemaining > 0 ? `${t.wait_label} ${cooldownRemaining}s`
              : t.watch_ad_btn}
          </Button>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 mb-1">{t.reward_label}</p>
              <p className="font-black text-yellow-400">100 PTS</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 mb-1">{t.duration_label}</p>
              <p className="font-black text-blue-400">15s</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
