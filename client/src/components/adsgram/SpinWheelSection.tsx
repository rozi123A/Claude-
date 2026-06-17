import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Sparkle, Television, X, ShoppingCart, Lightning } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "@/components/adsgram/AdOverlay";

interface UserData {
  telegramId: number;
  balance: number;
  spinsLeft: number;
  adsgramBlockId: string;
}

interface SpinWheelSectionProps {
  user: UserData;
  lang: Language;
  onReward: (update?: { balance: number; spinsLeft: number; totalEarned?: number }) => void;
  onSwitchToAds?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
}

const PRIZES = [
  { label: "50",   value: 50,   color: "#FF6B6B" },
  { label: "200",  value: 200,  color: "#4ECDC4" },
  { label: "100",  value: 100,  color: "#FFE66D" },
  { label: "500",  value: 500,  color: "#FF9F43" },
  { label: "75",   value: 75,   color: "#A29BFE" },
  { label: "1000", value: 1000, color: "#FAB1A0" },
  { label: "150",  value: 150,  color: "#55E6C1" },
  { label: "250",  value: 250,  color: "#FD79A8" },
];

const MAX_AD_SPINS = 5;
const LS_COUNT = "spinAdCount";
const LS_DATE  = "spinAdDate";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function getAdSpinsUsed(): number {
  try {
    if (localStorage.getItem(LS_DATE) !== todayStr()) {
      localStorage.setItem(LS_COUNT, "0");
      localStorage.setItem(LS_DATE, todayStr());
      return 0;
    }
    return parseInt(localStorage.getItem(LS_COUNT) || "0", 10);
  } catch { return 0; }
}
function bumpAdSpins() {
  try {
    localStorage.setItem(LS_COUNT, String(getAdSpinsUsed() + 1));
    localStorage.setItem(LS_DATE, todayStr());
  } catch {}
}

function getAudioCtx(): AudioContext | null {
  try { return new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playTick(ctx: AudioContext, t: number) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.04);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.start(t); o.stop(t + 0.05);
}
function playSpinSound(ctx: AudioContext, dur: number) {
  const now = ctx.currentTime; let t = now, iv = 0.06;
  while (t < now + dur) { playTick(ctx, t); t += iv; iv = 0.06 + ((t - now) / dur) * 0.55; }
}
function playWinSound(ctx: AudioContext) {
  const now = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type = "sine";
    const tt = now + i * 0.13;
    o.frequency.setValueAtTime(freq, tt);
    g.gain.setValueAtTime(0, tt);
    g.gain.linearRampToValueAtTime(0.3, tt + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, tt + 0.35);
    o.start(tt); o.stop(tt + 0.4);
  });
}

