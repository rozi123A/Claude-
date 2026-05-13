import { useState } from "react";
  import { Send, Star, AlertCircle } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { trpc } from "@/lib/trpc";
  import { translations, type Language } from "@/lib/i18n";

  interface UserData { telegramId: number; balance: number; minWithdraw: number; starsRate: number; }
  interface WithdrawSectionProps { user: UserData; lang: Language; onSuccess: () => void; }

  export default function WithdrawSection({ user, lang, onSuccess }: WithdrawSectionProps) {
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const t = translations[lang];
    const withdrawMutation = trpc.withdraw.request.useMutation();

    const numAmount = parseFloat(amount) || 0;
    const starsWorth = Math.floor(numAmount / user.starsRate);
    const canWithdraw = numAmount >= user.minWithdraw && numAmount <= user.balance;

    const handleWithdraw = async () => {
      if (!canWithdraw) return;
      setLoading(true);
      try {
        const result = await withdrawMutation.mutateAsync({
          telegramId: user.telegramId,
          amount: numAmount,
          initData: window.Telegram?.WebApp?.initData || "",
        });
        if (result.success) {
          toast({ title: t.withdraw_success || "طلب مُرسَل!", description: t.withdraw_pending || "سيتم مراجعة طلبك قريباً" });
          setAmount("");
          onSuccess();
        } else {
          toast({ title: t.error || "خطأ", description: result.message || t.withdraw_error || "فشل الطلب", variant: "destructive" });
        }
      } catch (e: any) {
        toast({ title: t.error || "خطأ", description: e.message || t.withdraw_error || "فشل الطلب", variant: "destructive" });
      } finally { setLoading(false); }
    };

    const pct = Math.min((user.balance / user.minWithdraw) * 100, 100);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Balance overview */}
        <div style={{ borderRadius: 22, padding: 20, background: "linear-gradient(145deg, #071a14, #051210)", border: "1px solid rgba(16,185,129,0.25)", boxShadow: "0 4px 30px rgba(16,185,129,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>{t.balance || "رصيدك"}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#34D399,#10B981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user.balance.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: "rgba(16,185,129,0.45)", fontWeight: 700 }}>PTS</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>يعادل</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#FFD700" }}>⭐ {Math.floor(user.balance / user.starsRate)}</p>
            </div>
          </div>

          {/* Progress to min withdraw */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{t.min_withdraw || "الحد الأدنى للسحب"}</p>
              <p style={{ fontSize: 10, fontWeight: 800, color: pct >= 100 ? "#10B981" : "#FFD700" }}>{user.minWithdraw.toLocaleString()} PTS</p>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FFD700)", borderRadius: 6, transition: "width 0.6s ease", boxShadow: pct >= 100 ? "0 0 12px rgba(16,185,129,0.5)" : "none" }} />
            </div>
          </div>
        </div>

        {user.balance < user.minWithdraw && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={20} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D", marginBottom: 3 }}>{t.not_enough_balance || "الرصيد غير كافٍ"}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>تحتاج {(user.minWithdraw - user.balance).toLocaleString()} نقطة إضافية للوصول إلى الحد الأدنى</p>
            </div>
          </div>
        )}

        {/* Input */}
        {user.balance >= user.minWithdraw && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{t.amount || "المبلغ (بالنقاط)"}</p>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder={`الحد الأدنى ${user.minWithdraw.toLocaleString()}`}
                  style={{ width: "100%", height: 54, borderRadius: 16, padding: "0 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${numAmount > 0 && !canWithdraw ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {numAmount > 0 && (
                <p style={{ fontSize: 11, color: "#A78BFA", fontWeight: 600, marginTop: 6 }}>⭐ = {starsWorth} Telegram Stars</p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[user.minWithdraw, Math.floor(user.balance / 2), user.balance].map((v, i) => (
                <button key={i} onClick={() => setAmount(String(v))} style={{ height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {i === 0 ? "الحد الأدنى" : i === 1 ? "النصف" : "الكل"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {user.balance >= user.minWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={!canWithdraw || loading}
            style={{
              width: "100%", height: 60, borderRadius: 20, border: "none",
              cursor: canWithdraw && !loading ? "pointer" : "not-allowed",
              fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              background: canWithdraw && !loading ? "linear-gradient(135deg, #10B981, #059669)" : "rgba(255,255,255,0.05)",
              color: canWithdraw && !loading ? "#fff" : "rgba(255,255,255,0.25)",
              boxShadow: canWithdraw && !loading ? "0 6px 24px rgba(16,185,129,0.35)" : "none",
              transition: "all 0.3s",
            }}
          >
            {loading ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Send size={20} />}
            {loading ? "جاري الإرسال..." : `${t.withdraw_btn || "طلب سحب"} ⭐ ${starsWorth > 0 ? starsWorth : "?"} Stars`}
          </button>
        )}

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "معدل التحويل", value: `${user.starsRate} PTS = ⭐1`, color: "#A78BFA" },
            { label: "الحد الأدنى", value: `${user.minWithdraw.toLocaleString()} PTS`, color: "#60A5FA" },
          ].map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  