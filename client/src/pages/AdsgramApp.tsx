import { useState, useEffect, useCallback } from "react";
  import { Home, Play, Gift, Users, Wallet, ChevronRight, History, Shield, Trophy } from "lucide-react";
  import { translations, type Language } from "@/lib/i18n";
  import WatchAdsSection from "@/components/adsgram/WatchAdsSection";
  import SpinWheelSection from "@/components/adsgram/SpinWheelSection";
  import WithdrawSection from "@/components/adsgram/WithdrawSection";
  import ReferralSection from "@/components/adsgram/ReferralSection";
  import DailyGiftBox from "@/components/adsgram/DailyGiftBox";
  import LeaderboardSection from "@/components/adsgram/LeaderboardSection";
  import { useToast } from "@/hooks/use-toast";
  import { trpc } from "@/lib/trpc";

  interface UserData {
    telegramId: number;
    balance: number;
    totalEarned: number;
    todayAds: number;
    spinsLeft: number;
    referralCode: string;
    adReward: number;
    minWithdraw: number;
    starsRate: number;
    adCooldown: number;
    adsgramBlockId: string;
    lastAdTime: number | null;
  }

  const DEFAULT_DEMO_USER: UserData = {
    telegramId: 123456789,
    balance: 0,
    totalEarned: 0,
    todayAds: 0,
    spinsLeft: 5,
    referralCode: "ref_NEW",
    adReward: 100,
    minWithdraw: 10000,
    starsRate: 1000,
    adCooldown: 30,
    adsgramBlockId: "",
    lastAdTime: null,
  };

  function ActivityLog({ telegramId, lang }: { telegramId: number; lang: Language }) {
    const { data: transactions, isLoading } = trpc.telegram.getTransactions.useQuery({ telegramId });
    const t = translations[lang];
    const typeIcons: Record<string, string> = { ad: "📺", spin: "🎡", referral: "👥", withdraw: "💸", bonus: "🎁", task: "✅" };
    const typeColors: Record<string, string> = { ad: "#F59E0B", spin: "#8B5CF6", referral: "#3B82F6", withdraw: "#EF4444", bonus: "#10B981", task: "#6366F1" };

    if (isLoading) return (
      <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
        <div style={{ width: 28, height: 28, border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#8B5CF6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
    if (!transactions?.length) return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.2)" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        <p style={{ fontSize: 12 }}>{t.no_activity}</p>
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {transactions.map((tx: any) => (
          <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${typeColors[tx.type] || "#6B7280"}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
              {typeIcons[tx.type] || "•"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", marginBottom: 2 }}>
                {tx.type === "ad" ? t.type_ad : tx.type === "spin" ? t.type_spin : tx.type === "referral" ? t.type_ref : tx.type === "withdraw" ? t.type_withdraw : t.type_reg}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{new Date(tx.createdAt).toLocaleString()}</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: tx.points >= 0 ? "#10B981" : "#EF4444", flexShrink: 0 }}>
              {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }

  export default function AdsgramApp() {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("home");
    const [lang, setLang] = useState<Language>("ar");
  const [displayName, setDisplayName] = useState("");
    const { toast } = useToast();
    const t = translations[lang];
    const getUserMutation = trpc.telegram.getUser.useMutation();

    const toggleLanguage = () => {
      const langs: Language[] = ["ar", "en", "ru"];
      setLang(langs[(langs.indexOf(lang) + 1) % langs.length]);
    };

    useEffect(() => { initializeTelegramApp(); }, []);

    const initializeTelegramApp = async () => {
      try {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          tg.ready(); tg.expand();
          const initData = tg.initData;
          const telegramUser = tg.initDataUnsafe?.user;
          const startParam = tg.initDataUnsafe?.start_param;
          if (!telegramUser) { setUser(DEFAULT_DEMO_USER); setLoading(false); return; }
          setDisplayName(telegramUser.first_name || telegramUser.username || "");
          try {
            const data = await getUserMutation.mutateAsync({
              telegramId: telegramUser.id,
              initData: initData || "",
              referredBy: startParam ? parseInt(startParam) : undefined,
            }).catch(() => ({ success: false, user: null }));
            if (data?.success && data.user) setUser(data.user as UserData);
            else setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id });
          } catch { setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id }); }
        } else { setUser(DEFAULT_DEMO_USER); }
      } catch { setUser(DEFAULT_DEMO_USER); }
      finally { setLoading(false); }
    };

    const refreshUser = useCallback(async (partialUpdate?: Partial<UserData>) => {
      if (partialUpdate) setUser(prev => prev ? { ...prev, ...partialUpdate } : prev);
      try {
        if (typeof window !== "undefined" && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          const telegramUser = tg.initDataUnsafe?.user;
          if (!telegramUser) return;
          const data = await getUserMutation.mutateAsync({ telegramId: telegramUser.id, initData: tg.initData || "" }).catch(() => ({ success: false, user: null }));
          if (data?.success && data.user) setUser(data.user as UserData);
        }
      } catch {}
    }, []);

    if (loading) return (
      <div style={{ minHeight: "100vh", background: "#070711", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid rgba(139,92,246,0.2)", borderTopColor: "#8B5CF6", borderRightColor: "#FFD700", animation: "spin 1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✨</div>
        </div>
        <p style={{ color: "rgba(139,92,246,0.8)", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em" }}>جاري التحميل...</p>
      </div>
    );

    const safeUser = user || DEFAULT_DEMO_USER;
    const ADMIN_ID = 5279238199;
    const isAdmin = safeUser.telegramId === ADMIN_ID;
    const starsEquivalent = Math.floor(safeUser.balance / safeUser.starsRate);

    const NAV = [
      { id: "home", icon: Home, label: t.home || "الرئيسية", emoji: "🏠" },
      { id: "ads", icon: Play, label: t.ads || "إعلانات", emoji: "📺" },
      { id: "spin", icon: Gift, label: t.spin || "العجلة", emoji: "🎡" },
      { id: "friends", icon: Users, label: "أصدقاء", emoji: "👥" },
      { id: "leaderboard", icon: Trophy, label: t.leaderboard || "المتصدرون", emoji: "🏆" },
      { id: "withdraw", icon: Wallet, label: t.withdraw || "السحب", emoji: "💸" },
      ...(isAdmin ? [{ id: "admin", icon: Shield, label: "إدارة", emoji: "🛡️" }] : []),
    ];

    const tabAccent: Record<string, string> = {
      home: "#8B5CF6", ads: "#F59E0B", spin: "#EC4899", friends: "#3B82F6", leaderboard: "#F59E0B", withdraw: "#10B981",
      admin: "#7C3AED"
    };
    const accent = tabAccent[activeTab];

    return (
      <div style={{ minHeight: "100vh", background: "#070711", color: "#fff", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", paddingBottom: 88, overflowX: "hidden" }}>
        {/* Animated orb background */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "16px 14px 0" }}>

          {/* HOME TAB */}
          {activeTab === "home" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
                <div>
                  <p style={{ fontSize: 10, color: "rgba(139,92,246,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>مرحباً بك</p>
                  <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #FFD700 0%, #F59E0B 50%, #EF4444 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {displayName} ✨
                  </h1>
                </div>
                <button onClick={toggleLanguage} style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 24, padding: "8px 14px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                  {lang === "ar" ? "🇸🇦" : lang === "en" ? "🇬🇧" : "🇷🇺"}
                </button>
              </div>

              {/* Balance Card */}
              <div style={{ borderRadius: 24, padding: "22px 22px 18px", position: "relative", overflow: "hidden", background: "linear-gradient(145deg, #130826 0%, #0b1240 50%, #150b2e 100%)", border: "1px solid rgba(139,92,246,0.28)", boxShadow: "0 8px 40px rgba(139,92,246,0.12), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
                <div className="shimmer-overlay" />
                <div style={{ position: "relative" }}>
                  <p style={{ fontSize: 9, color: "rgba(167,139,250,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 10 }}>{t.balance || "رصيدك الحالي"}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg, #FFE44D, #FFB800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 18px rgba(255,200,0,0.35))" }}>
                      {safeUser.balance.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 14, color: "rgba(255,215,0,0.4)", fontWeight: 700, letterSpacing: "0.05em" }}>PTS</span>
                  </div>
                  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", margin: "14px 0" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <p style={{ fontSize: 9, color: "rgba(167,139,250,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{t.total_earned || "المجموع"}</p>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#C4B5FD" }}>{safeUser.totalEarned.toLocaleString()}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 9, color: "rgba(167,139,250,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Telegram Stars</p>
                      <p style={{ fontSize: 18, fontWeight: 900, color: "#FFD700" }}>⭐ {starsEquivalent}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { emoji: "📺", label: t.today_ads || "إعلانات اليوم", value: safeUser.todayAds, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", tab: "ads" },
                  { emoji: "🎡", label: t.spins || "الدورات", value: `${safeUser.spinsLeft}/5`, color: "#EC4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.2)", tab: "spin" },
                ].map((s, i) => (
                  <button key={i} onClick={() => setActiveTab(s.tab)} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", transition: "transform 0.15s", width: "100%" }}>
                    <span style={{ fontSize: 26 }}>{s.emoji}</span>
                    <div>
                      <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{s.label}</p>
                      <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Daily Gift */}
              <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(139,92,246,0.12)", display: "flex", alignItems: "center", gap: 8, background: "rgba(139,92,246,0.08)" }}>
                  <span style={{ fontSize: 15 }}>🎁</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#C4B5FD", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.daily_gift_title || "الهدية اليومية"} — 10 نقاط</span>
                </div>
                <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
                  <DailyGiftBox
                    telegramId={safeUser.telegramId}
                    initData={typeof window !== "undefined" && window.Telegram?.WebApp ? window.Telegram.WebApp.initData || "" : ""}
                    lang={lang}
                    onClaim={(update) => setUser(prev => prev ? { ...prev, ...update } : prev)}
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>⚡ {t.tasks || "المهام السريعة"}</span>
                </div>
                {[
                  { emoji: "📺", label: t.watch_ad || "شاهد إعلاناً", sub: `+${safeUser.adReward} PTS`, color: "#F59E0B", tab: "ads" },
                  { emoji: "🎡", label: t.try_luck || "جرب حظك بالعجلة", sub: t.random_prize || "جائزة عشوائية", color: "#EC4899", tab: "spin" },
                  { emoji: "👥", label: "ادعُ صديقاً", sub: "مكافأة إضافية", color: "#3B82F6", tab: "friends" },
                ].map((a, i, arr) => (
                  <button key={i} onClick={() => setActiveTab(a.tab)} style={{ width: "100%", padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", color: "#fff", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{a.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{a.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: a.color, background: `${a.color}18`, borderRadius: 8, padding: "3px 9px" }}>{a.sub}</span>
                      <ChevronRight size={15} style={{ color: "rgba(255,255,255,0.2)" }} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Activity */}
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden", marginBottom: 4 }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                  <History size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.activity_log || "سجل النشاط"}</span>
                </div>
                <div style={{ padding: "12px 14px", maxHeight: 280, overflowY: "auto" }}>
                  <ActivityLog telegramId={safeUser.telegramId} lang={lang} />
                </div>
              </div>
            </div>
          )}

          {/* ADS TAB */}
          {activeTab === "ads" && (
            <div style={{ paddingTop: 6 }}>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#F59E0B" }}>📺 {t.watch_ad || "مشاهدة إعلان"}</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>اكسب {safeUser.adReward} نقطة لكل إعلان تشاهده</p>
              </div>
              <WatchAdsSection user={safeUser} lang={lang} onReward={(u) => refreshUser(u)} />
            </div>
          )}

          {/* SPIN TAB */}
          {activeTab === "spin" && (
            <div style={{ paddingTop: 6 }}>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#EC4899" }}>🎡 {t.spin_title || "عجلة الحظ"}</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>دوّر واربح حتى 1000 نقطة</p>
              </div>
              <SpinWheelSection user={safeUser} lang={lang} onReward={(u) => refreshUser(u)} onSwitchToAds={() => setActiveTab("ads")} />
            </div>
          )}

          {/* FRIENDS TAB */}
          {activeTab === "friends" && (
            <div style={{ paddingTop: 6 }}>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#3B82F6" }}>👥 ادعُ أصدقاء</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>اربح مكافأة مقابل كل صديق يسجل</p>
              </div>
              <ReferralSection user={safeUser} lang={lang} />
            </div>
          )}

          {/* WITHDRAW TAB */}
          {activeTab === "withdraw" && (
            <div style={{ paddingTop: 6 }}>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#10B981" }}>💸 {t.withdraw || "سحب الأرباح"}</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>حوّل نقاطك إلى ⭐ Telegram Stars</p>
              </div>
              <WithdrawSection user={safeUser} lang={lang} onSuccess={() => refreshUser()} />
            </div>
          )}
        </div>
            {/* LEADERBOARD TAB */}
            {activeTab === "leaderboard" && (
              <div style={{ paddingTop: 6 }}>
                <LeaderboardSection myTelegramId={safeUser.telegramId} lang={lang} />
              </div>
            )}

        {/* BOTTOM NAV */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "center", padding: "0 10px 10px" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "rgba(7,7,17,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 26, border: "1px solid rgba(255,255,255,0.07)", padding: "6px 4px", display: "flex", justifyContent: "space-around", boxShadow: "0 -2px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.08)" }}>
            {NAV.map(({ id, icon: Icon, label, emoji }) => {
              const active = activeTab === id;
              const c = tabAccent[id];
              return (
                <button key={id} onClick={() => { if (id === "admin") { window.location.href = "/admin"; return; } setActiveTab(id); }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 2px 6px", background: "none", border: "none", cursor: "pointer", position: "relative", borderRadius: 18, transition: "all 0.2s" }}>
                  {active && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 28, height: 2.5, borderRadius: 2, background: `linear-gradient(90deg, ${c}, ${c}aa)` }} />}
                  <div style={{ width: 40, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: active ? `${c}22` : "transparent", transition: "all 0.2s" }}>
                    <Icon size={19} style={{ color: active ? c : "rgba(255,255,255,0.28)", transition: "all 0.2s" }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? c : "rgba(255,255,255,0.28)", letterSpacing: "0.03em", transition: "all 0.2s", whiteSpace: "nowrap" }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  