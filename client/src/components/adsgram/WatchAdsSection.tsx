import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import AdOverlay from "./AdOverlay";

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
  onReward: (update?: { balance: number; todayAds: number; lastAdTime: number }) => void;
}

export default function WatchAdsSection({ user, onReward }: WatchAdsSectionProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const { toast } = useToast();

  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  useEffect(() => {
    if (!user.lastAdTime) return;
    const elapsed = (Date.now() - user.lastAdTime) / 1000;
    const remaining = Math.max(0, user.adCooldown - elapsed);
    setCooldownRemaining(Math.ceil(remaining));
    if (remaining <= 0) return;
    const iv = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [user.lastAdTime, user.adCooldown]);

  const canWatch = cooldownRemaining === 0 && user.todayAds < 50;

  const handleStart = () => {
    if (!canWatch) return;
    setShowAd(true);
  };

  const handleClaim = async () => {
    const initData = window.Telegram?.WebApp?.initData || "";
    const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
    if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || "فشل");

    const claimData = await claimMutation.mutateAsync({
      telegramId: user.telegramId,
      token: tokenData.token,
      initData,
      type: "points",
    });

    if (!claimData.success) throw new Error(claimData.message || "فشل استلام المكافأة");

    toast({ title: "🎉 مبروك!", description: `حصلت على ${claimData.reward} نقطة!` });
    onReward({ balance: Number(claimData.balance), todayAds: user.todayAds + 1, lastAdTime: Date.now() });
    setCooldownRemaining(user.adCooldown);
    setShowAd(false);
  };

  return (
    <>
      {showAd && (
        <AdOverlay
          seconds={15}
          rewardLabel="100 PTS"
          onClaim={handleClaim}
          onClose={() => setShowAd(false)}
        />
      )}

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Play className="h-5 w-5 text-yellow-400" />
            مشاهدة الإعلانات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700/30">
            <p className="text-sm text-gray-300 mb-1">
              اكسب <span className="font-bold text-yellow-400">100</span> نقطة لكل إعلان
            </p>
            <p className="text-xs text-gray-400">الحد اليومي: {user.todayAds}/50 إعلان</p>
          </div>

          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-950/40 border border-yellow-800/40 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
              <p className="text-xs text-yellow-300">
                الإعلان التالي خلال <span className="font-black">{cooldownRemaining}</span> ثانية
              </p>
            </div>
          )}

          {user.todayAds >= 50 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-800/40 rounded-lg">
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">وصلت للحد اليومي — عود غداً!</p>
            </div>
          )}

          <Button
            onClick={handleStart}
            disabled={!canWatch}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-black h-12 rounded-xl disabled:opacity-50"
          >
            {user.todayAds >= 50
              ? "وصلت للحد اليومي"
              : cooldownRemaining > 0
              ? `⏳ انتظر ${cooldownRemaining}s`
              : "▶ مشاهدة إعلان (100 PTS)"}
          </Button>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 mb-1">المكافأة</p>
              <p className="font-black text-yellow-400">100 PTS</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded-lg">
              <p className="text-gray-400 mb-1">مدة المشاهدة</p>
              <p className="font-black text-blue-400">15s</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
