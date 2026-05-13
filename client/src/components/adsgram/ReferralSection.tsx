import { useState } from "react";
  import { Share2, Copy, Check, Users, TrendingUp } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { translations, type Language } from "@/lib/i18n";
  import { trpc } from "@/lib/trpc";

  interface UserData { telegramId: number; referralCode: string; }
  interface ReferralSectionProps { user: UserData; lang: Language; }

  export default function ReferralSection({ user, lang }: ReferralSectionProps) {
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();
    const t = translations[lang];
    const referralLink = `https://t.me/ads_reward123_bot?start=${user.telegramId}`;
    const { data: stats } = trpc.telegram.getReferralStats.useQuery({ telegramId: user.telegramId }, { refetchInterval: 30000 });

    const handleCopy = () => {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: t.copied, description: t.referral_link });
      setTimeout(() => setCopied(false), 2000);
    };
    const handleShare = () => {
      const text = `🎮 انضم معي في لعبة الأرباح! اربح نقاط وحوّلها لـ Telegram Stars⭐\n\n${referralLink}`;
      if (navigator.share) navigator.share({ title: "Start Coin✨", text, url: referralLink });
      else { navigator.clipboard.writeText(text); toast({ title: t.copied }); }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { icon: <Users size={22} />, color: "#3B82F6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", label: t.referral_count || "الأصدقاء", value: stats?.count ?? 0 },
            { icon: <TrendingUp size={22} />, color: "#FFD700", bg: "rgba(255,215,0,0.08)", border: "rgba(255,215,0,0.2)", label: t.referral_earned || "نقاطك من الإحالة", value: (stats?.totalEarned ?? 0).toLocaleString() },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 20, padding: 20, textAlign: "center" }}>
              <div style={{ color: s.color, marginBottom: 8, display: "flex", justifyContent: "center" }}>{s.icon}</div>
              <p style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1, marginBottom: 6 }}>{s.value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 20, padding: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#A78BFA", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>🎯 {t.rewards || "كيف تربح؟"}</p>
          {[
            { icon: "💰", text: t.friend_join || "نقاط فورية عند تسجيل صديقك" },
            { icon: "🔄", text: t.friend_earnings || "مكافأة إضافية من إعلانات صديقك" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 1 ? 10 : 0 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{r.text}</p>
            </div>
          ))}
        </div>

        {/* Link */}
        <div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{t.referral_link || "رابط الدعوة"}</p>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#60A5FA", wordBreak: "break-all", lineHeight: 1.5 }}>{referralLink}</p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={handleCopy} style={{ height: 54, borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
            {copied ? <Check size={18} style={{ color: "#10B981" }} /> : <Copy size={18} />}
            {copied ? t.copied || "تم النسخ!" : t.copy || "نسخ"}
          </button>
          <button onClick={handleShare} style={{ height: 54, borderRadius: 18, border: "none", background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(59,130,246,0.35)" }}>
            <Share2 size={18} />
            {t.share || "مشاركة"}
          </button>
        </div>
      </div>
    );
  }
  