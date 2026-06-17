import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { translations } from "@/lib/i18n";
import {
  Users, TrendUp, Wallet, PaperPlaneTilt, Shield, ChartBar,
  Eye, EyeSlash, ArrowCounterClockwise, Prohibit, CheckCircle,
  Broadcast, SignOut, ChatCircle, XCircle, MagnifyingGlass, Bell, Gift, Trash, Copy, MagicWand, Calendar
} from "@phosphor-icons/react";

const fmtN = (n: number) => n?.toLocaleString() ?? "0";
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// Build a random professional channel message for a code
function buildCodeMessage(code: string, reward: number, maxUses: number, expiresAt: string): string {
  const hoursLeft = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
  const timeLabel = hoursLeft === 1 ? "1 Hour Only" : `${hoursLeft} Hours Only`;
  const timeShort = hoursLeft === 1 ? "1 Hour" : `${hoursLeft} Hours`;
  const pts = reward.toLocaleString();

  const templates = [
    // 1 — Original clean style
    [
      "⚡ New Redeem Code is LIVE! ⚡",
      "",
      `🎟 Code: ${code}`,
      ` Reward: ${pts} Points`,
      `⏳ Valid For: ${timeLabel}`,
      `👥 Limited To: ${maxUses} Users`,
      "",
      " Time is running out — redeem your reward now before the code expires!",
      " Open the Mini App and claim it instantly ",
    ],
    // 2 — Alert style
    [
      "🚨 EXCLUSIVE CODE DROP 🚨",
      "━━━━━━━━━━━━━━━━",
      `🎫 Code: ${code}`,
      ` Reward: ${pts} Points`,
      `⌛ Active For: ${timeShort}`,
      ` Only ${maxUses} Spots Left!`,
      "━━━━━━━━━━━━━━━━",
      "⚡ First come, first served!",
      "👉 Claim before it's gone ",
    ],
    // 3 — Premium style
    [
      " PREMIUM CODE JUST DROPPED ",
      "",
      `🔑 Code: ${code}`,
      ` Earn: ${pts} Points`,
      `⏱ Valid: ${timeShort}`,
      ` Limited: ${maxUses} Users Only`,
      "",
      " The fastest win — don't sleep on this!",
      " Open the Mini App and grab your reward ",
    ],
    // 4 — Fire style
    [
      " HOT CODE ALERT ",
      "",
      `🎟 Code: ${code}`,
      ` Points: ${pts}`,
      `⏳ Time Left: ${timeShort}`,
      `👥 Max Users: ${maxUses}`,
      "",
      "💥 Snap it before it's gone!",
      " Tap & claim instantly in the Mini App ",
    ],
  ];

  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx].join("\n");
}

