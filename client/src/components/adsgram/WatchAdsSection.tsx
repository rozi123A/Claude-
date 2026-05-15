import { useState, useEffect, useRef } from "react";
import { Play, Clock } from "lucide-react";
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

function triggerMonetagAd() {
  const fn = (window as any)["show_10996226"];
  if (typeof fn === "function") { try { fn(); } catch {} }
}

export default function WatchAdsSection({ user, lang, onReward }: WatchAdsSectionProps) {
  const [loading,            setLoading]            = useState(false);
  const [adCountdown,        setAdCountdown]        = useState(0);
  const [cooldownRemaining,  setCooldownRemaining]  = useState(0);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const t = translations[lang];
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation    = trpc.ads.claim.useMutation();

  useEffect(() => {
    if (user.lastAdTime) {
      const elapsed = (Date.now() - user.lastAdTime) / 1000;
      const remaining = Math.max(0, user.adCooldown - elapsed);
      setCooldownRemaining(remaining);
      if (remaining > 0) {
        const interval = setInterval(() => {
          setCooldownRemaining(prev => {
            if (prev <= 1) { clearInterval(interval); return 0; }
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
      toast({ title: t.notice, description: `${t.wait_before_next} ${Math.ceil(cooldownRemaining)} ${t.seconds}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
      if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || t.ad_error_desc);

      const token = tokenData.token;

      // Show Monetag native ad — no overlay so Monetag renders its own UI
      triggerMonetagAd();

      // Start 16s countdown in button
      let secs = 16;
      setAdCountdown(secs);
      setLoading(false);
      adTimerRef.current = setInterval(() => {
        secs -= 1;
        setAdCountdown(secs);
        if (secs <= 0) {
          clearInterval(adTimerRef.current!);
          setAdCountdown(0);
          // Auto-claim after ad duration
          claimMutation.mutateAsync({
            telegramId: user.telegramId,
            token,
            initData,
            type: "points",
          }).then(claimData => {
            if (claimData.success) {
              const newBalance = Number(claimData.balance ?? user.balance + user.adReward);
              toast({ title: t.congrats || "🎉 أحسنت!", description: `${t.earned_points || "ربحت"}: +${claimData.reward} نقطة` });
              onReward({ balance: newBalance, todayAds: user.todayAds + 1, lastAdTime: Date.now() });
              setCooldownRemaining(user.adCooldown);
            } else {
              toast({ title: t.error || "خطأ", description: claimData.message || t.ad_error_desc, variant: "destructive" });
            }
          }).catch(() => {
            toast({ title: t.error || "خطأ", description: t.ad_error_desc, variant: "destructive" });
          });
        }
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      toast({ title: t.ad_error || "خطأ", description: error.message || t.ad_error_desc, variant: "destructive" });
    }
  };

  const isWatchingAd = adCountdown > 0;
  const canWatch = cooldownRemaining === 0 && user.todayAds < 50 && !loading && !isWatchingAd;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, padding: "14px 16px" }}>
          <p style={{ fontSize: 9, color: "rgba(245,158,11,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            {t.today_ads || "إعلانات اليوم"}
          </p>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#F59E0B", lineHeight: 1 }}>
            {user.todayAds}<span style={{ fontSize: 13, color: "rgba(245,158,11,0.4)", marginLeft: 4 }}>/50</span>
          </p>
        </div>
        <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 18, padding: "14px 16px" }}>
          <p style={{ fontSize: 9, color: "rgba(139,92,246,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            {t.reward || "المكافأة"}
          </p>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#A78BFA", lineHeight: 1 }}>
            +{user.adReward}<span style={{ fontSize: 11, color: "rgba(139,92,246,0.4)", marginLeft: 4 }}>PTS</span>
          </p>
        </div>
      </div>

      {cooldownRemaining > 0 && !isWatchingAd && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Clock size={16} style={{ color: "#F87171", flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#FCA5A5", marginBottom: 2 }}>{t.wait_before_next || "انتظر قبل الإعلان التالي"}</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>
              {Math.floor(cooldownRemaining / 60).toString().padStart(2, "0")}:{Math.floor(cooldownRemaining % 60).toString().padStart(2, "0")}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleWatchAd}
        disabled={!canWatch}
        style={{
          width: "100%", height: 64, borderRadius: 20, border: "none",
          background: isWatchingAd
            ? "linear-gradient(135deg,#16a34a,#15803d)"
            : canWatch
            ? "linear-gradient(135deg, #F59E0B, #D97706)"
            : "rgba(255,255,255,0.05)",
          color: canWatch || isWatchingAd ? "#fff" : "rgba(255,255,255,0.2)",
          fontWeight: 900, fontSize: 17,
          cursor: canWatch ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          transition: "all 0.3s",
          boxShadow: isWatchingAd ? "0 8px 32px rgba(22,163,74,0.4)" : canWatch ? "0 8px 32px rgba(245,158,11,0.35)" : "none",
        }}
      >
        {loading
          ? <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          : isWatchingAd
          ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>{adCountdown}</div>
              <span>جاري مشاهدة الإعلان...</span>
            </div>
          : <Play size={22} fill="currentColor" />
        }
        {!loading && !isWatchingAd && (
          <span>
            {cooldownRemaining > 0
              ? `انتظر ${Math.ceil(cooldownRemaining)}s`
              : t.watch_ad || "شاهد إعلاناً واربح"}
          </span>
        )}
      </button>

      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "12px 16px" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, textAlign: "center" }}>
          📺 شاهد الإعلان كاملاً للحصول على النقاط<br/>
          ⏱️ كل إعلان مرة كل {user.adCooldown} ثانية<br/>
          🎯 حد يومي 50 إعلان
        </p>
      </div>
    </div>
  );
}
