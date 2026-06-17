import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

interface StatsSectionProps {
  telegramId: number;
  initData: string;
  lang: Language;
  streak: number;
  badges: string[];
}

const ALL_BADGES = [
  { id: "first_ad",        emoji: "📺", nameKey: "badge_first_ad",        descKey: "badge_first_ad_desc" },
  { id: "ad_fan",          emoji: "🎬", nameKey: "badge_ad_fan",          descKey: "badge_ad_fan_desc" },
  { id: "ad_star",         emoji: "⭐", nameKey: "badge_ad_star",         descKey: "badge_ad_star_desc" },
  { id: "recruiter",       emoji: "👥", nameKey: "badge_recruiter",       descKey: "badge_recruiter_desc" },
  { id: "super_recruiter", emoji: "🤝", nameKey: "badge_super_recruiter", descKey: "badge_super_recruiter_desc" },
  { id: "streak_3",        emoji: "🔥", nameKey: "badge_streak_3",        descKey: "badge_streak_3_desc" },
  { id: "streak_7",        emoji: "💪", nameKey: "badge_streak_7",        descKey: "badge_streak_7_desc" },
  { id: "streak_30",       emoji: "🏆", nameKey: "badge_streak_30",       descKey: "badge_streak_30_desc" },
];

function streakColor(s: number) {
  if (s >= 30) return "#FFD700";
  if (s >= 14) return "#F59E0B";
  if (s >= 7)  return "#EF4444";
  if (s >= 3)  return "#F97316";
  return "#8B5CF6";
}

export default function StatsSection({ telegramId, initData, lang, streak, badges }: StatsSectionProps) {
  const t = translations[lang] as any;
  const { data, isLoading } = trpc.stats.get.useQuery(
    { telegramId, initData },
    { enabled: !!initData, refetchOnWindowFocus: false }
  );

  const displayStreak = data?.streak ?? streak;
  const displayBadges: string[] = data?.badges ?? badges;
  const color = streakColor(displayStreak);

  const BONUS_MILESTONES = [
    { days: 3,  bonus: 50,  key: "streak_bonus_3" },
    { days: 7,  bonus: 150, key: "streak_bonus_7" },
    { days: 14, bonus: 300, key: "streak_bonus_14" },
    { days: 30, bonus: 500, key: "streak_bonus_30" },
  ];

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#8B5CF6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const last7 = data?.last7Days ?? [];
  const lastLogin = data?.lastLoginDate ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Streak Card ── */}
      <div style={{
        background: `linear-gradient(145deg, ${color}12, ${color}06)`,
        border: `1px solid ${color}35`,
        borderRadius: 22,
        padding: "20px 18px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${color}08`, filter: "blur(20px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, position: "relative" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: `${color}18`, border: `2px solid ${color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
            boxShadow: `0 0 20px ${color}30`,
          }}>
            {displayStreak >= 30 ? "🏆" : displayStreak >= 14 ? "💪" : displayStreak >= 7 ? "🔥" : displayStreak >= 3 ? "⚡" : "✨"}
          </div>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              {t.streak_title}
            </p>
            <p style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1, margin: 0 }}>
              {displayStreak} <span style={{ fontSize: 14, fontWeight: 600, color: `${color}aa` }}>{t.streak_days}</span>
            </p>
          </div>
        </div>

        {/* 7-day calendar */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {last7.map((dateStr, i) => {
            const isToday = dateStr === new Date().toISOString().split("T")[0];
            const isActive = dateStr <= lastLogin && dateStr >= (() => {
              const d = new Date(lastLogin);
              d.setDate(d.getDate() - (displayStreak - 1));
              return d.toISOString().split("T")[0];
            })();
            const dayLabel = ["S","M","T","W","T","F","S"][new Date(dateStr + "T12:00:00").getDay()];
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: isActive ? `linear-gradient(135deg, ${color}cc, ${color})` : isToday ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                  border: isToday ? `1px solid ${color}50` : "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isActive ? 16 : 11,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.2)",
                  boxShadow: isActive ? `0 2px 10px ${color}40` : "none",
                }}>
                  {isActive ? "✓" : isToday ? "●" : ""}
                </div>
                <span style={{ fontSize: 9, color: isActive ? color : "rgba(255,255,255,0.2)", fontWeight: isActive ? 800 : 500 }}>
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Milestone bonuses */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {BONUS_MILESTONES.map(m => {
            const reached = displayStreak >= m.days;
            return (
              <div key={m.days} style={{
                flex: 1, minWidth: 60, padding: "7px 8px", borderRadius: 10, textAlign: "center",
                background: reached ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${reached ? color + "40" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div style={{ fontSize: 9, color: reached ? color : "rgba(255,255,255,0.2)", fontWeight: 800 }}>
                  {m.days}d
                </div>
                <div style={{ fontSize: 10, color: reached ? "#FFD700" : "rgba(255,255,255,0.15)", fontWeight: 900 }}>
                  +{m.bonus}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { emoji: "📺", label: t.stats_ads_watched,  value: data?.adCount ?? 0,          color: "#F59E0B" },
          { emoji: "👥", label: t.stats_referrals,    value: data?.referralCount ?? 0,     color: "#3B82F6" },
          { emoji: "📅", label: t.stats_days_active,  value: data?.daysSinceJoin ?? 0,     color: "#8B5CF6" },
          { emoji: "🏅", label: t.stats_total_earned, value: (data?.totalEarned ?? 0).toLocaleString(), color: "#10B981" },
        ].map((s, i) => (
          <div key={i} style={{
            background: `${s.color}08`, border: `1px solid ${s.color}20`,
            borderRadius: 18, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Badges Grid ── */}
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 22, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 6 }}>
            🎖 {t.badges_title}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>
            {displayBadges.length} / {ALL_BADGES.length}
          </span>
        </div>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {ALL_BADGES.map(badge => {
            const earned = displayBadges.includes(badge.id);
            return (
              <div key={badge.id} style={{
                padding: "12px 12px",
                borderRadius: 16,
                background: earned ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${earned ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.04)"}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: earned ? 1 : 0.45,
                filter: earned ? "none" : "grayscale(0.8)",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: earned ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                  boxShadow: earned ? "0 0 12px rgba(255,215,0,0.2)" : "none",
                }}>
                  {earned ? badge.emoji : "🔒"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: earned ? "#FFD700" : "rgba(255,255,255,0.3)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t[badge.nameKey] || badge.id}
                  </p>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", lineHeight: 1.3 }}>
                    {t[badge.descKey] || ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
