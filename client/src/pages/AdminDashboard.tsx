import { useState, useEffect } from "react";
  import { trpc } from "@/lib/trpc";
  import { useToast } from "@/hooks/use-toast";
  import {
    Users, TrendingUp, Wallet, Send, Shield, BarChart3,
    Eye, EyeOff, RefreshCw, Ban, CheckCircle,
    Megaphone, LogOut, MessageCircle, XCircle
  } from "lucide-react";

  const fmtN = (n: number) => n?.toLocaleString() ?? "0";
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, overflow: "hidden", ...style
      }}>
        {children}
      </div>
    );
  }

  function CardHead({ icon, title, color = "#A78BFA" }: { icon: React.ReactNode; title: string; color?: string }) {
    return (
      <div style={{
        padding: "13px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,255,255,0.02)"
      }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
      </div>
    );
  }

  function StatCard({ emoji, label, value, color, sub }: {
    emoji: string; label: string; value: string | number; color: string; sub?: string
  }) {
    return (
      <div style={{
        background: `${color}0e`, border: `1px solid ${color}28`,
        borderRadius: 18, padding: "16px 16px 14px",
        display: "flex", flexDirection: "column", gap: 4
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 26 }}>{emoji}</span>
          {sub && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "2px 8px" }}>
              {sub}
            </span>
          )}
        </div>
        <p style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginTop: 6 }}>
          {typeof value === "number" ? fmtN(value) : value}
        </p>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </p>
      </div>
    );
  }

  const SPINNER = (
    <div style={{
      width: 28, height: 28,
      border: "3px solid rgba(139,92,246,0.3)",
      borderTopColor: "#8B5CF6",
      borderRadius: "50%", animation: "spin 0.9s linear infinite"
    }} />
  );

  export default function AdminDashboard() {
    const [secret, setSecret] = useState(() => sessionStorage.getItem("adminSecret") || "");
    const [showPass, setShowPass] = useState(false);
    const [authed, setAuthed] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [tab, setTab] = useState<"stats" | "users" | "withdrawals" | "broadcast">("stats");
    const [userPage, setUserPage] = useState(1);
    const [broadcastMsg, setBroadcastMsg] = useState("");
    const [broadcastTarget, setBroadcastTarget] = useState<"all" | "inactive">("all");
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [withdrawFilter, setWithdrawFilter] = useState("pending");
    const [withdrawActionLoading, setWithdrawActionLoading] = useState<number | null>(null);
    const { toast } = useToast();

    const verifyMut = trpc.admin.verify.useMutation();
      const broadcastMut = trpc.admin.broadcast.useMutation();
      const updateWithdrawMut = trpc.admin.adminUpdate.useMutation();

      // Auto-auth when opened from Telegram as admin
      useEffect(() => {
        if (authed) return;
        try {
          const tg = (window as any)?.Telegram?.WebApp;
          if (!tg) return;
          const tgUser = tg.initDataUnsafe?.user;
          if (tgUser?.id === 5279238199) {
            const autoSecret = sessionStorage.getItem("adminSecret") || "12345";
            verifyMut.mutateAsync({ secret: autoSecret }).then(res => {
              if (res.success) {
                sessionStorage.setItem("adminSecret", autoSecret);
                setSecret(autoSecret);
                setAuthed(true);
              }
            }).catch(() => {});
          }
        } catch {}
      }, []);
    const banMut = trpc.admin.banUser.useMutation();

    const statsQ = trpc.admin.getStats.useQuery({ secret }, { enabled: authed, refetchInterval: 30000 });
    const usersQ = trpc.admin.getUsers.useQuery({ secret, page: userPage }, { enabled: authed && tab === "users" });
    const withdrawQ = trpc.admin.getWithdrawals.useQuery(
      { secret, status: withdrawFilter },
      { enabled: authed && tab === "withdrawals" }
    );

    const handleLogin = async () => {
      if (!secret.trim()) return;
      setAuthLoading(true);
      try {
        const res = await verifyMut.mutateAsync({ secret });
        if (res.success) {
          sessionStorage.setItem("adminSecret", secret);
          setAuthed(true);
          toast({ title: "✅ تم الدخول", description: "مرحباً بك في لوحة التحكم" });
        } else {
          toast({ title: "❌ رمز خاطئ", description: "كلمة المرور غير صحيحة", variant: "destructive" });
        }
      } catch {
        toast({ title: "خطأ", description: "تعذر الاتصال بالخادم", variant: "destructive" });
      } finally {
        setAuthLoading(false);
      }
    };

    const handleLogout = () => {
      sessionStorage.removeItem("adminSecret");
      setAuthed(false);
      setSecret("");
    };

    const handleBroadcast = async () => {
      if (!broadcastMsg.trim()) return;
      setBroadcastLoading(true);
      try {
        const res = await broadcastMut.mutateAsync({ secret, message: broadcastMsg, targetGroup: broadcastTarget });
        if (res.success) {
          toast({ title: "✅ تم الإرسال", description: `أُرسلت الرسالة إلى ${res.sent} من ${res.total} مستخدم` });
          setBroadcastMsg("");
        } else {
          toast({ title: "فشل", description: res.message || "خطأ", variant: "destructive" });
        }
      } catch {
        toast({ title: "خطأ", description: "فشل الإرسال", variant: "destructive" });
      } finally {
        setBroadcastLoading(false);
      }
    };

    const handleBan = async (telegramId: number, ban: boolean) => {
      try {
        await banMut.mutateAsync({ secret, telegramId, ban });
        toast({ title: ban ? "🚫 تم الحظر" : "✅ تم رفع الحظر" });
        usersQ.refetch();
      } catch {
        toast({ title: "خطأ", variant: "destructive" });
      }
    };

    const handleWithdrawAction = async (withdrawalId: number, status: "approved" | "rejected", note?: string) => {
      setWithdrawActionLoading(withdrawalId);
      try {
        const res = await updateWithdrawMut.mutateAsync({ secret, withdrawalId, status, note });
        if (res.success) {
          toast({ title: status === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض", description: "تم تحديث حالة الطلب" });
          withdrawQ.refetch();
        } else {
          toast({ title: "خطأ", description: (res as any).message || "فشل التحديث", variant: "destructive" });
        }
      } catch {
        toast({ title: "خطأ", description: "تعذر الاتصال بالخادم", variant: "destructive" });
      } finally {
        setWithdrawActionLoading(null);
      }
    };

    const openTelegramChat = (telegramId: number) => {
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg) {
        tg.openTelegramLink(`https://t.me/@id${telegramId}`);
      } else {
        window.open(`tg://user?id=${telegramId}`, "_blank");
      }
    };

    /* Block non-admin Telegram users */
      const tgRuntime = typeof window !== "undefined" && !!(window as any)?.Telegram?.WebApp?.initData;
      const tgUserId = tgRuntime ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id : null;
      const isTelegramNonAdmin = tgRuntime && tgUserId !== null && tgUserId !== 5279238199;

      if (isTelegramNonAdmin) {
        return (
          <div style={{ minHeight: "100vh", background: "#070711", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>غير مصرح</p>
            </div>
          </div>
        );
      }

      /* ================== LOGIN SCREEN ================== */
      if (!authed) {
      return (
        <div style={{
          minHeight: "100vh", background: "#070711",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div className="orb orb-1" />
            <div className="orb orb-2" />
          </div>
          <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24,
                background: "linear-gradient(135deg,#7C3AED,#4F46E5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(124,58,237,0.4)", fontSize: 32
              }}>🛡️</div>
              <h1 style={{
                fontSize: 26, fontWeight: 900, margin: 0,
                background: "linear-gradient(135deg,#A78BFA,#60A5FA)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>لوحة التحكم</h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, fontWeight: 600 }}>
                منطقة مقيّدة — للمشرفين فقط
              </p>
            </div>

            {/* Login Card */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: 24, padding: 28
            }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                كلمة المرور السرية
              </p>
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="أدخل كلمة مرور الأدمن..."
                  style={{
                    width: "100%", height: 52, borderRadius: 16,
                    padding: "0 48px 0 16px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(139,92,246,0.25)",
                    color: "#fff", fontSize: 14, fontWeight: 600,
                    outline: "none", boxSizing: "border-box"
                  }}
                />
                <button
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: "absolute", left: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.4)", padding: 0
                  }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                onClick={handleLogin}
                disabled={authLoading || !secret.trim()}
                style={{
                  width: "100%", height: 52, borderRadius: 18, border: "none",
                  background: secret.trim() ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "rgba(255,255,255,0.05)",
                  color: secret.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                  fontWeight: 900, fontSize: 15,
                  cursor: secret.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.3s",
                  boxShadow: secret.trim() ? "0 6px 24px rgba(124,58,237,0.35)" : "none"
                }}
              >
                {authLoading
                  ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  : <Shield size={20} />
                }
                {authLoading ? "جاري التحقق..." : "دخول"}
              </button>
              <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 16, lineHeight: 1.6 }}>
                يتطلب الدخول كلمة المرور المضبوطة في متغير ADMIN_SECRET على الخادم
              </p>
            </div>
          </div>
        </div>
      );
    }

    /* ================== DASHBOARD ================== */
    const stats = statsQ.data?.data;

    const TABS = [
      { id: "stats" as const, icon: <BarChart3 size={16} />, label: "الإحصائيات" },
      { id: "users" as const, icon: <Users size={16} />, label: "المستخدمون" },
      { id: "withdrawals" as const, icon: <Wallet size={16} />, label: "السحوبات" },
      { id: "broadcast" as const, icon: <Megaphone size={16} />, label: "البث" },
    ];

    return (
      <div style={{
        minHeight: "100vh", background: "#070711",
        color: "#fff", fontFamily: "'Inter',system-ui,sans-serif",
        padding: "0 14px 32px"
      }}>
        <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          <div className="orb orb-1" />
          <div className="orb orb-2" />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 24px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg,#7C3AED,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#A78BFA,#60A5FA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>لوحة التحكم</h1>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, margin: 0 }}>Admin Panel</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { window.location.href = "/"; }}
                  style={{ height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", padding: "0 14px", display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12 }}
                >
                  ← رجوع
                </button>
                <button
                  onClick={() => statsQ.refetch()}
                style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleLogout}
                style={{ height: 40, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", cursor: "pointer", padding: "0 16px", display: "flex", alignItems: "center", gap: 8, color: "#FCA5A5", fontWeight: 700, fontSize: 12 }}
              >
                <LogOut size={15} /> خروج
              </button>
            </div>
          </div>

          {/* Nav Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, padding: "6px", background: "rgba(255,255,255,0.03)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.06)" }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, height: 40, borderRadius: 13, border: "none",
                  background: tab === t.id ? "rgba(139,92,246,0.25)" : "transparent",
                  color: tab === t.id ? "#A78BFA" : "rgba(255,255,255,0.35)",
                  fontWeight: 800, fontSize: 11, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "all 0.2s",
                  boxShadow: tab === t.id ? "0 0 0 1px rgba(139,92,246,0.3)" : "none"
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ===== STATS TAB ===== */}
          {tab === "stats" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {statsQ.isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>{SPINNER}</div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                    <StatCard emoji="👥" label="إجمالي المستخدمين" value={stats?.totalUsers ?? 0} color="#60A5FA" />
                    <StatCard emoji="🚫" label="المحظورون" value={stats?.bannedUsers ?? 0} color="#EF4444" />
                    <StatCard emoji="💰" label="النقاط الموزّعة" value={stats?.totalPointsDistributed ?? 0} color="#FFD700" />
                    <StatCard emoji="⏳" label="طلبات السحب" value={stats?.pendingWithdrawals ?? 0} color="#F59E0B"
                      sub={stats?.pendingStars ? `⭐${fmtN(stats.pendingStars)}` : undefined}
                    />
                    <StatCard emoji="📺" label="إعلانات مُشاهَدة" value={stats?.totalAdViews ?? 0} color="#10B981" />
                    <StatCard emoji="🎡" label="دورات العجلة" value={stats?.totalSpins ?? 0} color="#EC4899" />
                  </div>
                  <Card>
                    <CardHead icon={<TrendingUp size={16} />} title="ملخص النشاط" color="#10B981" />
                    <div style={{ padding: 16 }}>
                      {[
                        { label: "إجمالي المعاملات", value: fmtN(stats?.totalTransactions ?? 0), color: "#A78BFA" },
                        { label: "طلبات السحب المُنجزة", value: fmtN(stats?.totalWithdrawals ?? 0), color: "#60A5FA" },
                        { label: "إجمالي المستخدمين المسجلين", value: fmtN(stats?.totalUsers ?? 0), color: "#10B981" },
                      ].map((row, i, arr) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{row.label}</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: row.color }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* ===== USERS TAB ===== */}
          {tab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card>
                <CardHead icon={<Users size={16} />} title={`المستخدمون — صفحة ${userPage}`} color="#60A5FA" />
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {usersQ.isLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>{SPINNER}</div>
                  ) : !usersQ.data?.users?.length ? (
                    <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 24, fontSize: 13 }}>لا يوجد مستخدمون</p>
                  ) : usersQ.data.users.map((u: any) => (
                    <div key={u.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px",
                      background: u.isBanned === "true" ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.025)",
                      border: `1px solid ${u.isBanned === "true" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)"}`,
                      borderRadius: 14
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {u.firstName?.[0] || u.username?.[0] || "👤"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>
                            {u.firstName || ""} {u.lastName || ""}
                          </p>
                          {u.isBanned === "true" && (
                            <span style={{ fontSize: 9, color: "#EF4444", background: "rgba(239,68,68,0.15)", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>محظور</span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                          {u.username ? `@${u.username} · ` : ""}{u.telegramId} · 💰 {fmtN(Number(u.balance))} نقطة
                        </p>
                      </div>
                      <button
                        onClick={() => handleBan(u.telegramId, u.isBanned !== "true")}
                        style={{
                          height: 32, borderRadius: 10, border: "none",
                          background: u.isBanned === "true" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
                          color: u.isBanned === "true" ? "#34D399" : "#FCA5A5",
                          fontWeight: 700, fontSize: 11, cursor: "pointer",
                          padding: "0 12px", display: "flex", alignItems: "center", gap: 6
                        }}
                      >
                        {u.isBanned === "true" ? <CheckCircle size={14} /> : <Ban size={14} />}
                        {u.isBanned === "true" ? "رفع الحظر" : "حظر"}
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}
                    style={{ flex: 1, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: userPage === 1 ? "rgba(255,255,255,0.2)" : "#fff", fontWeight: 700, fontSize: 12, cursor: userPage === 1 ? "not-allowed" : "pointer" }}>← السابق</button>
                  <div style={{ height: 38, padding: "0 16px", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800, color: "#A78BFA" }}>صفحة {userPage}</div>
                  <button onClick={() => setUserPage(p => p + 1)} disabled={(usersQ.data?.users?.length ?? 0) < 20}
                    style={{ flex: 1, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: (usersQ.data?.users?.length ?? 0) < 20 ? "rgba(255,255,255,0.2)" : "#fff", fontWeight: 700, fontSize: 12, cursor: (usersQ.data?.users?.length ?? 0) < 20 ? "not-allowed" : "pointer" }}>التالي →</button>
                </div>
              </Card>
            </div>
          )}

          {/* ===== WITHDRAWALS TAB ===== */}
          {tab === "withdrawals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {([ ["pending","⏳ معلقة"], ["approved","✅ موافق"], ["rejected","❌ مرفوضة"] ] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setWithdrawFilter(v)}
                    style={{ flex: 1, height: 38, borderRadius: 12, border: `1px solid ${withdrawFilter === v ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`, background: withdrawFilter === v ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)", color: withdrawFilter === v ? "#A78BFA" : "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
              <Card>
                <CardHead icon={<Wallet size={16} />} title="طلبات السحب" color="#F59E0B" />
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {withdrawQ.isLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>{SPINNER}</div>
                  ) : !withdrawQ.data?.withdrawals?.length ? (
                    <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 24, fontSize: 13 }}>لا توجد طلبات</p>
                  ) : withdrawQ.data.withdrawals.map((w: any) => (
                    <div key={w.id} style={{ padding: "14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#E2E8F0", marginBottom: 2 }}>
                            {w.firstName ? `${w.firstName}${w.lastName ? " " + w.lastName : ""}` : `🆔 ${w.telegramId}`}
                          </p>
                          {w.username && <p style={{ fontSize: 11, color: "#60A5FA", marginBottom: 2 }}>@{w.username}</p>}
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{fmtDate(w.createdAt)}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 16, fontWeight: 900, color: "#FFD700" }}>⭐ {fmtN(Number(w.stars))}</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{fmtN(Number(w.amount))} نقطة</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                          background: w.status === "pending" ? "rgba(245,158,11,0.15)" : w.status === "approved" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: w.status === "pending" ? "#FCD34D" : w.status === "approved" ? "#34D399" : "#FCA5A5"
                        }}>
                          {w.status === "pending" ? "⏳ معلق" : w.status === "approved" ? "✅ موافق" : "❌ مرفوض"}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>ID: {w.telegramId}</span>
                        {w.note && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>• {w.note}</span>}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openTelegramChat(w.telegramId)}
                          style={{ flex: 1, height: 36, borderRadius: 10, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                          <MessageCircle size={13} /> راسله
                        </button>

                        {w.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleWithdrawAction(w.id, "approved")}
                              disabled={withdrawActionLoading === w.id}
                              style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "rgba(16,185,129,0.2)", color: "#34D399", fontWeight: 800, fontSize: 11, cursor: withdrawActionLoading === w.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              {withdrawActionLoading === w.id
                                ? <div style={{ width: 14, height: 14, border: "2px solid rgba(52,211,153,0.3)", borderTopColor: "#34D399", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                : <CheckCircle size={13} />}
                              موافقة
                            </button>
                            <button
                              onClick={() => handleWithdrawAction(w.id, "rejected", "رفض من الأدمن")}
                              disabled={withdrawActionLoading === w.id}
                              style={{ flex: 1, height: 36, borderRadius: 10, border: "none", background: "rgba(239,68,68,0.15)", color: "#FCA5A5", fontWeight: 800, fontSize: 11, cursor: withdrawActionLoading === w.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                            >
                              <XCircle size={13} /> رفض
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ===== BROADCAST TAB ===== */}
          {tab === "broadcast" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card>
                <CardHead icon={<Megaphone size={16} />} title="إرسال رسالة جماعية" color="#EC4899" />
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>المجموعة المستهدفة</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {([
                        ["all", "🌍", "جميع المستخدمين", "كل المستخدمين النشطين"] as const,
                        ["inactive", "😴", "الغائبون (+3 أيام)", "من لم يدخل منذ 3 أيام"] as const,
                      ]).map(([v, e, t, d]) => (
                        <button key={v} onClick={() => setBroadcastTarget(v)}
                          style={{ padding: "12px", borderRadius: 16, border: `1px solid ${broadcastTarget === v ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.07)"}`, background: broadcastTarget === v ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "right" }}>
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{e}</div>
                          <p style={{ fontSize: 12, fontWeight: 800, color: broadcastTarget === v ? "#F9A8D4" : "rgba(255,255,255,0.6)", marginBottom: 3 }}>{t}</p>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{d}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>نص الرسالة (يدعم HTML)</p>
                    <textarea
                      value={broadcastMsg}
                      onChange={e => setBroadcastMsg(e.target.value)}
                      rows={5}
                      placeholder={"اكتب رسالتك هنا...\n\nمثال: 🎁 هدية مجانية! ادخل الآن واستلم 50 نقطة 🎮"}
                      style={{ width: "100%", borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, fontWeight: 500, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
                    />
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>{broadcastMsg.length} / 1000 حرف</p>
                  </div>

                  {broadcastMsg.trim() && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14 }}>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>معاينة</p>
                      <div style={{ background: "rgba(30,30,50,0.8)", borderRadius: 12, padding: 14 }}>
                        <p style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{broadcastMsg}</p>
                        <div style={{ marginTop: 10, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, color: "#A78BFA", textAlign: "center" }}>🎮 افتح التطبيق</div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleBroadcast}
                    disabled={broadcastLoading || !broadcastMsg.trim()}
                    style={{ height: 56, borderRadius: 18, border: "none", background: broadcastMsg.trim() ? "linear-gradient(135deg,#EC4899,#DB2777)" : "rgba(255,255,255,0.05)", color: broadcastMsg.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: 15, cursor: broadcastMsg.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.3s", boxShadow: broadcastMsg.trim() ? "0 6px 24px rgba(236,72,153,0.35)" : "none" }}
                  >
                    {broadcastLoading
                      ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      : <Send size={20} />
                    }
                    {broadcastLoading ? "جاري الإرسال..." : broadcastTarget === "all" ? "إرسال لجميع المستخدمين 🚀" : "إرسال للغائبين 📩"}
                  </button>

                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "12px 14px" }}>
                    <p style={{ fontSize: 11, color: "#FCD34D", fontWeight: 700, marginBottom: 4 }}>⚠️ تنبيه</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                      الرسائل الجماعية تُرسَل بمعدل 1 رسالة كل 50ms لتجنب الحظر من Telegram. الإرسال لعدد كبير قد يستغرق بعض الوقت.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    );
  }
  