const SPINNER = (
  <div style={{ width: 28, height: 28, border: "3px solid rgba(139,92,246,0.3)", borderTopColor: "#8B5CF6", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
);

// ── AdsGram Status Card ──────────────────────────────────────────────
// يظهر في تبويب الإحصائيات ويعرض معلومات حساب AdsGram الخاص بنا
function AdsgramStatusCard() {
  const [status, setStatus] = useState<"loading" | "active" | "pending" | "unknown">("loading");
  const blockId = (import.meta as any).env?.VITE_ADSGRAM_BLOCK_ID || "34466";
  const platformId = "32595";
  const platformName = "Earnb";
  const dashboardUrl = "https://partner.adsgram.ai";

  useEffect(() => {
    let cancelled = false;
    // فحص حالة البلوك عبر SDK
    (async () => {
      try {
        // @ts-ignore — Adsgram SDK global
        if (window.Adsgram) {
          const ctrl = (window as any).Adsgram.init({ blockId });
          // محاولة فحص البلوك بطريقة آمنة (call show with timeout 0)
          const res = await Promise.race([
            ctrl.show(),
            new Promise<any>((r) => setTimeout(() => r({ done: false, error: true, state: "load", description: "timeout" }), 3000)),
          ]);
          if (cancelled) return;
          if (res?.done) setStatus("active");
          else if (res?.error && /no fill|not found|pending|review|disabled/i.test(res.description || "")) setStatus("pending");
          else setStatus("active"); // SDK loaded fine → assume active
        } else {
          if (!cancelled) setStatus("unknown");
        }
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();
    return () => { cancelled = true; };
  }, [blockId]);

  const statusColor = status === "active" ? "#10B981" : status === "pending" ? "#F59E0B" : "#6B7280";
  const statusLabel = status === "active" ? "Active ✓" : status === "pending" ? "Pending Review" : status === "loading" ? "..." : "Unknown";
  const statusBg = status === "active" ? "rgba(16,185,129,0.12)" : status === "pending" ? "rgba(245,158,11,0.12)" : "rgba(107,114,128,0.12)";

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 18, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #8B5CF6, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📺</div>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>AdsGram</p>
            <p style={{ fontSize: 14, color: "#fff", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{platformName}</p>
          </div>
        </div>
        <div style={{ background: statusBg, color: statusColor, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, border: `1px solid ${statusColor}40` }}>
          {statusLabel}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, margin: 0, marginBottom: 2 }}>Platform ID</p>
          <p style={{ fontSize: 12, color: "#fff", fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>{platformId}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, margin: 0, marginBottom: 2 }}>Block ID</p>
          <p style={{ fontSize: 12, color: "#fff", fontWeight: 700, margin: 0, fontVariantNumeric: "tabular-nums" }}>{blockId}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600, margin: 0, marginBottom: 2 }}>Type</p>
          <p style={{ fontSize: 12, color: "#fff", fontWeight: 700, margin: 0 }}>Rewarded</p>
        </div>
      </div>
      <a
        href={dashboardUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", textAlign: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.3)", color: "#A78BFA", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
      >
        فتح لوحة AdsGram ↗
      </a>
    </div>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ icon, title, color = "#A78BFA" }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <div style={{ padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.02)" }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
    </div>
  );
}

function StatCard({ emoji, label, value, color, sub }: { emoji: string; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: `${color}0e`, border: `1px solid ${color}28`, borderRadius: 18, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 26 }}>{emoji}</span>
        {sub && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "2px 8px" }}>{sub}</span>}
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, marginTop: 6 }}>{typeof value === "number" ? fmtN(value) : value}</p>
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [myTelegramId, setMyTelegramId] = useState<number>(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"stats" | "users" | "withdrawals" | "broadcast" | "codes" | "banned" | "suspicious">("stats");
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "inactive">("all");
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [withdrawFilter, setWithdrawFilter] = useState("pending");
  const [withdrawActionLoading, setWithdrawActionLoading] = useState<number | null>(null);
  const { toast } = useToast();
  const lang = (window as any).Telegram?.WebApp?.language || "ar";
  const t = translations[lang] || translations.ar;

  // Code form state
  const [codeInput, setCodeInput] = useState("");
  const [codeReward, setCodeReward] = useState(100);
  const [codeMaxUses, setCodeMaxUses] = useState(100);
  const [codeExpiry, setCodeExpiry] = useState(24);
  const [codePostChannel, setCodePostChannel] = useState(true);
  const [codeLoading, setCodeLoading] = useState(false);
  const [deleteCodeLoading, setDeleteCodeLoading] = useState<number | null>(null);

  const verifyMut = trpc.admin.verify.useMutation();
  const broadcastMut = trpc.admin.broadcast.useMutation();
  const updateWithdrawMut = trpc.admin.adminUpdate.useMutation();
  const sendUserChatLinkMut = trpc.admin.sendUserChatLink.useMutation();
  const banMut = trpc.admin.banUser.useMutation();
  const autoAuthMut = trpc.admin.adminAutoAuth.useMutation();
  const createCodeMut = trpc.codes.create.useMutation();
  const deleteCodeMut = trpc.codes.delete.useMutation();
  const postToChannelMut = trpc.codes.postToChannel.useMutation();
  const [sendingToChannel, setSendingToChannel] = useState<number | null>(null);
  const codesQ = trpc.codes.list.useQuery({ secret }, { enabled: authed && tab === "codes", refetchInterval: 3000 });

  // Auto-auth: try URL ?ak= param first, then Telegram identity, then saved session
  useEffect(() => {
    if (authed) return;
    const tryVerify = (s: string) =>
      verifyMut.mutateAsync({ secret: s }).then(res => {
        if (res.success) {
          
          setSecret(s);
          setAuthed(true);
          return true;
        }
        return false;
      }).catch(() => false);

    const tryAutoAuth = async () => {
      // 0. Try URL ?ak= param first (sent by bot /admin command)
      const urlParams = new URLSearchParams(window.location.search);
      const akParam = urlParams.get("ak");
      if (akParam) {
        const ok = await tryVerify(akParam);
        if (ok) {
          localStorage.setItem("adminSecret", akParam);
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      }

      // 1. Try saved secret from localStorage
      const saved = localStorage.getItem("adminSecret");
      if (saved) {
        const ok = await tryVerify(saved);
        if (ok) return;
        // saved secret is wrong/expired — remove it
        localStorage.removeItem("adminSecret");
      }

      // 2. Try Telegram identity via tRPC client
      try {
        const tg = (window as any)?.Telegram?.WebApp;
        if (tg?.initData && tg?.initDataUnsafe?.user?.id) {
          setMyTelegramId(Number(tg.initDataUnsafe.user.id));
          const res = await autoAuthMut.mutateAsync({
            telegramId: tg.initDataUnsafe.user.id,
            initData: tg.initData,
          });
          if (res?.secret) {
            const ok = await tryVerify(res.secret);
            if (ok) localStorage.setItem("adminSecret", res.secret);
          }
        }
      } catch {}
    };

    tryAutoAuth();
  }, []);

  const statsQ = trpc.admin.getStats.useQuery({ secret }, { enabled: authed, refetchInterval: 30000 });
  const onlineQ = trpc.admin.getOnlineUsers.useQuery({ secret }, { enabled: authed && tab === "stats", refetchInterval: 15000 });
  const todayQ = trpc.admin.getTodayActiveUsers.useQuery({ secret }, { enabled: authed && tab === "stats", refetchInterval: 60000 });
  const bannedQ = trpc.admin.getBannedUsers.useQuery({ secret }, { enabled: authed && tab === "banned", refetchInterval: 10000 });
  const suspiciousQ = trpc.admin.getSuspiciousAccounts.useQuery({ secret }, { enabled: authed && tab === "suspicious", refetchInterval: 15000 });
  const bulkBanMut = trpc.admin.bulkBanByIp.useMutation({ onSuccess: () => suspiciousQ.refetch() });
  const usersQ = trpc.admin.getUsers.useQuery({ secret, page: userPage }, { enabled: authed && tab === "users" });
  const withdrawQ = trpc.admin.getWithdrawals.useQuery({ secret, status: withdrawFilter }, { enabled: authed && tab === "withdrawals" });

  const handleLogin = async () => {
    if (!secret.trim()) return;
    setAuthLoading(true);
    try {
      const res = await verifyMut.mutateAsync({ secret });
      if (res.success) {
        localStorage.setItem("adminSecret", secret);
        setAuthed(true);
        toast({ title: t.admin_login_success, description: t.admin_login_welcome });
      } else {
        toast({ title: t.admin_login_failed, description: t.admin_login_wrong_password, variant: "destructive" });
      }
    } catch {
      toast({ title: t.error, description: t.admin_connection_error, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminSecret");
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
        toast({ title: t.admin_broadcast_sent, description: t.admin_broadcast_progress.replace("{sent}", res.sent.toString()).replace("{total}", res.total.toString()) });
        setBroadcastMsg("");
      } else {
        toast({ title: t.admin_broadcast_failed, description: (res as any).message || t.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t.error, description: t.admin_broadcast_send_failed, variant: "destructive" });
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleBan = async (telegramId: number, ban: boolean) => {
    try {
      await banMut.mutateAsync({ secret, telegramId, ban });
      toast({ title: ban ? t.admin_user_banned  : t.admin_user_unbanned });
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
        toast({ title: status === "approved" ? t.admin_action_approved  : t.admin_action_rejected });
        withdrawQ.refetch();
      } else {
        toast({ title: "خطأ", description: (res as any).message || "فشل التحديث", variant: "destructive" });
      }
    } catch {
      toast({ title: t.error, description: t.admin_connection_failed, variant: "destructive" });
    } finally {
      setWithdrawActionLoading(null);
    }
  };

  const openTelegramChat = async (telegramId: number, username?: string, firstName?: string, lastName?: string) => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (username) {
      // Has username — openTelegramLink works for https://t.me/ links
      const url = `https://t.me/${username}`;
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else window.open(url, "_blank");
    } else {
      // No username — ask the bot to send the admin a native Telegram message
      // with a tg://openmessage button (works in native Telegram, not in WebApp webview)
      try {
        // Get admin's own telegramId — from state (set on load) or directly from WebApp
        const tg = (window as any)?.Telegram?.WebApp;
        const adminId = myTelegramId || Number(tg?.initDataUnsafe?.user?.id) || 0;
        const res = await sendUserChatLinkMut.mutateAsync({
          secret,
          adminTelegramId: adminId,
          targetTelegramId: telegramId,
          firstName,
          lastName,
        });
        if (res.success) {
          toast({
            title: t.admin_message_sent,
            description: t.admin_telegram_message_desc,
          });
        } else {
          toast({ title: "خطأ", description: (res as any).message || "فشل الإرسال", variant: "destructive" });
        }
      } catch {
        toast({ title: "خطأ", description: "تعذر الاتصال بالسيرفر", variant: "destructive" });
      }
    }
  };

  const openSendStars = (telegramId: number, username?: string) => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (username) {
      // Has username — openTelegramLink accepts https://t.me/ links
      const url = `https://t.me/${username}`;
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else window.open(url, "_blank");
    } else {
      // No username — copy the ID and show clear instructions
      navigator.clipboard.writeText(String(telegramId)).catch(() => {});
      toast({
        title: t.admin_id_copied.replace("{id}", telegramId),
        description: t.admin_id_instruction,
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: t.admin_copied, description: label });
    }).catch(() => {
      toast({ title: t.admin_copy_failed, description: t.admin_copy_manual.replace("{text}", text), variant: "destructive" });
    });
  };



  /* ── LOGIN ── */
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#070711", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} .orb-1{position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,0.15),transparent 70%);top:-100px;right:-100px;animation:float1 8s ease-in-out infinite} .orb-2{position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.1),transparent 70%);bottom:-50px;left:-50px;animation:float2 10s ease-in-out infinite} @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}} @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}`}</style>
        <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}><div className="orb-1" /><div className="orb-2" /></div>
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: "linear-gradient(135deg,#7C3AED,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(124,58,237,0.4)", fontSize: 32 }}>🛡️</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#A78BFA,#60A5FA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>لوحة التحكم</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, fontWeight: 600 }}>منطقة مقيّدة — للمشرفين فقط</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 24, padding: 28 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>كلمة المرور السرية</p>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                type={showPass ? "text" : "password"}
                value={secret}
                onChange={e => setSecret(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="أدخل كلمة مرور الأدمن..."
                style={{ width: "100%", height: 52, borderRadius: 16, padding: "0 48px 0 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.25)", color: "#fff", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
              />
              <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0 }}>
                {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              onClick={handleLogin}
              disabled={authLoading || !secret.trim()}
              style={{ width: "100%", height: 52, borderRadius: 18, border: "none", background: secret.trim() ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "rgba(255,255,255,0.05)", color: secret.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: 15, cursor: secret.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: secret.trim() ? "0 6px 24px rgba(124,58,237,0.35)" : "none" }}
            >
              {authLoading ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Shield size={20} />}
              {authLoading ? "جاري التحقق..." : "دخول"}
            </button>
            <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 16 }}>المتغير المطلوب: ADMIN_SECRET في Render</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── DASHBOARD ── */
  const stats = statsQ.data?.data;
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setCodeInput(`${seg(4)}-${seg(4)}-${seg(4)}`);
  };

  const handleCreateCode = async () => {
    if (!codeInput.trim() || codeReward < 1) return;
    setCodeLoading(true);
    try {
      const res = await createCodeMut.mutateAsync({ secret, code: codeInput.trim(), reward: codeReward, maxUses: codeMaxUses, expiresInHours: codeExpiry, postToChannel: codePostChannel });
      if (res.success) {
        toast({ title: t.admin_code_created, description: t.admin_code_value.replace("{code}", (res as any).code?.code || "") });
        setCodeInput("");
        codesQ.refetch();
      } else {
        toast({ title: t.admin_code_failed, description: (res as any).message || t.admin_create_failed, variant: "destructive" });
      }
    } finally {
      setCodeLoading(false);
    }
  };

  const handleDeleteCode = async (id: number) => {
    setDeleteCodeLoading(id);
    try {
      await deleteCodeMut.mutateAsync({ secret, id });
      toast({ title: t.admin_code_cancelled });
      codesQ.refetch();
    } finally {
      setDeleteCodeLoading(null);
    }
  };

  const TABS = [
    { id: "stats" as const, icon: <ChartBar size={16} />, label: "الإحصائيات", emoji: "" },
    { id: "users" as const, icon: <Users size={16} />, label: "المستخدمون", emoji: "👥" },
    { id: "withdrawals" as const, icon: <Wallet size={16} />, label: "السحوبات", emoji: "💸" },
    { id: "broadcast" as const, icon: <Broadcast size={16} />, label: "الإشعارات", emoji: "📣" },
    { id: "codes" as const, icon: <Gift size={16} />, label: "الأكواد", emoji: "" },
    { id: "banned" as const, icon: <Prohibit size={16} />, label: "المحظورون", emoji: "🚫" },
    { id: "suspicious" as const, icon: <span style={{ fontSize: 14 }}>🚨</span>, label: "مشبوه", emoji: "🚨" },
  ];

  const filteredUsers = (usersQ.data?.users || []).filter((u: any) => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (u.firstName || "").toLowerCase().includes(s) || (u.username || "").toLowerCase().includes(s) || String(u.telegramId).includes(s);
  });

  const inactiveTemplate = ` مرحباً {name}!

لاحظنا أنك لم تلعب منذ فترة 😔

 لديك 5 دورة مجانية بانتظارك!
 رصيدك الحالي: {balance} نقطة

تعال والعب الآن واربح أكثر! `;

  return (
    <div style={{ minHeight: "100vh", background: "#070711", color: "#fff", fontFamily: "'Inter',system-ui,sans-serif", padding: "0 14px 32px" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#7C3AED,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, background: "linear-gradient(135deg,#A78BFA,#60A5FA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>لوحة التحكم</h1>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 600, margin: 0 }}>Admin Panel</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { window.location.href = "/"; }} style={{ height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", padding: "0 14px", color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12 }}>← رجوع</button>
            <button onClick={() => statsQ.refetch()} style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}><ArrowCounterClockwise size={15} /></button>
            <button onClick={handleLogout} style={{ height: 38, borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", cursor: "pointer", padding: "0 14px", display: "flex", alignItems: "center", gap: 6, color: "#FCA5A5", fontWeight: 700, fontSize: 12 }}><SignOut size={14} />خروج</button>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 5 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 40, borderRadius: 14, border: "none", background: tab === t.id ? "rgba(139,92,246,0.25)" : "transparent", color: tab === t.id ? "#A78BFA" : "rgba(255,255,255,0.35)", fontWeight: 800, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.2s", outline: tab === t.id ? "1px solid rgba(139,92,246,0.3)" : "none" }}>
              <span style={{ fontSize: 14 }}>{t.emoji}</span>
              <span style={{ display: "none" }}>{t.label}</span>
              <span style={{ fontSize: 10 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {statsQ.isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>{SPINNER}</div>
            ) : stats ? (
              <>
                {/* ── AdsGram Status Card ─────────────────────────────── */}
                <AdsgramStatusCard />

                {/* Online Now Banner */}
                <div style={{ borderRadius: 18, padding: "14px 18px", background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }} />
                    <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.3)", animation: "spin 2s linear infinite" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, margin: 0, marginBottom: 2 }}>يلعبون الآن (آخر 5 دقائق)</p>
                    <p style={{ fontSize: 28, fontWeight: 900, color: "#34D399", margin: 0, lineHeight: 1 }}>{stats.onlineNow ?? 0}</p>
                  </div>
                  <span style={{ fontSize: 32 }}>🎮</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <StatCard emoji="👥" label="إجمالي المستخدمين" value={stats.totalUsers ?? 0} color="#A78BFA" />
                  <StatCard emoji="" label="إجمالي النقاط" value={stats.totalPoints ?? 0} color="#FFD700" />
                  <StatCard emoji="" label="إعلانات اليوم" value={stats.todayAds ?? 0} color="#F59E0B" sub="اليوم" />
                  <StatCard emoji="💸" label="طلبات سحب معلقة" value={stats.pendingWithdrawals ?? 0} color="#EF4444" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <StatCard emoji="" label="Stars تم صرفها" value={stats.totalStarsWithdrawn ?? 0} color="#06B6D4" />
                  <StatCard emoji="🆕" label="مستخدمون جدد اليوم" value={stats.newUsersToday ?? 0} color="#10B981" sub="اليوم" />
                </div>
                {/* Who is playing now */}
                {(onlineQ.data?.users?.length ?? 0) > 0 && (
                  <Card>
                    <CardHead icon={<Eye size={16} />} title={`يلعبون الآن — ${onlineQ.data!.users!.length} لاعب`} color="#10B981" />
                    <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {onlineQ.data!.users!.slice(0, 20).map((u: any) => {
                        const secsAgo = Math.floor((Date.now() - new Date(u.lastSeenAt).getTime()) / 1000);
                        const timeLabel = secsAgo < 60 ? `${secsAgo}ث` : `${Math.floor(secsAgo / 60)}د`;
                        return (
                          <div key={u.telegramId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: 12 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", flexShrink: 0, boxShadow: "0 0 6px #10B981" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", margin: 0 }}>{u.firstName || u.username || `#${u.telegramId}`}</p>
                              {u.username && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>@{u.username}</p>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontSize: 11, fontWeight: 800, color: "#FFD700", margin: 0 }}>{Number(u.balance).toLocaleString()} </p>
                              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.6)", margin: 0 }}>منذ {timeLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Who was active today */}
                <Card>
                  <CardHead icon={<Calendar size={16} />} title={`زوار اليوم — ${todayQ.data?.count ?? 0} مستخدم`} color="#60A5FA" />
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                    {(todayQ.data?.users ?? []).length === 0 && (
                      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", padding: 16, fontSize: 12 }}>لا بيانات لليوم بعد</p>
                    )}
                    {(todayQ.data?.users ?? []).map((u: any) => {
                      const secsAgo = Math.floor((Date.now() - new Date(u.lastSeenAt).getTime()) / 1000);
                      const minsAgo = Math.floor(secsAgo / 60);
                      const timeLabel = secsAgo < 60 ? `${secsAgo}ث` : minsAgo < 60 ? `${minsAgo}د` : `${Math.floor(minsAgo / 60)}س`;
                      return (
                        <div key={u.telegramId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.1)", borderRadius: 12 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: secsAgo < 300 ? "#10B981" : "#60A5FA", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0", margin: 0 }}>{u.firstName || u.username || `#${u.telegramId}`}</p>
                            {u.username && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>@{u.username}</p>}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: 11, fontWeight: 800, color: "#FFD700", margin: 0 }}>{Number(u.balance).toLocaleString()} ⭐</p>
                            <p style={{ fontSize: 9, color: "rgba(96,165,250,0.6)", margin: 0 }}>منذ {timeLabel}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  <CardHead icon={<TrendUp size={16} />} title="أفضل 5 مستخدمين" color="#FFD700" />
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {(stats.topUsers || []).map((u: any, i: number) => (
                      <div key={u.telegramId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", margin: 0 }}>{u.firstName || u.username || `#${u.telegramId}`}</p>
                          {u.username && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>@{u.username}</p>}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#FFD700" }}> {fmtN(Number(u.balance))}</span>
                      </div>
                    ))}
                    {!(stats.topUsers?.length) && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", padding: 16 }}>لا بيانات</p>}
                  </div>
                </Card>
              </>
            ) : (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 32 }}>تعذر تحميل الإحصائيات</p>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <MagnifyingGlass size={15} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="بحث بالاسم أو المعرف أو ID..."
                style={{ width: "100%", height: 46, borderRadius: 16, padding: "0 42px 0 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <Card>
              <CardHead icon={<Users size={16} />} title={`المستخدمون (${filteredUsers.length})`} color="#A78BFA" />
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {usersQ.isLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>{SPINNER}</div>
                ) : filteredUsers.length === 0 ? (
                  <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 24 }}>لا يوجد مستخدمون</p>
                ) : filteredUsers.map((u: any) => (
                  <div key={u.telegramId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, fontWeight: 800, color: "#A78BFA" }}>
                      {(u.firstName?.[0] || u.username?.[0] || "?").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>{u.firstName || ""} {u.lastName || ""}</p>
                        {!!u.isBanned && <span style={{ fontSize: 9, color: "#EF4444", background: "rgba(239,68,68,0.15)", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>محظور</span>}
                      </div>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                        {u.username ? `@${u.username} · ` : ""} {fmtN(Number(u.balance))} · #{u.telegramId}{u.country ? ` · 🌍 ${u.country}` : ""}
                      </p>
                      {u.lastIp && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 5px", borderRadius: 4 }}>IP: {u.lastIp}</span>
                          {filteredUsers.filter((other: any) => other.telegramId !== u.telegramId && other.lastIp === u.lastIp).length > 0 && (
                            <span style={{ fontSize: 8, color: "#EF4444", background: "rgba(239,68,68,0.1)", padding: "2px 5px", borderRadius: 4, fontWeight: 700 }}>⚠️ حسابات متعددة (IP)</span>
                          )}
                          {u.deviceInfo && filteredUsers.filter((other: any) => other.telegramId !== u.telegramId && other.deviceInfo === u.deviceInfo).length > 0 && (
                            <span style={{ fontSize: 8, color: "#F59E0B", background: "rgba(245,158,11,0.1)", padding: "2px 5px", borderRadius: 4, fontWeight: 700 }}>⚠️ حسابات متعددة (الجهاز)</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openTelegramChat(u.telegramId, u.username, u.firstName, u.lastName)} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChatCircle size={14} /></button>
                      <button onClick={() => handleBan(u.telegramId, !u.isBanned)} style={{ height: 34, borderRadius: 10, border: "none", background: !!u.isBanned ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: !!u.isBanned ? "#34D399" : "#FCA5A5", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: "0 10px", display: "flex", alignItems: "center", gap: 5 }}>
                        {!!u.isBanned ? <CheckCircle size={13} /> : <Prohibit size={13} />}
                        {!!u.isBanned ? "رفع" : "حظر"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1} style={{ flex: 1, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: userPage === 1 ? "rgba(255,255,255,0.2)" : "#fff", fontWeight: 700, fontSize: 12, cursor: userPage === 1 ? "not-allowed" : "pointer" }}>← السابق</button>
                <div style={{ height: 38, padding: "0 16px", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800, color: "#A78BFA" }}>صفحة {userPage}</div>
                <button onClick={() => setUserPage(p => p + 1)} disabled={(usersQ.data?.users?.length ?? 0) < 20} style={{ flex: 1, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: (usersQ.data?.users?.length ?? 0) < 20 ? "rgba(255,255,255,0.2)" : "#fff", fontWeight: 700, fontSize: 12, cursor: (usersQ.data?.users?.length ?? 0) < 20 ? "not-allowed" : "pointer" }}>التالي →</button>
              </div>
            </Card>
          </div>
        )}

        {/* ── WITHDRAWALS TAB ── */}
        {tab === "withdrawals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* How-to guide — DGB via FaucetPay */}
            <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#60A5FA", marginBottom: 10 }}>🟦 كيف يعمل سحب DigiByte (DGB)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  ["1️⃣", "اضغط زر", "✓ تأكيد", "على طلب السحب المعلق"],
                  ["2️⃣", "السيرفر يرسل DGB", "تلقائياً", "عبر FaucetPay إلى محفظة المستخدم"],
                  ["3️⃣", "المستخدم يستلم", "إشعار تلقائي", "برقم المعاملة فور الإرسال"],
                ].map(([num, pre, bold, post]) => (
                  <div key={num as string} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{num}</span>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>
                      {pre} <span style={{ color: "#60A5FA", fontWeight: 800 }}>{bold}</span> {post}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {([["pending","⏳ معلقة"],["approved"," موافق"],["rejected"," مرفوضة"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setWithdrawFilter(v)} style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${withdrawFilter === v ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`, background: withdrawFilter === v ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)", color: withdrawFilter === v ? "#A78BFA" : "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            <Card>
              <CardHead icon={<Wallet size={16} />} title="طلبات السحب" color="#F59E0B" />
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {withdrawQ.isLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>{SPINNER}</div>
                ) : !withdrawQ.data?.withdrawals?.length ? (
                  <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 24 }}>لا توجد طلبات</p>
                ) : withdrawQ.data.withdrawals.map((w: any) => (
                  <div key={w.id} style={{ padding: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16 }}>

                    {/* Header: name + stars amount */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#E2E8F0", marginBottom: 2 }}>{w.firstName ? `${w.firstName}${w.lastName ? " " + w.lastName : ""}` : `#${w.telegramId}`}</p>
                        {w.username && (
                          <button
                            onClick={() => copyToClipboard(w.username, `@${w.username} — تم النسخ`)}
                            style={{ fontSize: 11, color: "#60A5FA", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "2px 8px", cursor: "pointer", marginBottom: 2, fontWeight: 700 }}
                          >
                            @{w.username} 
                          </button>
                        )}
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{fmtDate(w.createdAt)}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button
                          onClick={() => {
                            const isDgb = w.method === "dgb";
                            const amount = isDgb ? parseFloat(((Number(w.amount) / 15000) * 0.05).toFixed(4)) : w.stars;
                            const label = isDgb ? "DGB" : "Stars";
                            copyToClipboard(String(amount), `${amount} ${label} — تم النسخ`);
                          }}
                          style={{ fontSize: 20, fontWeight: 900, color: w.method === "dgb" ? "#60A5FA" : "#FFD700", background: w.method === "dgb" ? "rgba(96,165,250,0.1)" : "rgba(255,215,0,0.1)", border: `1px solid ${w.method === "dgb" ? "rgba(96,165,250,0.25)" : "rgba(255,215,0,0.25)"}`, borderRadius: 10, padding: "4px 10px", cursor: "pointer", display: "block", marginBottom: 4 }}
                        >
                           {w.method === "dgb" ? parseFloat(((Number(w.amount) / 15000) * 0.05).toFixed(4)) : fmtN(Number(w.stars))}
                        </button>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{fmtN(Number(w.amount))} نقطة</p>
                      </div>
                    </div>

                    {/* Status + ID */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: w.status === "pending" ? "rgba(245,158,11,0.15)" : w.status === "approved" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: w.status === "pending" ? "#FCD34D" : w.status === "approved" ? "#34D399" : "#FCA5A5" }}>
                        {w.status === "pending" ? "⏳ معلق" : w.status === "approved" ? " تم الإرسال" : " مرفوض"}
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(w.telegramId), `ID: ${w.telegramId} — تم النسخ`)}
                        style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "3px 8px", cursor: "pointer" }}
                      >
                        ID: {w.telegramId} 
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8 }}>
                      {/*  Send Stars — opens profile */}
                      {w.method !== "dgb" ? (
                        <button
                          onClick={() => openSendStars(w.telegramId, w.username)}
                          style={{ flex: 2, height: 42, borderRadius: 10, border: "1px solid rgba(255,215,0,0.4)", background: "rgba(255,215,0,0.12)", color: "#FFD700", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                           أرسل {fmtN(Number(w.stars))} Stars
                        </button>
                      ) : (
                        <div style={{ flex: 2, height: 42, borderRadius: 10, border: "1px solid rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.12)", color: "#60A5FA", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          🟦 {parseFloat(((Number(w.amount) / 15000) * 0.05).toFixed(4))} DGB
                        </div>
                      )}

                      {/* Chat button */}
                      <button
                        onClick={() => openTelegramChat(w.telegramId, w.username, w.firstName, w.lastName)}
                        style={{ width: 42, height: 42, borderRadius: 10, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.1)", color: "#60A5FA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <ChatCircle size={15} />
                      </button>

                      {w.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleWithdrawAction(w.id, "approved")}
                            disabled={withdrawActionLoading === w.id}
                            style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "rgba(16,185,129,0.2)", color: "#34D399", fontWeight: 800, fontSize: 11, cursor: withdrawActionLoading === w.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                          >
                            {withdrawActionLoading === w.id
                              ? <div style={{ width: 14, height: 14, border: "2px solid rgba(52,211,153,0.3)", borderTopColor: "#34D399", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                              : <CheckCircle size={13} />}
                            تأكيد
                          </button>
                          <button
                            onClick={() => handleWithdrawAction(w.id, "rejected", "رفض من الأدمن")}
                            disabled={withdrawActionLoading === w.id}
                            style={{ width: 42, height: 42, borderRadius: 10, border: "none", background: "rgba(239,68,68,0.15)", color: "#FCA5A5", fontWeight: 800, fontSize: 11, cursor: withdrawActionLoading === w.id ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <XCircle size={15} />
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

        {/* ── BROADCAST TAB ── */}
        {tab === "broadcast" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <CardHead icon={<Bell size={16} />} title="إرسال إشعار للمستخدمين" color="#EC4899" />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Target Group */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>المجموعة المستهدفة</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {([["all","🌍","جميع المستخدمين","إرسال للجميع"],["inactive","😴","الغائبون (+3 أيام)","من لم يدخل منذ 3 أيام"]] as const).map(([v,e,t,d]) => (
                      <button key={v} onClick={() => { setBroadcastTarget(v); if (v === "inactive" && !broadcastMsg) setBroadcastMsg(inactiveTemplate); }} style={{ padding: "14px", borderRadius: 16, border: `1px solid ${broadcastTarget === v ? "rgba(236,72,153,0.4)" : "rgba(255,255,255,0.07)"}`, background: broadcastTarget === v ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "right" }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{e}</div>
                        <p style={{ fontSize: 12, fontWeight: 800, color: broadcastTarget === v ? "#F9A8D4" : "rgba(255,255,255,0.6)", marginBottom: 3 }}>{t}</p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{d}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template hint for inactive */}
                {broadcastTarget === "inactive" && (
                  <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 14, padding: "12px 14px" }}>
                    <p style={{ fontSize: 11, color: "#A78BFA", fontWeight: 700, marginBottom: 6 }}>💡 متغيرات مخصصة لكل مستخدم:</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {["{name}","+ أول اسم المستخدم","{balance}","رصيده بالنقاط"].map((t,i) => (
                        <span key={i} style={{ fontSize: 11, color: i%2===0 ? "#A78BFA" : "rgba(255,255,255,0.4)", background: i%2===0 ? "rgba(139,92,246,0.15)" : "transparent", borderRadius: 8, padding: i%2===0 ? "2px 8px" : "2px 0" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Composer */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>نص الرسالة</p>
                    {broadcastTarget === "inactive" && (
                      <button onClick={() => setBroadcastMsg(inactiveTemplate)} style={{ fontSize: 10, color: "#A78BFA", background: "rgba(139,92,246,0.15)", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}> استخدم القالب</button>
                    )}
                  </div>
                  <textarea
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                    rows={7}
                    placeholder={broadcastTarget === "inactive" ? "مثال:\n مرحباً {name}!\n\nلاحظنا أنك لم تلعب منذ فترة 😔\n لديك 5 دورة مجانية!\n رصيدك: {balance} نقطة" : "اكتب رسالتك هنا..."}
                    style={{ width: "100%", borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.7 }}
                  />
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>{broadcastMsg.length} / 1000 حرف</p>
                </div>

                {/* Preview */}
                {broadcastMsg.trim() && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 14 }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>معاينة الرسالة</p>
                    <div style={{ background: "rgba(20,20,40,0.8)", borderRadius: 12, padding: 14 }}>
                      <p style={{ fontSize: 13, color: "#E2E8F0", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
                        {broadcastMsg.replace("{name}", "أحمد").replace("{balance}", "300")}
                      </p>
                      <div style={{ marginTop: 12, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, color: "#A78BFA", textAlign: "center" }}> افتح التطبيق</div>
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <button
                  onClick={handleBroadcast}
                  disabled={broadcastLoading || !broadcastMsg.trim()}
                  style={{ height: 56, borderRadius: 18, border: "none", background: broadcastMsg.trim() ? "linear-gradient(135deg,#EC4899,#DB2777)" : "rgba(255,255,255,0.05)", color: broadcastMsg.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: 15, cursor: broadcastMsg.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, boxShadow: broadcastMsg.trim() ? "0 6px 24px rgba(236,72,153,0.35)" : "none" }}
                >
                  {broadcastLoading ? <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <PaperPlaneTilt size={20} />}
                  {broadcastLoading ? "جاري الإرسال..." : broadcastTarget === "all" ? " إرسال لجميع المستخدمين" : "📩 إرسال للغائبين"}
                </button>

                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, color: "#FCD34D", fontWeight: 700, marginBottom: 4 }}> تنبيه</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>الإرسال يتم بمعدل 1 رسالة / 50ms لتجنب حظر Telegram. قد يستغرق وقتاً عند عدد كبير.</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── CODES TAB ── */}
        {tab === "codes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Create Code */}
            <Card>
              <CardHead icon={<Gift size={16} />} title="إنشاء كود مكافأة جديد" color="#10B981" />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Code input + auto-generate */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>الكود</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={codeInput}
                      onChange={e => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="مثال: GIFT-2024-EARN"
                      style={{ flex: 1, borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", fontFamily: "monospace", letterSpacing: "0.05em" }}
                    />
                    <button onClick={generateCode} style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.1)", color: "#34D399", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <MagicWand size={13} /> توليد
                    </button>
                  </div>
                </div>

                {/* Reward + MaxUses row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>المكافأة (نقطة)</p>
                    <input type="number" value={codeReward} onChange={e => setCodeReward(Number(e.target.value))} min={1} style={{ width: "100%", borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>أقصى عدد مستخدمين</p>
                    <input type="number" value={codeMaxUses} onChange={e => setCodeMaxUses(Number(e.target.value))} min={1} style={{ width: "100%", borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                {/* Expiry */}
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>مدة الصلاحية (ساعات)</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[1, 3, 6, 12, 24, 48, 72].map(h => (
                      <button key={h} onClick={() => setCodeExpiry(h)} style={{ padding: "6px 14px", borderRadius: 10, border: `1px solid ${codeExpiry === h ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.08)"}`, background: codeExpiry === h ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.02)", color: codeExpiry === h ? "#34D399" : "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {h}س
                      </button>
                    ))}
                    <input type="number" value={codeExpiry} onChange={e => setCodeExpiry(Number(e.target.value))} min={1} style={{ width: 70, borderRadius: 10, padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, outline: "none", textAlign: "center" }} />
                  </div>
                </div>

                {/* Post to channel toggle */}
                <button onClick={() => setCodePostChannel(!codePostChannel)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: `1px solid ${codePostChannel ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`, background: codePostChannel ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "right" }}>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: codePostChannel ? "#10B981" : "rgba(255,255,255,0.15)", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                    <div style={{ position: "absolute", top: 2, left: codePostChannel ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: codePostChannel ? "#34D399" : "rgba(255,255,255,0.5)", margin: 0 }}> نشر في القناة</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>إرسال الكود تلقائياً لقناة البوت</p>
                  </div>
                </button>

                {/* Preview */}
                {codeInput.trim() && (
                  <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>معاينة رسالة القناة</p>
                    <p style={{ fontSize: 12, color: "#E2E8F0", lineHeight: 2, margin: 0, direction: "rtl", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                      {` كود مكافأة جديد!\n\n الكود: ${codeInput.trim()}\n المكافأة: ${codeReward.toLocaleString()} نقطة\n⏰ صالح لمدة: ${codeExpiry} ساعة\n👥 أقصى عدد مستخدمين: ${codeMaxUses}\n\n استرد الآن من Mini App!`}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCreateCode}
                  disabled={codeLoading || !codeInput.trim()}
                  style={{ height: 52, borderRadius: 16, border: "none", background: codeInput.trim() ? "linear-gradient(135deg,#10B981,#059669)" : "rgba(255,255,255,0.05)", color: codeInput.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: 14, cursor: codeInput.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: codeInput.trim() ? "0 6px 24px rgba(16,185,129,0.3)" : "none" }}
                >
                  {codeLoading ? <div style={{ width: 20, height: 20, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Gift size={18} />}
                  {codeLoading ? "جاري الإنشاء..." : " إنشاء الكود" + (codePostChannel ? " ونشره في القناة" : "")}
                </button>
              </div>
            </Card>

            {/* Active Codes List */}
            <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(145deg,rgba(15,15,30,0.95),rgba(10,10,20,0.98))" }}>
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(245,158,11,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#F59E0B" }}><Gift size={16} /></span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>سجل الأكواد</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                    {(codesQ.data?.codes || []).filter((c: any) => c.isActive && new Date() < new Date(c.expiresAt) && c.usedCount < c.maxUses).length} نشط
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {(codesQ.data?.codes || []).length} إجمالي
                  </span>
                </div>
              </div>

              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {codesQ.isLoading && <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>جاري التحميل...</div>}
                {!codesQ.isLoading && (codesQ.data?.codes || []).length === 0 && (
                  <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                    لا توجد أكواد بعد
                  </div>
                )}
                {(codesQ.data?.codes || []).map((c: any) => {
                  const expired = new Date() > new Date(c.expiresAt);
                  const full = c.usedCount >= c.maxUses;
                  const inactive = !c.isActive || expired || full;
                  const pct = Math.min(100, Math.round((c.usedCount / c.maxUses) * 100));
                  const barColor = inactive ? "rgba(255,255,255,0.12)" : pct >= 100 ? "#EF4444" : pct > 70 ? "#F59E0B" : "#10B981";
                  const statusLabel = !c.isActive ? "ملغي" : expired ? "منتهي" : full ? "مكتمل" : "نشط";
                  const statusColor = !c.isActive ? { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", text: "#FCA5A5" }
                    : expired ? { bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", text: "#9CA3AF" }
                    : full ? { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", text: "#FCD34D" }
                    : { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34D399" };

                  return (
                    <div key={c.id} style={{
                      borderRadius: 16,
                      border: `1px solid ${inactive ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.18)"}`,
                      background: inactive
                        ? "rgba(255,255,255,0.015)"
                        : "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(5,150,105,0.03))",
                      overflow: "hidden",
                      boxShadow: inactive ? "none" : "0 2px 16px rgba(16,185,129,0.06)",
                    }}>
                      {/* Top bar — active glow line */}
                      {!inactive && <div style={{ height: 2, background: "linear-gradient(90deg,transparent,#10B981,transparent)" }} />}

                      <div style={{ padding: "12px 14px" }}>
                        {/* Row 1: Code + status + delete */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 900, color: inactive ? "rgba(255,255,255,0.28)" : "#6EE7B7", letterSpacing: "0.08em" }}>{c.code}</span>
                            <button
                              onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast({ title: t.admin_copy_to_clipboard }))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: "2px 4px", borderRadius: 4 }}
                              title="نسخ الكود"
                            ><Copy size={11} /></button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 7, background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}>
                              {statusLabel}
                            </span>
                            {!inactive && (
                              <button
                                onClick={() => handleDeleteCode(c.id)}
                                disabled={deleteCodeLoading === c.id}
                                style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#FCA5A5" }}
                              >
                                {deleteCodeLoading === c.id
                                  ? <div style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                  : <Trash size={11} />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Reward + Expiry */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
                            <span style={{ fontSize: 11 }}></span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#FCD34D" }}>{c.reward.toLocaleString()}</span>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>نقطة</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                            <span style={{ fontSize: 11 }}>⏰</span>
                            <span style={{ fontSize: 10, color: "#A5B4FC" }}>
                              {new Date(c.expiresAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Redemption progress */}
                        <div style={{ marginBottom: !inactive ? 10 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}> الاستردادات</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 900, color: inactive ? "rgba(255,255,255,0.3)" : barColor }}>{c.usedCount}</span>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>/</span>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{c.maxUses}</span>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginRight: 2 }}>مستخدم</span>
                            </div>
                          </div>
                          <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: inactive
                                ? "rgba(255,255,255,0.12)"
                                : `linear-gradient(90deg,${barColor},${barColor}cc)`,
                              borderRadius: 4,
                              transition: "width 0.5s ease",
                              boxShadow: inactive ? "none" : `0 0 8px ${barColor}66`,
                            }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>{pct}% مُسترد</span>
                          </div>
                        </div>

                        {/* Row 4: Action buttons (only for active codes) */}
                        {!inactive && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            {/* Copy Message */}
                            <button
                              onClick={() => {
                                const msg = buildCodeMessage(c.code, c.reward, c.maxUses, c.expiresAt);
                                navigator.clipboard?.writeText(msg).then(() =>
                                  toast({ title: t.admin_copy_message, description: t.admin_paste_channel })
                                );
                              }}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", cursor: "pointer", color: "#A5B4FC", fontSize: 11, fontWeight: 700 }}
                            >
                              <Copy size={12} /> نسخ الرسالة
                            </button>

                            {/* Send to Telegram Channel */}
                            <button
                              onClick={async () => {
                                setSendingToChannel(c.id);
                                try {
                                  const res = await postToChannelMut.mutateAsync({
                                    secret,
                                    code: c.code,
                                    reward: c.reward,
                                    maxUses: c.maxUses,
                                    expiresAt: new Date(c.expiresAt).toISOString(),
                                  });
                                  if (res.success) {
                                    toast({ title: t.admin_sent_to_channel, description: t.admin_published.replace("{code}", c.code) });
                                  } else {
                                    toast({ title: t.admin_send_failed, description: res.message || t.admin_check_bot_settings });
                                  }
                                } catch (err: any) {
                                  const msg = err?.message || err?.data?.message || "تحقق من BOT_TOKEN و REQUIRED_CHANNEL";
                                  toast({ title: t.admin_send_error, description: msg });
                                } finally {
                                  setSendingToChannel(null);
                                }
                              }}
                              disabled={sendingToChannel === c.id}
                              style={{
                                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                height: 36, borderRadius: 10,
                                border: "1px solid rgba(0,136,204,0.4)",
                                background: sendingToChannel === c.id
                                  ? "rgba(0,136,204,0.05)"
                                  : "linear-gradient(135deg,rgba(0,136,204,0.2),rgba(0,136,204,0.1))",
                                cursor: sendingToChannel === c.id ? "not-allowed" : "pointer",
                                color: "#38BDF8", fontSize: 11, fontWeight: 800,
                                boxShadow: sendingToChannel === c.id ? "none" : "0 2px 10px rgba(0,136,204,0.15)",
                              }}
                            >
                              {sendingToChannel === c.id
                                ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> جاري الإرسال...</>
                                : <><PaperPlaneTilt size={12} /> إرسال للقناة</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── BANNED TAB ── */}
        {tab === "suspicious" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#EF4444", marginBottom: 4 }}>🚨 كشف الحسابات المتعددة</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>المستخدمون الذين يشاركون نفس عنوان IP — قد يستخدمون حسابات متعددة للغش</p>
            </div>
            {suspiciousQ.isLoading && <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 20 }}>جاري التحميل...</p>}
            {!suspiciousQ.isLoading && (suspiciousQ.data?.groups || []).length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
                <p style={{ fontSize: 14, fontWeight: 700 }}>لا توجد حسابات مشبوهة</p>
              </div>
            )}
            {(suspiciousQ.data?.groups || []).map((group: any) => (
              <div key={group.ip} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${group.count >= 4 ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.25)"}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase" }}>IP مشترك</span>
                    <p style={{ fontSize: 13, fontWeight: 800, color: group.count >= 4 ? "#EF4444" : "#F59E0B", fontFamily: "monospace", marginTop: 2 }}>{group.ip}</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{group.count} حساب مشترك</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        if (!confirm(`حظر جميع الحسابات من IP: ${group.ip}?`)) return;
                        const r = await bulkBanMut.mutateAsync({ secret, ip: group.ip, ban: true });
                        alert(r.message);
                      }}
                      style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "rgba(239,68,68,0.2)", color: "#EF4444", fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                    >🚫 حظر الكل</button>
                    <button
                      onClick={async () => {
                        const r = await bulkBanMut.mutateAsync({ secret, ip: group.ip, ban: false });
                        alert(r.message);
                      }}
                      style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "rgba(16,185,129,0.15)", color: "#10B981", fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                    >✅ رفع الحظر</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {group.accounts.map((acc: any) => (
                    <div key={acc.telegramId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: acc.isBanned ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${acc.isBanned ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: acc.isBanned ? "#EF4444" : "#fff", margin: 0 }}>
                          {acc.isBanned ? "🚫 " : ""}{acc.firstName || acc.username || "مجهول"}
                          {acc.username ? <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: 10 }}> @{acc.username}</span> : ""}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2, margin: 0 }}>ID: {acc.telegramId} · {Number(acc.balance).toLocaleString()} نقطة · {new Date(acc.createdAt).toLocaleDateString("ar-SA")}</p>
                      </div>
                      <button
                        onClick={() => { banMut.mutate({ secret, telegramId: acc.telegramId, ban: !acc.isBanned }); setTimeout(() => suspiciousQ.refetch(), 500); }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: acc.isBanned ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: acc.isBanned ? "#10B981" : "#EF4444", fontWeight: 700, fontSize: 10, cursor: "pointer" }}
                      >{acc.isBanned ? "رفع" : "حظر"}</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "banned" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ borderRadius: 16, padding: "14px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>🚫</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#FCA5A5", margin: 0 }}>المحظورون بسبب الاختراق</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>يتم الحظر تلقائياً عند الكشف عن سكريبت اختراق</p>
              </div>
              <span style={{ marginRight: "auto", fontSize: 22, fontWeight: 900, color: "#EF4444" }}>{bannedQ.data?.users?.length ?? 0}</span>
            </div>

            <Card>
              <CardHead icon={<Prohibit size={16} />} title="قائمة المحظورين" color="#EF4444" />
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {bannedQ.isLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>{SPINNER}</div>
                ) : (bannedQ.data?.users?.length ?? 0) === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <p style={{ fontSize: 28, margin: 0 }}>✅</p>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>لا يوجد محظورون — لم يُكشف أي اختراق</p>
                  </div>
                ) : bannedQ.data!.users!.map((u: any) => (
                  <div key={u.telegramId} style={{ borderRadius: 14, border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.05)", overflow: "hidden" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤖</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: "#FCA5A5", margin: 0 }}>{u.firstName || u.username || "مجهول"}</p>
                        {u.username && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>@{u.username}</p>}
                      </div>
                      {/* Strike badges */}
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[1,2,3].map(i => (
                          <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: i <= (u.cheatStrikes || 3) ? "#EF4444" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>!</div>
                        ))}
                      </div>
                    </div>
                    {/* Telegram ID — copyable */}
                    <div style={{ margin: "0 14px 10px", padding: "8px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>Telegram ID:</span>
                      <code style={{ fontSize: 12, color: "#60A5FA", fontWeight: 800, flex: 1 }}>{u.telegramId}</code>
                      <button onClick={() => { navigator.clipboard.writeText(String(u.telegramId)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>نسخ</button>
                    </div>
                    {/* Ban reason */}
                    {u.banReason && (
                      <div style={{ margin: "0 14px 10px", padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 10 }}>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, margin: 0, marginBottom: 3 }}>سبب الحظر:</p>
                        <p style={{ fontSize: 11, color: "#FCA5A5", margin: 0, lineHeight: 1.5 }}>{u.banReason}</p>
                      </div>
                    )}
                    {/* Actions */}
                    <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleBan(u.telegramId, false)}
                        style={{ flex: 1, height: 34, borderRadius: 10, border: "none", background: "rgba(16,185,129,0.15)", color: "#34D399", fontWeight: 700, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                      >
                        <CheckCircle size={13} /> رفع الحظر
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(`#${u.telegramId} — ${u.firstName || u.username || "مجهول"}\n${u.banReason || ""}`)}
                        style={{ height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: "0 12px" }}
                      >
                        نسخ التقرير
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
