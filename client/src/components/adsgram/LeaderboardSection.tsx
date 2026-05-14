import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

interface LeaderboardUser {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  totalEarned: number;
  balance: number;
}

interface LeaderboardSectionProps {
  myTelegramId: number;
  lang: Language;
}

const PODIUM_BG = [
  "linear-gradient(135deg,#F59E0B22,#FBBF2422)",
  "linear-gradient(135deg,#94A3B822,#CBD5E122)",
  "linear-gradient(135deg,#CD7C3222,#E8A55022)",
];
const PODIUM_BORDER = ["#F59E0B", "#94A3B8", "#CD7C32"];
const RANK_COLOR   = ["#F59E0B", "#94A3B8", "#CD7C32"];

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name || "?").slice(0, 1).toUpperCase();
  const colors = ["#8B5CF6","#EC4899","#3B82F6","#10B981","#F59E0B","#EF4444","#06B6D4"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(135deg, ${color}88, ${color}44)`,
      border: `2px solid ${color}66`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, fontWeight: 800, color: "#fff", flexShrink: 0,
    }}>{initials}</div>
  );
}

function displayName(u: LeaderboardUser) {
  return u.username ? "@" + u.username : (u.firstName || "User " + u.telegramId);
}

export default function LeaderboardSection({ myTelegramId, lang }: LeaderboardSectionProps) {
  const t = translations[lang];
  const [rows, setRows] = useState<LeaderboardUser[]>([]);
  const [myRank, setMyRank] = useState(0);
  const [loading, setLoading] = useState(true);

  const query = trpc.leaderboard.get.useQuery(
    { telegramId: myTelegramId },
    { staleTime: 30_000 }
  );

  useEffect(() => {
    if (query.data?.rows) {
      setRows(query.data.rows);
      setMyRank(query.data.myRank ?? 0);
      setLoading(false);
    }
  }, [query.data]);

  const refresh = () => {
    setLoading(true);
    query.refetch().finally(() => setLoading(false));
  };

  const top3 = rows.slice(0, 3);
  const rest  = rows.slice(3);
  const myRow = rows.find(r => r.telegramId === myTelegramId);
  const pts   = t.leaderboard_pts || "نقطة";
  const you   = t.leaderboard_you || "أنت";

  if (loading) return (
    <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: "100%", height: 52, borderRadius: 14, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
      ))}
      <style>{"@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}"}</style>
    </div>
  );

  /* ── Podium card ── */
  function PodiumCard({ u, idx }: { u: LeaderboardUser; idx: number }) {
    const size = idx === 0 ? 46 : 38;
    const medals = ["🥇","🥈","🥉"];
    return (
      <div style={{ flex: idx === 0 ? 1.2 : 1,
        background: PODIUM_BG[idx], borderRadius: idx === 0 ? 20 : 18,
        border: `1.5px solid ${PODIUM_BORDER[idx]}55`,
        padding: idx === 0 ? "20px 10px 14px" : "16px 10px 12px",
        boxShadow: idx === 0 ? `0 0 24px ${PODIUM_BORDER[idx]}33` : "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: idx === 0 ? 28 : 22 }}>{medals[idx]}</div>
        <Avatar name={displayName(u)} size={size} />
        <div style={{ fontSize: idx === 0 ? 12 : 11, fontWeight: 700, color: "#fff",
          textAlign: "center", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName(u)}
        </div>
        <div style={{ fontSize: idx === 0 ? 16 : 13, fontWeight: 900, color: RANK_COLOR[idx] }}>
          {u.totalEarned.toLocaleString()}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{pts}</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🏆</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
          {t.leaderboard_title || "المتصدرون"}
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          {t.leaderboard_sub || "أفضل 20 مستخدماً بإجمالي الأرباح"}
        </p>
      </div>

      {/* Podium — top 3 */}
      {top3.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
          {top3[1] && <PodiumCard u={top3[1]} idx={1} />}
          {top3[0] && <PodiumCard u={top3[0]} idx={0} />}
          {top3[2] && <PodiumCard u={top3[2]} idx={2} />}
        </div>
      )}

      {/* My rank badge (if outside top 3) */}
      {myRow && myRank > 3 && (
        <div style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(236,72,153,0.12))",
          border: "1.5px solid rgba(139,92,246,0.5)", borderRadius: 16, padding: "12px 16px",
          marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#A78BFA", minWidth: 32, textAlign: "center" }}>#{myRank}</div>
          <Avatar name={displayName(myRow)} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{you} — {displayName(myRow)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{myRow.totalEarned.toLocaleString()} {pts}</div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(139,92,246,0.8)", background: "rgba(139,92,246,0.15)", borderRadius: 8, padding: "3px 8px" }}>
            {t.leaderboard_me_badge || "مرتبتك"}
          </div>
        </div>
      )}

      {/* Ranks 4–20 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rest.map((u, i) => {
          const rank = i + 4;
          const isMe = u.telegramId === myTelegramId;
          return (
            <div key={u.telegramId} style={{
              background: isMe ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
              border: isMe ? "1.5px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 700,
                color: isMe ? "#A78BFA" : "rgba(255,255,255,0.35)", flexShrink: 0 }}>#{rank}</div>
              <Avatar name={displayName(u)} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700,
                  color: isMe ? "#C4B5FD" : "#fff",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName(u)}{isMe ? " (" + you + ")" : ""}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {u.totalEarned.toLocaleString()} {pts}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh */}
      <button onClick={refresh} style={{ width: "100%", marginTop: 20, padding: "12px",
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 14, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        🔄 {t.leaderboard_refresh || "تحديث"}
      </button>
    </div>
  );
}