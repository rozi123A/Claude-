import { translations, type Language } from "@/lib/i18n";

interface StreakBannerProps {
  streak: number;
  newBadges?: string[];
  lang: Language;
  onViewStats?: () => void;
}

const MILESTONES = [3, 7, 14, 30];
const BONUSES: Record<number, number> = { 3: 50, 7: 150, 14: 300, 30: 500 };

function nextMilestone(streak: number): { days: number; bonus: number } | null {
  const next = MILESTONES.find(m => m > streak);
  if (!next) return null;
  return { days: next, bonus: BONUSES[next] };
}

function streakColor(streak: number): string {
  if (streak >= 30) return "#FFD700";
  if (streak >= 14) return "#F59E0B";
  if (streak >= 7)  return "#EF4444";
  if (streak >= 3)  return "#F97316";
  return "#8B5CF6";
}

function streakEmoji(streak: number): string {
  if (streak >= 30) return "🏆";
  if (streak >= 14) return "💪";
  if (streak >= 7)  return "🔥";
  if (streak >= 3)  return "⚡";
  return "✨";
}

export default function StreakBanner({ streak, newBadges = [], lang, onViewStats }: StreakBannerProps) {
  const t = translations[lang];
  const color = streakColor(streak);
  const next = nextMilestone(streak);
  const progress = next ? ((streak % next.days) / next.days) * 100 : 100;
  const showNewBadge = newBadges.length > 0;

  return (
    <button
      onClick={onViewStats}
      style={{
        width: "100%",
        background: `linear-gradient(135deg, ${color}12, ${color}06)`,
        border: `1px solid ${color}30`,
        borderRadius: 18,
        padding: "12px 16px",
        cursor: onViewStats ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "right" as const,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, height: "100%",
        width: `${progress}%`,
        background: `linear-gradient(90deg, ${color}08, ${color}15)`,
        transition: "width 1s ease",
      }} />

      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0, zIndex: 1,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
        boxShadow: `0 0 12px ${color}30`,
      }}>
        {streakEmoji(streak)}
      </div>

      <div style={{ flex: 1, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color }}>
            {streak} {(t as any).streak_days || "يوم"}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
            — {(t as any).streak_title || "السلسلة اليومية"}
          </span>
          {showNewBadge && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: "#FFD700",
              background: "rgba(255,215,0,0.12)", borderRadius: 6,
              padding: "2px 6px", border: "1px solid rgba(255,215,0,0.3)",
            }}>
              🎖 {newBadges.length} {lang === "ar" ? "جديد" : lang === "ru" ? "новых" : "new"}
            </span>
          )}
        </div>
        {next ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: `linear-gradient(90deg, ${color}aa, ${color})`,
                width: `${progress}%`,
                transition: "width 1s ease",
              }} />
            </div>
            <span style={{ fontSize: 10, color: color, fontWeight: 700, flexShrink: 0 }}>
              +{next.bonus} @ {next.days}d
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: "#FFD700", fontWeight: 700 }}>
            🏆 {lang === "ar" ? "أقصى مستوى!" : lang === "ru" ? "Макс. уровень!" : "Max level!"}
          </span>
        )}
      </div>

      {onViewStats && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, zIndex: 1 }}>
          <path d="M9 18L15 12L9 6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
