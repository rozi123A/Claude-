import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Tv, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

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

const AD_WATCH_SECONDS = 30;

export default function WatchAdsSection({ user, onReward }: WatchAdsSectionProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [watchProgress, setWatchProgress] = useState(AD_WATCH_SECONDS);
  const [claiming, setClaiming] = useState(false);
  const [adDone, setAdDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation = trpc.ads.claim.useMutation();

  /* ── cooldown between ads ── */
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

  /* ── ad watch countdown ── */
  useEffect(() => {
    if (!showViewer || adDone) return;
    setWatchProgress(AD_WATCH_SECONDS);
    timerRef.current = setInterval(() => {
      setWatchProgress(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setAdDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [showViewer]);

  const startWatching = () => {
    if (user.todayAds >= 50) {
      toast({ title: "تنبيه", description: "وصلت للحد اليومي (50 إعلان)", variant: "destructive" });
      return;
    }
    if (cooldownRemaining > 0) {
      toast({ title: "انتظر", description: `انتظر ${cooldownRemaining} ثانية`, variant: "destructive" });
      return;
    }
    setAdDone(false);
    setWatchProgress(AD_WATCH_SECONDS);
    setShowViewer(true);
  };

  const closeViewer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowViewer(false);
    setAdDone(false);
    setWatchProgress(AD_WATCH_SECONDS);
  };

  const claimReward = async () => {
    if (!adDone) return;
    setClaiming(true);
    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
      if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || "فشل");

      const claimData = await claimMutation.mutateAsync({
        telegramId: user.telegramId,
        token: tokenData.token,
        initData,
        type: "points",
      });

      if (claimData.success) {
        toast({ title: "🎉 مبروك!", description: `حصلت على ${claimData.reward} نقطة!` });
        onReward({ balance: Number(claimData.balance), todayAds: user.todayAds + 1, lastAdTime: Date.now() });
        setCooldownRemaining(user.adCooldown);
        closeViewer();
      } else {
        throw new Error(claimData.message || "فشل استلام المكافأة");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const pct = ((AD_WATCH_SECONDS - watchProgress) / AD_WATCH_SECONDS) * 100;
  const canWatch = cooldownRemaining === 0 && user.todayAds < 50;

  return (
    <>
      {/* ── Ad Viewer Overlay ── */}
      {showViewer && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-yellow-400" />
                <span className="text-xs font-black text-gray-200">مشاهدة الإعلان</span>
              </div>
              {adDone && (
                <button onClick={closeViewer} className="text-gray-500 hover:text-gray-300 text-xs">✕ إغلاق</button>
              )}
            </div>

            {/* Ad area */}
            <div className="relative flex flex-col items-center justify-center bg-slate-950 h-48 mx-4 mt-4 rounded-xl overflow-hidden border border-slate-800">
              {adDone ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-12 w-12 text-green-400" />
                  <p className="text-sm font-black text-green-400">اكتملت المشاهدة!</p>
                </div>
              ) : (
                <>
                  {/* Monetag In-Page Push placeholder  */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                    <div className="flex flex-col items-center gap-3 opacity-60">
                      <div className="w-16 h-16 bg-slate-700 rounded-xl animate-pulse" />
                      <div className="w-24 h-2 bg-slate-700 rounded animate-pulse" />
                      <div className="w-16 h-2 bg-slate-700 rounded animate-pulse" />
                    </div>
                  </div>
                  {/* Countdown ring overlay */}
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                      <circle
                        cx="32" cy="32" r="28" fill="none"
                        stroke="#eab308" strokeWidth="4"
                        strokeDasharray={175.9}
                        strokeDashoffset={175.9 * (1 - pct / 100)}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-black text-yellow-400">{watchProgress}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="mx-4 mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full transition-all"
                style={{ width: `${pct}%`, transition: adDone ? "none" : "width 1s linear" }}
              />
            </div>

            {/* Footer */}
            <div className="p-4">
              {adDone ? (
                <Button
                  onClick={claimReward}
                  disabled={claiming}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black h-12 text-sm rounded-xl"
                >
                  {claiming ? "⏳ جاري الاستلام..." : "🎁 استلم 100 نقطة"}
                </Button>
              ) : (
                <div className="text-center text-xs text-gray-500">
                  انتظر حتى تكتمل المشاهدة لاستلام مكافأتك
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Card ── */}
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
            onClick={startWatching}
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
              <p className="font-black text-blue-400">{AD_WATCH_SECONDS}s</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
