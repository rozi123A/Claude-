import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "@/components/adsgram/AdOverlay";

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
  const [showAd,            setShowAd]            = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [pendingToken,      setPendingToken]      = useState<string | null>(null);
  const [tokenLoading,      setTokenLoading]      = useState(false);
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

  // FIX: Create token BEFORE showing overlay so tokenAge ≥ 15s when user claims
  const handleWatchAd = async () => {
    if (user.todayAds >= 50) {
      toast({ title: t.notice, description: t.daily_ad_warning, variant: "destructive" });
      return;
    }
    if (cooldownRemaining > 0) {
      toast({ title: t.notice, description: `${t.wait_before_next} ${Math.ceil(cooldownRemaining)} ${t.seconds}`, variant: "destructive" });
      return;
    }
    setTokenLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const tokenData = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData });
      if (!tokenData.success || !tokenData.token) throw new Error(tokenData.message || t.ad_error_desc);
      setPendingToken(tokenData.token);
      setShowAd(true);
    } catch (e: any) {
      toast({ title: t.ad_error || "خطأ", description: e?.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setTokenLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!pendingToken) return;
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const claimData = await claimMutation.mutateAsync({ telegramId: user.telegramId, token: pendingToken, initData, type: "points" });
      if (claimData.success) {
        const newBalance = Number(claimData.balance ?? user.balance + user.adReward);
        toast({ title: "🎉 أحسنت!", description: `ربحت +${claimData.reward} ${t.points}` });
        onReward({ balance: newBalance, todayAds: user.todayAds + 1, lastAdTime: Date.now() });
        setCooldownRemaining(user.adCooldown);
      } else {
        throw new Error(claimData.message || t.ad_error_desc);
      }
    } catch (error: any) {
      toast({ title: t.ad_error || "خطأ", description: error.message || t.ad_error_desc, variant: "destructive" });
    } finally {
      setPendingToken(null);
    }
  };

  const canWatch = cooldownRemaining === 0 && user.todayAds < 50;

  return (
    <>
      {showAd && (
        <AdOverlay
          seconds={15}
          rewardLabel={`+${user.adReward} ${t.points}`}
          onClaim={handleClaim}
          onClose={() => { setShowAd(false); setPendingToken(null); }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, padding: "14px 16px" }}>
            <p style={{ fontSize: 9, color: "rgba(245,158,11,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              {t.today_ads}
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#F59E0B", lineHeight: 1 }}>
              {Math.min(user.todayAds, 50)}<span style={{ fontSize: 13, color: "rgba(245,158,11,0.4)", marginLeft: 4 }}>/50</span>
            </p>
          </div>
          <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 18, padding: "14px 16px" }}>
            <p style={{ fontSize: 9, color: "rgba(139,92,246,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              {t.reward}
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: "#A78BFA", lineHeight: 1 }}>
              +{user.adReward}<span style={{ fontSize: 11, color: "rgba(139,92,246,0.4)", marginLeft: 4 }}>{t.points}</span>
            </p>
          </div>
        </div>

        {cooldownRemaining > 0 && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={16} style={{ color: "#F87171", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FCA5A5", marginBottom: 2 }}>{t.wait_before_next}</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: "#EF4444", fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(cooldownRemaining / 60).toString().padStart(2, "0")}:{Math.floor(cooldownRemaining % 60).toString().padStart(2, "0")}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleWatchAd}
          disabled={!canWatch || tokenLoading}
          style={{
            width: "100%", height: 72, borderRadius: 22, border: "none",
            background: canWatch && !tokenLoading
              ? "linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #D97706 100%)"
              : "rgba(255,255,255,0.05)",
            color: canWatch && !tokenLoading ? "#fff" : "rgba(255,255,255,0.2)",
            fontWeight: 900, fontSize: 17,
            cursor: canWatch && !tokenLoading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
            transition: "all 0.3s",
            boxShadow: canWatch && !tokenLoading
              ? "0 8px 32px rgba(245,158,11,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset"
              : "none",
            position: "relative", overflow: "hidden",
          }}
        >
          {/* shimmer sweep */}
          {canWatch && !tokenLoading && (
            <span style={{
              position: "absolute", top: 0, left: "-75%", width: "50%", height: "100%",
              background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
              animation: "shimmer 2.4s infinite",
              pointerEvents: "none",
            }} />
          )}

          {/* TV icon circle */}
          <span style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(0,0,0,0.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: canWatch && !tokenLoading ? "0 0 0 3px rgba(255,255,255,0.15)" : "none",
          }}>
            {tokenLoading ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </path>
              </svg>
            ) : cooldownRemaining > 0 ? (
              <Clock size={20} />
            ) : (
              /* TV screen with play triangle */
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="14" rx="3" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
                <line x1="8" y1="21" x2="16" y2="21" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="21" stroke="rgba(255,255,255,0.7)" strokeWidth="2"/>
                <polygon points="9,8 9,14 16,11" fill="#F59E0B"/>
              </svg>
            )}
          </span>

          <span style={{ letterSpacing: "0.02em" }}>
            {tokenLoading
              ? "جاري التحميل..."
              : cooldownRemaining > 0
                ? `${t.wait} ${Math.ceil(cooldownRemaining)} ${t.seconds}`
                : t.watch_ad}
          </span>

          <style>{`
            @keyframes shimmer { 0%{left:-75%} 100%{left:125%} }
          `}</style>
        </button>

        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "12px 16px" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.9, textAlign: "center" }}>
            📺 {t.watch_full_ad}<br/>
            ⏱️ {(t.ad_cooldown_info || "كل إعلان مرة كل {cooldown} ثانية").replace("{cooldown}", String(user.adCooldown))}<br/>
            🎯 {(t.daily_ads_limit || "الحد اليومي {limit} إعلان").replace("{limit}", "50")}
          </p>
        </div>
      </div>
    </>
  );
}
