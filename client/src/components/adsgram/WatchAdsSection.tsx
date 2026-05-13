import { useState, useEffect } from "react";
  import { Play, Clock } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { trpc } from "@/lib/trpc";
  import { translations, type Language } from "@/lib/i18n";
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
    lang: Language;
    onReward: (update?: { balance: number; todayAds: number; lastAdTime: number }) => void;
  }

  export default function WatchAdsSection({ user, lang, onReward }: WatchAdsSectionProps) {
    const [loading, setLoading] = useState(false);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [showAd, setShowAd] = useState(false);
    const [adToken, setAdToken] = useState<string | null>(null);
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
            setCooldownRemaining(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
          }, 1000);
          return () => clearInterval(interval);
        }
      }
    }, [user.lastAdTime, user.adCooldown]);

    const handleWatchAd = async () => {
      if (user.todayAds >= 50) { toast({ title: t.notice, description: t.daily_ad_warning, variant: "destructive" }); return; }
      if (cooldownRemaining > 0) { toast({ title: t.notice, description: `${t.wait_before_next} ${Math.ceil(cooldownRemaining)} ${t.seconds}`, variant: "destructive" }); return; }
      setLoading(true);
      try {
        const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData: window.Telegram?.WebApp?.initData || "" });
        if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || t.ad_error_desc);
        setAdToken(tokenData.token);
        setShowAd(true);
      } catch (error: any) {
        toast({ title: t.ad_error, description: error.message || t.ad_error_desc, variant: "destructive" });
      } finally { setLoading(false); }
    };

    const handleAdClaim = async () => {
      if (!adToken) return;
      const claimData = await claimMutation.mutateAsync({ telegramId: user.telegramId, token: adToken, initData: window.Telegram?.WebApp?.initData || "", type: "points" });
      if (!claimData.success) throw new Error(claimData.message || t.ad_error_desc);
      toast({ title: t.congrats, description: `${t.earned_points}: ${claimData.reward}` });
      const now = Date.now();
      // Always update balance optimistically — never skip the reward update
        const newBalance = claimData.balance !== undefined
          ? Number(claimData.balance)
          : user.balance + (claimData.reward || 100);
        onReward({ balance: newBalance, todayAds: user.todayAds + 1, lastAdTime: now });
      setCooldownRemaining(user.adCooldown);
      setShowAd(false); setAdToken(null);
    };

    const canWatch = !loading && cooldownRemaining <= 0 && user.todayAds < 50;
    const pct = Math.min((user.todayAds / 50) * 100, 100);

    return (
      <>
        {showAd && <AdOverlay seconds={15} rewardLabel={`${user.adReward} PTS`} onClaim={handleAdClaim} onClose={() => { setShowAd(false); setAdToken(null); }} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Hero reward card */}
          <div style={{ borderRadius: 22, padding: 20, background: "linear-gradient(145deg, #1a1000, #1a0d00)", border: "1px solid rgba(245,158,11,0.25)", boxShadow: "0 4px 30px rgba(245,158,11,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 9, color: "rgba(245,158,11,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>المكافأة لكل إعلان</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#FFE44D,#F59E0B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user.adReward}</span>
                  <span style={{ fontSize: 15, color: "rgba(255,200,0,0.45)", fontWeight: 700 }}>PTS</span>
                </div>
              </div>
              <div style={{ width: 58, height: 58, borderRadius: 18, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📺</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "إعلانات اليوم", value: `${user.todayAds}/50`, color: "#FFD700" },
                { label: "فترة الانتظار", value: `${user.adCooldown}ث`, color: "#60A5FA" },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "12px", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{s.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cooldown */}
          {cooldownRemaining > 0 && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <Clock size={22} style={{ color: "#F59E0B", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D", marginBottom: 2 }}>انتظر قبل المشاهدة التالية</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{t.wait_before_next}</p>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#F59E0B", minWidth: 44, textAlign: "center" }}>{Math.ceil(cooldownRemaining)}</div>
            </div>
          )}

          {/* Progress */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>التقدم اليومي</p>
              <p style={{ fontSize: 12, fontWeight: 800, color: pct >= 100 ? "#EF4444" : "#FFD700" }}>{user.todayAds} / 50</p>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#EF4444" : "linear-gradient(90deg,#F59E0B,#FFD700)", borderRadius: 6, transition: "width 0.6s ease" }} />
            </div>
          </div>

          {/* Main CTA */}
          <button
            onClick={handleWatchAd}
            disabled={!canWatch}
            style={{
              width: "100%", height: 62, borderRadius: 22, border: "none",
              cursor: canWatch ? "pointer" : "not-allowed",
              fontWeight: 900, fontSize: 16, letterSpacing: "0.04em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              transition: "all 0.3s",
              background: canWatch ? "linear-gradient(135deg, #F59E0B, #D97706)" : "rgba(255,255,255,0.05)",
              color: canWatch ? "#0a0a0f" : "rgba(255,255,255,0.25)",
              boxShadow: canWatch ? "0 6px 24px rgba(245,158,11,0.4), 0 2px 8px rgba(0,0,0,0.3)" : "none",
              opacity: canWatch ? 1 : 0.7,
            }}
          >
            {canWatch ? <Play size={22} fill="#0a0a0f" /> : <Clock size={20} />}
            {loading ? "جاري التحميل..." : cooldownRemaining > 0 ? `انتظر ${Math.ceil(cooldownRemaining)} ثانية` : user.todayAds >= 50 ? "اكتمل الحد اليومي ✓" : `شاهد إعلاناً (+${user.adReward} PTS)`}
          </button>

          <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.18)", fontWeight: 600 }}>إعلانات مقدمة من Monetag • يتجدد الحد كل 24 ساعة</p>
        </div>
      </>
    );
  }
  