export default function SpinWheelSection({ user, lang, onReward, onLock, onUnlock }: SpinWheelSectionProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const [isSpinning,        setIsSpinning]        = useState(false);
  const [rotation,          setRotation]          = useState(0);
  const [adSpinsUsed,       setAdSpinsUsed]       = useState(0);
  const [showNoSpinsModal,  setShowNoSpinsModal]  = useState(false);
  const [pendingToken,      setPendingToken]      = useState<string | null>(null);
  const [tokenLoading,      setTokenLoading]      = useState(false);
  const [showBuyModal,      setShowBuyModal]      = useState(false);
  const [showAdOverlay,     setShowAdOverlay]     = useState(false);
  const [buyLoading,        setBuyLoading]        = useState(false);
  const [starsLoading,      setStarsLoading]      = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const spinMutation         = trpc.spin.perform.useMutation();
  const getTokenMutation     = trpc.ads.getToken.useMutation();
  const claimMutation        = trpc.ads.claim.useMutation();
  const buySpinsMutation     = trpc.spin.buy.useMutation();
  const buyWithStarsMutation = trpc.spin.buyWithStars.useMutation();

  useEffect(() => { setAdSpinsUsed(getAdSpinsUsed()); }, []);
  useEffect(() => { drawWheel(); }, [rotation]);

  useEffect(() => {
    if (Number(user.spinsLeft) === 0) {
      const timer = setTimeout(() => setShowNoSpinsModal(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user.spinsLeft]);

  function drawWheel() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 15;
    const seg = PRIZES.length, arc = (2 * Math.PI) / seg;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#2d3436"; ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.stroke();

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
    for (let i = 0; i < seg; i++) {
      const s = i * arc, e = s + arc;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, s, e); ctx.closePath();
      ctx.fillStyle = PRIZES[i].color; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate(s + arc / 2); ctx.textAlign = "right";
      ctx.fillStyle = "#2d3436"; ctx.font = "bold 18px 'Inter',sans-serif";
      ctx.fillText(PRIZES[i].label, r - 25, 7); ctx.restore();
    }
    ctx.restore();

    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 30);
    grad.addColorStop(0, "#f1c40f"); grad.addColorStop(1, "#e67e22");
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("GO", cx, cy);

    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - r - 5); ctx.lineTo(cx + 10, cy - r - 5); ctx.lineTo(cx, cy - r + 15);
    ctx.closePath(); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
  }

  const handleSpinAdError = (description?: string) => {
    setShowAdOverlay(false);
    setPendingToken(null);
    onUnlock?.();
    if (description) {
      toast({ title: t.error, description: description.slice(0, 120), variant: 'destructive' });
    }
  };

  const handleWatchSpinAdClick = async () => {
    setShowNoSpinsModal(false);
    setTokenLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const tok = await getTokenMutation.mutateAsync({ telegramId: user.telegramId, initData, type: "spin" });
      if (!tok.success || !tok.token) throw new Error(tok.message || "فشل الحصول على التوكن");
      setPendingToken(tok.token);
      onLock?.();
      
      // Show Ad Overlay (Adsgram → Monetag fallback)
      setShowAdOverlay(true);
    } catch (e: any) {
      setPendingToken(null);
      onUnlock?.();
      toast({ title: t.error, description: e?.message || t.ad_load_failed, variant: "destructive" });
    } finally {
      setTokenLoading(false);
    }
  };

  const handleAdClaim = async () => {
    setShowAdOverlay(false);
    if (!pendingToken) return;
    const initData = (window as any).Telegram?.WebApp?.initData || "";
    try {
      const cl = await claimMutation.mutateAsync({ telegramId: user.telegramId, token: pendingToken, initData, type: "spin" });
      if (cl.success) {
        bumpAdSpins();
        setAdSpinsUsed(getAdSpinsUsed());
        const newBal   = cl.balance   !== undefined ? Number(cl.balance)   : user.balance + 100;
        const newSpins = cl.spinsLeft !== undefined ? Number(cl.spinsLeft) : user.spinsLeft + 1;
        onReward({ balance: newBal, spinsLeft: newSpins });
        toast({ title: t.spin_ready, description: t.spin_ready_desc });
      } else {
        throw new Error(cl.message || t.spin_failed);
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل", variant: "destructive" });
    } finally {
      setPendingToken(null);
      onUnlock?.();
    }
  };

  async function handleSpin() {
    if (isSpinning || Number(user.spinsLeft) <= 0) return;
    setIsSpinning(true);
    if (!audioCtxRef.current) audioCtxRef.current = getAudioCtx();
    const actx = audioCtxRef.current;
    if (actx?.state === "suspended") await actx.resume();

    try {
      const data = await spinMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: (window as any).Telegram?.WebApp?.initData || "",
      });
      if (!data.success) {
        toast({ title: t.notice, description: data.message || t.spin_failed, variant: "destructive" });
        setIsSpinning(false); onUnlock?.(); return;
      }

      const idx = PRIZES.findIndex(p => p.value === data.prize);
      const segAngle = (2 * Math.PI) / PRIZES.length;
      const target = rotation + 8 * Math.PI * 2 + (-(idx * segAngle + segAngle / 2) - Math.PI / 2 - rotation % (Math.PI * 2));
      const dur = 4000, t0 = Date.now(), r0 = rotation;

      onLock?.();
      if (actx) playSpinSound(actx, dur / 1000);

      const animate = () => {
        const p = Math.min((Date.now() - t0) / dur, 1);
        setRotation(r0 + (target - r0) * (1 - Math.pow(1 - p, 4)));
        if (p < 1) { requestAnimationFrame(animate); }
        else {
          if (actx) playWinSound(actx);
          toast({ title: t.congrats, description: `${t.won_points} ${data.prize} PTS` });
          const wonBalance = data.balance   !== undefined ? Number(data.balance)   : user.balance + (data.prize || 0);
          const wonSpins   = data.spinsLeft !== undefined ? Number(data.spinsLeft) : Math.max(0, user.spinsLeft - 1);
          onReward({ balance: wonBalance, spinsLeft: wonSpins });
          setIsSpinning(false);
          onUnlock?.();
          if (Number(wonSpins) === 0) {
            setTimeout(() => setShowNoSpinsModal(true), 1200);
          }
        }
      };
      animate();
    } catch {
      toast({ title: t.error, description: t.spin_error, variant: "destructive" });
      setIsSpinning(false);
      onUnlock?.();
    }
  }

  const adSpinsLeft = MAX_AD_SPINS - adSpinsUsed;

  // Spin packages
  const SPIN_PACKAGES = [
    { qty: 1, price: 500,  label: t.spin_one,           badge: null,                             color: "#6366f1" },
    { qty: 3, price: 1200, label: t.spin_package_3,     badge: t.spin_save + " 20%",             color: "#8B5CF6" },
    { qty: 5, price: 1800, label: t.spin_package_5,     badge: t.spin_best,                      color: "#EC4899" },
  ];

  const handleBuySpins = async (qty: number, price: number) => {
    if (buyLoading) return;
    if (user.balance < price) {
      toast({ title: t.insufficient_balance, description: `${t.need_points} ${price} ${t.points}. ${t.current_balance}: ${user.balance} ${t.points}`, variant: "destructive" });
      return;
    }
    setBuyLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const res = await buySpinsMutation.mutateAsync({ telegramId: user.telegramId, initData, quantity: qty });
      if (res.success) {
        onReward({ balance: Number(res.balance), spinsLeft: Number(res.spinsLeft) });
        setShowBuyModal(false);
        setShowNoSpinsModal(false);
        toast({ title: t.spin_purchased, description: `${t.deducted} ${price} ${t.points} ${t.from_balance}. ${t.play_now}` });
      } else {
        throw new Error((res as any).message || "فشلت العملية");
      }
    } catch (e: any) {
      toast({ title: t.error, description: e?.message || t.purchase_failed, variant: "destructive" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleBuyWithStars = async (qty: number) => {
    if (starsLoading) return;
    setStarsLoading(true);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const res = await buyWithStarsMutation.mutateAsync({ telegramId: user.telegramId, initData, quantity: qty });
      if (!res.success || !res.invoiceLink) throw new Error(res.message || "فشل إنشاء الفاتورة");
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(res.invoiceLink, (status: string) => {
          if (status === "paid") {
            setShowBuyModal(false);
            setShowNoSpinsModal(false);
            toast({ title: t.spin_paid, description: t.spin_paid_desc.replace("{qty}", qty.toString()) + "! " + t.restart_app });
          } else if (status === "cancelled") {
            toast({ title: t.spin_cancel, description: t.spin_cancel_desc, variant: "destructive" });
          }
        });
      } else {
        window.open(res.invoiceLink, "_blank");
        toast({ title: t.stars_payment_link, description: t.open_link_pay });
      }
    } catch (e: any) {
      toast({ title: t.error, description: e?.message || t.invoice_failed, variant: "destructive" });
    } finally {
      setStarsLoading(false);
    }
  };

  return (
    <>
      {/* Ad Overlay — Adsgram with Monetag fallback */}
      {showAdOverlay && (
        <AdOverlay
          blockId={user.adsgramBlockId || "33769"}
          monetagZoneId="11127757"
          
          seconds={15}
          rewardLabel={t.spin_ready_desc}
          lang={lang}
          onClaim={handleAdClaim}
          onClose={() => handleSpinAdError()}
        />
      )}

      {/* Buy Spins Modal */}
      {showBuyModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div style={{
            background: "linear-gradient(145deg, #0f0c29, #1a1040)",
            border: "1px solid rgba(139,92,246,0.5)",
            borderRadius: 28, padding: "28px 20px", maxWidth: 360, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 50px rgba(139,92,246,0.2)",
            position: "relative",
          }}>
            <button onClick={() => setShowBuyModal(false)} style={{
              position: "absolute", top: 14, left: 14,
              background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 10,
              width: 32, height: 32, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)",
            }}>
              <X size={16} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}></div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>{t.spin_buy_title}</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {`${t.current_balance}: `} <span style={{ color: "#facc15", fontWeight: 800 }}>{user.balance.toLocaleString()} {t.points}</span>
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              {SPIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.qty}
                  onClick={() => handleBuySpins(pkg.qty, pkg.price)}
                  disabled={buyLoading || user.balance < pkg.price}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 18, padding: "14px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: user.balance < pkg.price ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    opacity: user.balance < pkg.price ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${pkg.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: pkg.color }}>
                      <Lightning size={22} weight="fill" />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{pkg.label}</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>{pkg.badge || t.spin_no_save}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: "#facc15", margin: 0 }}>{pkg.price} ○</p>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
               <button
                  onClick={() => handleBuyWithStars(1)}
                  disabled={starsLoading}
                  style={{
                    width: "100%", height: 50, borderRadius: 16, border: "none",
                    background: "linear-gradient(135deg, #0088cc 0%, #00aaff 100%)",
                    color: "#fff", fontWeight: 800, fontSize: 14,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    cursor: "pointer", boxShadow: "0 4px 15px rgba(0,136,204,0.3)"
                  }}
                >
                  {starsLoading ? t.loading : (
                    <>
                      <span>★</span>
                      <span>{t.pay_with_stars}</span>
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* No Spins Modal */}
      {showNoSpinsModal && !showBuyModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div style={{
            background: "linear-gradient(145deg, #1a1c2c, #0f101a)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 32, padding: "32px 24px", maxWidth: 340, width: "100%",
            textAlign: "center", boxShadow: "0 32px 64px rgba(0,0,0,0.8)",
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", background: "rgba(239,68,68,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              color: "#EF4444",
            }}>
              <Television size={40} weight="duotone" />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10 }}>{t.spin_no_spins}</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 28 }}>
              {adSpinsLeft > 0 ? t.spin_ad_desc : t.spin_get_free}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {adSpinsLeft > 0 && (
                <button
                  onClick={handleWatchSpinAdClick}
                  disabled={tokenLoading}
                  style={{
                    width: "100%", height: 58, borderRadius: 18, border: "none",
                    background: "linear-gradient(135deg, #F59E0B, #D97706)",
                    color: "#fff", fontWeight: 900, fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    cursor: "pointer", boxShadow: "0 8px 20px rgba(245,158,11,0.3)",
                  }}
                >
                  {tokenLoading ? (
                    <div style={{ width: 20, height: 20, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <>
                      <Television size={20} weight="fill" />
                      <span>{t.watch_ad_earn_spin}</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => { setShowNoSpinsModal(false); setShowBuyModal(true); }}
                style={{
                  width: "100%", height: 58, borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff", fontWeight: 800, fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  cursor: "pointer",
                }}
              >
                <ShoppingCart size={20} />
                <span>{t.spin_buy_more}</span>
              </button>

              <button
                onClick={() => setShowNoSpinsModal(false)}
                style={{
                  marginTop: 8, background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t.spin_cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <Card style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 24, overflow: "hidden" }}>
        <CardHeader style={{ padding: "20px 20px 10px", textAlign: "center" }}>
          <CardTitle style={{ fontSize: 20, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Sparkle size={24} weight="fill" style={{ color: "#FACC15" }} />
            {t.spin_title}
          </CardTitle>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>{t.spin_subtitle}</p>
        </CardHeader>
        <CardContent style={{ padding: "10px 20px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: 280, height: 280, marginBottom: 24 }}>
            <canvas ref={canvasRef} width={280} height={280} style={{ width: "100%", height: "100%" }} />
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 14, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Lightning size={16} weight="fill" style={{ color: "#A78BFA" }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#A78BFA" }}>{t.remaining_tries}: {user.spinsLeft}</span>
              </div>
            </div>

            <button
              onClick={handleSpin}
              disabled={isSpinning || Number(user.spinsLeft) <= 0}
              style={{
                width: "100%", height: 64, borderRadius: 20, border: "none",
                background: !isSpinning && Number(user.spinsLeft) > 0
                  ? "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)"
                  : "rgba(255,255,255,0.05)",
                color: !isSpinning && Number(user.spinsLeft) > 0 ? "#fff" : "rgba(255,255,255,0.2)",
                fontWeight: 900, fontSize: 17,
                cursor: !isSpinning && Number(user.spinsLeft) > 0 ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                transition: "all 0.3s",
                boxShadow: !isSpinning && Number(user.spinsLeft) > 0
                  ? "0 10px 25px rgba(139,92,246,0.4)"
                  : "none",
              }}
            >
              {isSpinning ? (
                <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <>
                  <Sparkle size={20} weight="fill" />
                  <span>{t.spin_btn}</span>
                </>
              )}
            </button>

            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 4 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{t.spin_today_ads}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{adSpinsUsed}/5</p>
              </div>
              <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", alignSelf: "center" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{t.daily_renewal}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>00:00 UTC</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
