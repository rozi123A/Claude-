import { useState, useEffect } from "react";
  import { PaperPlaneTilt, Star, Warning, Wallet, CaretDown, Check, Copy } from "@phosphor-icons/react";
  import { useToast } from "@/hooks/use-toast";
  import { trpc } from "@/lib/trpc";
  import { translations, type Language } from "@/lib/i18n";

  // ✅ شعار DigiByte احترافي كـ SVG
  function DGBIcon({ size = 28 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dgbGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0E8FEF"/>
            <stop offset="100%" stopColor="#0044CC"/>
          </linearGradient>
        </defs>
        {/* Shield background */}
        <path d="M20 2 L36 9 L36 22 C36 30 28 37 20 39 C12 37 4 30 4 22 L4 9 Z" fill="url(#dgbGrad)"/>
        {/* DGB Letter D */}
        <path d="M13 13 L13 27 L19 27 C24 27 27 24 27 20 C27 16 24 13 19 13 Z M16.5 16 L19 16 C22 16 23.5 17.5 23.5 20 C23.5 22.5 22 24 19 24 L16.5 24 Z" fill="white"/>
      </svg>
    );
  }

  interface UserData { telegramId: number; balance: number; minWithdraw: number; starsRate: number; }
  interface WithdrawSectionProps { user: UserData; lang: Language; onSuccess: () => void; }

  type WithdrawalMethod = "telegram_stars" | "dgb";

  export default function WithdrawSection({ user, lang, onSuccess }: WithdrawSectionProps) {
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [showMethodMenu, setShowMethodMenu] = useState(false);
    const [showWalletSetup, setShowWalletSetup] = useState(false);
    const [method, setMethod] = useState<WithdrawalMethod>("dgb");
    const [dgbWallet, setDgbWallet] = useState("");
    const { toast } = useToast();
    const t = translations[lang];

    const withdrawMutation = trpc.withdraw.request.useMutation();
    const walletsQuery = trpc.withdraw.getWallets.useQuery({ 
      telegramId: user.telegramId, 
      initData: window.Telegram?.WebApp?.initData || "" 
    });
    const updateDgbWallet = trpc.withdraw.updateDgbWallet.useMutation();

    // Load saved wallets
    useEffect(() => {
      if (walletsQuery.data) {
        setDgbWallet((walletsQuery.data as any).dgbWallet || "");
      }
    }, [walletsQuery.data]);

    const numAmount = parseFloat(amount) || 0;
    const starsWorth = Math.floor(numAmount / user.starsRate);
    // 15000 points = 0.05 DGB
    const CRYPTO_BASE_POINTS = 15000;
    const CRYPTO_BASE_AMOUNT = 0.05;
    const cryptoAmount = numAmount > 0 ? parseFloat(((numAmount / CRYPTO_BASE_POINTS) * CRYPTO_BASE_AMOUNT).toFixed(4)) : 0;
    const canWithdraw = numAmount >= user.minWithdraw && numAmount <= user.balance;
    const hasEnoughBalance = user.balance >= user.minWithdraw;

    const methodInfo: Record<WithdrawalMethod, { icon: string; label: string; desc: string; color: string }> = {
      telegram_stars: { 
        icon: "⟠", 
        label: t.withdraw_method_stars || "DigiByte (DGB)", 
        desc: t.withdraw_method_stars_desc || "استلم نجوم تيليغرام مباشرة", 
        color: "#FFD700" 
      },
      dgb: { 
        icon: "dgb", 
        label: "DigiByte (DGB)", 
        desc: "سحب عبر محفظة DigiByte الآمنة", 
        color: "#0E8FEF" 
      },
    };

    const handleSaveWallets = async () => {
      if (!dgbWallet.trim()) {
        toast({ title: t.error, description: t.withdraw_no_wallet_error || "الرجاء إدخال عنوان المحفظة", variant: "destructive" });
        return;
      }
      try {
        await updateDgbWallet.mutateAsync({ telegramId: user.telegramId, initData: window.Telegram?.WebApp?.initData || "", wallet: dgbWallet });
        toast({ title: t.withdraw_wallet_saved_success || "تم الحفظ", description: t.withdraw_wallet_can_use || "يمكنك الآن السحب" });
        setShowWalletSetup(false);
        walletsQuery.refetch();
      } catch (e: any) {
        toast({ title: t.error, description: e.message || t.withdraw_save_failed || "فشل الحفظ", variant: "destructive" });
      }
    };

    const handleWithdraw = async () => {
      // Check if user has wallet for DGB method
      if (method === "dgb" && !dgbWallet) {
        toast({ title: " DigiByte", description: t.withdraw_no_wallet_error || "أضف عنوان محفظة DigiByte أولاً", variant: "destructive" });
        setShowWalletSetup(true);
        return;
      }

      if (!canWithdraw) return;

      // Show mandatory ad before withdrawal
      await new Promise<void>(resolve => {
        const fn = (window as any)['show_11127757'];
        if (typeof fn === 'function') {
          fn().then(() => resolve()).catch(() => resolve());
        } else {
          resolve();
        }
      });

      setLoading(true);
      try {
        const result = await withdrawMutation.mutateAsync({
          telegramId: user.telegramId,
          amount: numAmount,
          initData: window.Telegram?.WebApp?.initData || "",
          method,
        });
        if (result.success) {
          toast({ 
            title: t.withdraw_success, 
            description: result.message || t.withdraw_pending 
          });
          setAmount("");
          onSuccess();
        } else {
          toast({ title: t.error, description: result.message || t.withdraw_error, variant: "destructive" });
        }
      } catch (e: any) {
        toast({ title: t.error, description: e.message || t.withdraw_error, variant: "destructive" });
      } finally { setLoading(false); }
    };

    const pct = Math.min((user.balance / user.minWithdraw) * 100, 100);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Balance overview */}
        <div style={{ borderRadius: 22, padding: 20, background: "linear-gradient(145deg, #071a14, #051210)", border: "1px solid rgba(16,185,129,0.25)", boxShadow: "0 4px 30px rgba(16,185,129,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 9, color: "rgba(16,185,129,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>{t.balance}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#34D399,#10B981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user.balance.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: "rgba(16,185,129,0.45)", fontWeight: 700 }}>{t.points}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "rgba(14,143,239,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>DGB المكافأة</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#0E8FEF" }}>⟠ {((user.balance / 15000) * 0.05).toFixed(4)}</p>
            </div>
          </div>

          {/* Progress to min withdraw */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{t.min_withdraw}</p>
              <p style={{ fontSize: 10, fontWeight: 800, color: pct >= 100 ? "#10B981" : "#FFD700" }}>{user.minWithdraw.toLocaleString()} {t.points}</p>
            </div>
            <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FFD700)", borderRadius: 6, transition: "width 0.6s ease", boxShadow: pct >= 100 ? "0 0 12px rgba(16,185,129,0.5)" : "none" }} />
            </div>
          </div>
        </div>

        {!hasEnoughBalance && (
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Warning size={20} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FCD34D", marginBottom: 3 }}>{t.not_enough_balance}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>{t.need_more_points} {(user.minWithdraw - user.balance).toLocaleString()} {t.points} {t.to_reach_min}</p>
            </div>
          </div>
        )}

        {/* Withdrawal Method Selector — always visible so users can set up wallets early */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 16px" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{t.withdraw_method_title}</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["dgb"] as WithdrawalMethod[]).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  if (m === "dgb" && !dgbWallet) setShowWalletSetup(true);
                  if (m === "telegram_stars") setShowWalletSetup(false);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 12, border: `2px solid ${method === m ? methodInfo[m].color : "rgba(255,255,255,0.08)"}`,
                  background: method === m ? `${methodInfo[m].color}15` : "rgba(255,255,255,0.02)",
                  cursor: "pointer", transition: "all 0.2s", textAlign: "left"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
                    {m === "dgb" ? <DGBIcon size={28} /> : <span style={{ fontSize: 22 }}>{methodInfo[m].icon}</span>}
                  </span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: method === m ? methodInfo[m].color : "#fff", marginBottom: 2 }}>{methodInfo[m].label}</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{methodInfo[m].desc}</p>
                </div>
                {method === m && <Check size={18} color={methodInfo[m].color} />}
                {m === "dgb" && (
                  <div style={{ 
                    fontSize: 9, padding: "3px 8px", borderRadius: 6,
                    background: dgbWallet ? "rgba(0,102,204,0.2)" : "rgba(255,255,255,0.06)",
                    color: dgbWallet ? "#0099FF" : "rgba(255,255,255,0.3)"
                  }}>
                    {dgbWallet ? (t.withdraw_wallet_saved || "محفوظ") : (t.withdraw_wallet_add || "أضف")}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Setup Section — always visible for TON/USDT */}
        {method === "dgb" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={16} style={{ color: methodInfo[method].color }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                  محفظة DigiByte (DGB)
                </p>
              </div>
              <button 
                onClick={() => setShowWalletSetup(!showWalletSetup)}
                style={{ fontSize: 10, color: methodInfo[method].color, background: "none", border: "none", cursor: "pointer" }}
              >
                {showWalletSetup ? (t.withdraw_wallet_hide || "إخفاء") : dgbWallet ? (t.withdraw_wallet_edit || "تعديل") : (t.withdraw_wallet_add)}
              </button>
            </div>

            {dgbWallet && !showWalletSetup ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(0,102,204,0.1)", borderRadius: 10 }}>
                <code style={{ fontSize: 11, color: "#0099FF", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {dgbWallet}
                </code>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(dgbWallet);
                    toast({ title: t.success || "تم", description: t.withdraw_wallet_copied || "تم نسخ العنوان" });
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <Copy size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  placeholder="D7xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={dgbWallet}
                  onChange={e => setDgbWallet(e.target.value)}
                  style={{ 
                    width: "100%", padding: "12px 14px", borderRadius: 12, 
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box"
                  }}
                />
                <button
                  onClick={handleSaveWallets}
                  style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #0066CC, #0052A3)",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  {t.withdraw_save_wallet}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Amount Input + CTA — only when balance is enough */}
        {hasEnoughBalance && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{t.withdraw_select_amount}</p>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={t.withdraw_minimum_placeholder?.replace("{min}", user.minWithdraw.toLocaleString()) || `الحد الأدنى ${user.minWithdraw.toLocaleString()}`}
                    style={{ width: "100%", height: 54, borderRadius: 16, padding: "0 16px", background: "rgba(255,255,255,0.04)", border: `1px solid ${numAmount > 0 && !canWithdraw ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`, color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                {numAmount > 0 && (
                  <p style={{ fontSize: 11, color: methodInfo[method].color, fontWeight: 600, marginTop: 6 }}>
                    ⟠ {cryptoAmount} DGB
                  </p>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[user.minWithdraw, Math.floor(user.balance / 2), user.balance].map((v, i) => (
                  <button key={i} onClick={() => setAmount(String(v))} style={{ height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {i === 0 ? (t.withdraw_quick_select) : i === 1 ? (t.withdraw_quick_half) : (t.withdraw_quick_all)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={!canWithdraw || loading}
              style={{
                width: "100%", height: 60, borderRadius: 20, border: "none",
                cursor: canWithdraw && !loading ? "pointer" : "not-allowed",
                fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                background: canWithdraw && !loading ? `linear-gradient(135deg, ${methodInfo[method].color}, ${methodInfo[method].color}cc)` : "rgba(255,255,255,0.05)",
                color: canWithdraw && !loading ? "#fff" : "rgba(255,255,255,0.25)",
                boxShadow: canWithdraw && !loading ? `0 6px 24px ${methodInfo[method].color}40` : "none",
                transition: "all 0.3s",
              }}
            >
              {loading ? (
                <div style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <PaperPlaneTilt size={20} />
              )}
              {loading ? (t.withdraw_sending || "جاري الإرسال...") : method === "telegram_stars" ? `${t.withdraw || "سحب"} ${starsWorth > 0 ? starsWorth : "?"} ${methodInfo[method].label}` : `${t.withdraw || "سحب"} ${cryptoAmount > 0 ? cryptoAmount : "?"} ${methodInfo[method].label}`}
            </button>
          </>
        )}

        {/* Info cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: t.withdraw_conversion_rate || "سعر التحويل", value: method === "telegram_stars" ? `${user.starsRate} ${t.points} = 1 ⟠` : `15000 ${t.points} = 0.05 DGB`, color: "#A78BFA" },
            { label: t.withdraw_minimum_amount, value: `${user.minWithdraw.toLocaleString()} ${t.points}`, color: "#60A5FA" },
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
