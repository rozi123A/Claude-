import { useState, useEffect, useCallback, useRef } from "react";
import { CaretRight, ClockCounterClockwise } from "@phosphor-icons/react";
import { translations, type Language } from "@/lib/i18n";
import WatchAdsSection from "@/components/adsgram/WatchAdsSection";
import SpinWheelSection from "@/components/adsgram/SpinWheelSection";
import WithdrawSection from "@/components/adsgram/WithdrawSection";
import ReferralSection from "@/components/adsgram/ReferralSection";
import DailyGiftBox from "@/components/adsgram/DailyGiftBox";
import LeaderboardSection from "@/components/adsgram/LeaderboardSection";
import StreakBanner from "@/components/adsgram/StreakBanner";
import StatsSection from "@/components/adsgram/StatsSection";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import CryptoMarketSection from "@/components/adsgram/CryptoMarketSection";

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
  monetagZoneId?: string;
  monetagScriptUrl?: string;
  lastAdTime: number | null;
  isAdmin: boolean;
  isBanned: boolean;
  dailyStreak: number;
  badges: string[];
  newBadges?: string[];
}

const DEFAULT_DEMO_USER: UserData = {
  telegramId: 123456789,
  balance: 0,
  totalEarned: 0,
  todayAds: 0,
  spinsLeft: 5,
  referralCode: "ref_NEW",
  adReward: 10,
  minWithdraw: 10000,
  starsRate: 1000,
  adCooldown: 30,
  monetagZoneId: "",
  monetagScriptUrl: "",
  lastAdTime: null,
  isAdmin: false,
  isBanned: false,
  dailyStreak: 0,
  badges: [],
};

function RedeemCodeBox({ telegramId, lang, onReward }: { telegramId: number; lang: Language; onReward: (balance: number) => void }) {
  const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData || "" : "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const { toast } = useToast();
  const redeemMut = trpc.codes.redeem.useMutation();
  const t = translations[lang];

  const handleRedeem = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await redeemMut.mutateAsync({ telegramId, initData, code: code.trim() });
      if (res.success) {
        setMsg({ text: res.message || t.redeem_success, ok: true });
        setCode("");
        if (res.balance) onReward(res.balance);
      } else {
        setMsg({ text: res.message || t.error, ok: false });
      }
    } catch {
      setMsg({ text: t.redeem_error || "حاول مجدداً", ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(16,185,129,0.12)", display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.07)" }}>
        <span style={{ fontSize: 15 }}></span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.redeem_code}</span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setMsg(null); }}
            onKeyDown={e => e.key === "Enter" && handleRedeem()}
            placeholder={t.redeem_placeholder}
            style={{ flex: 1, borderRadius: 12, padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(16,185,129,0.2)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "monospace", letterSpacing: "0.05em" }}
          />
          <button
            onClick={handleRedeem}
            disabled={!code.trim() || loading}
            style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "none", background: code.trim() ? "linear-gradient(135deg,#10B981,#059669)" : "rgba(255,255,255,0.05)", color: code.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 900, fontSize: 13, cursor: code.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>
            {loading ? (t.redeem_loading) : (t.redeem_button)}
          </button>
        </div>
        {msg && (
          <p style={{ fontSize: 12, fontWeight: 700, color: msg.ok ? "#34D399" : "#FCA5A5", margin: 0, textAlign: "center", padding: "6px 0" }}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityLog({ telegramId, lang }: { telegramId: number; lang: Language }) {
  const initData = typeof window !== "undefined" ? (window as any).Telegram?.WebApp?.initData || "" : "";
  const { data: transactions, isLoading } = trpc.telegram.getTransactions.useQuery({ telegramId, initData: initData }, { enabled: !!initData });
  const t = translations[lang];
  const typeIcons: Record<string, string> = { ad: "", spin: "", referral: "👥", withdraw: "💸", bonus: "", task: "" };
  const typeColors: Record<string, string> = { ad: "#F59E0B", spin: "#10B981", referral: "#3B82F6", withdraw: "#EF4444", bonus: "#10B981", task: "#6366F1" };

  if (isLoading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
      <div style={{ width: 28, height: 28, border: "3px solid rgba(16,185,129,0.3)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
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
  const [errorType, setErrorType] = useState<null | "no_telegram" | "no_user">(null);
    const [showWelcome, setShowWelcome] = useState<boolean>(() => {
      try { return !localStorage.getItem("jufostars_welcomed"); } catch { return true; }
    });
    const dismissWelcome = () => {
      try { localStorage.setItem("jufostars_welcomed", "1"); } catch {}
      setShowWelcome(false);
    };

    // ✅ Rotating subtitle text on loading screen
    const [loadTextIdx, setLoadTextIdx] = useState(0);
    const LOAD_TEXTS = [
      "اربح DGB · شاهد الإعلانات واكسب",
      "Зарабатывай DGB · Смотри рекламу",
      "Earn DGB · Watch Ads & Win",
    ];
    useEffect(() => {
      const iv = setInterval(() => setLoadTextIdx(i => (i + 1) % 3), 1200);
      return () => clearInterval(iv);
    }, []);

  const [activeTab, setActiveTab] = useState("home");
  const tabAdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showMonetagAd() {
    const fn = (window as any)['show_11127757'];
    if (typeof fn === 'function') { fn().catch(() => {}); }
  }
  const [isNavLocked, setIsNavLocked] = useState(false);
  const [lang, setLang] = useState<Language>("ar");
  const [dgbPrice, setDgbPrice] = useState<number|null>(null);
const [displayName, setDisplayName] = useState("");
  const { toast } = useToast();
  const t = translations[lang];
  const getUserMutation = trpc.telegram.getUser.useMutation();
const checkMemberMutation = trpc.telegram.checkChannelMember.useMutation();
const [memberStatus, setMemberStatus] = useState<'checking' | 'not_member' | 'member'>('checking');
const [recheckLoading, setRecheckLoading] = useState(false);
const memberVerifiedRef = useRef(false);

  const toggleLanguage = () => {
    const langs: Language[] = ["ar", "en", "ru"];
    setLang(langs[(langs.indexOf(lang) + 1) % langs.length]);
  };

  useEffect(() => { initializeTelegramApp(); }, []);

    // ✅ Safety timeout — max 5s loading, then show app
    useEffect(() => {
      const t = setTimeout(() => {
        setLoading(prev => {
          if (prev) { setUser(u => u ?? { ...DEFAULT_DEMO_USER }); return false; }
          return prev;
        });
      }, 5000);
      return () => clearTimeout(t);
    }, []);

  // Force banned users back to home if they land on a restricted tab
  useEffect(() => {
    if (!user?.isBanned) return;
    const restricted = ["ads", "spin", "friends", "withdraw"];
    if (restricted.includes(activeTab)) setActiveTab("home");
  }, [user?.isBanned, activeTab]);

  const initializeTelegramApp = async () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand();
        const initData = tg.initData;
        const telegramUser = tg.initDataUnsafe?.user;
        const startParam = tg.initDataUnsafe?.start_param
          || new URLSearchParams(window.location.search).get('ref') || undefined;
        if (!telegramUser) {
          // No user data (opened in browser) — use demo mode
          setUser({ ...DEFAULT_DEMO_USER });
          setLoading(false);
          return;
        }
        setDisplayName(telegramUser.first_name || telegramUser.username || "");
          // ✅ Membership check — background only, does NOT block startup
            if (!memberVerifiedRef.current) {
              checkMemberMutation.mutateAsync({
                telegramId: telegramUser.id,
                initData: initData || "",
              }).then(result => {
                if (result.isMember) {
                  memberVerifiedRef.current = true;
                  setMemberStatus('member');
                } else {
                  setMemberStatus('not_member');
                }
              }).catch(() => {
                memberVerifiedRef.current = true;
                setMemberStatus('member');
              });
            }
          try {
           // Detect country from device timezone (most accurate, no API needed)
          let userCountry: string | undefined;
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            const tzMap: Record<string,string> = {
              'Africa/Algiers':'الجزائر','Africa/Tunis':'تونس','Africa/Casablanca':'المغرب',
              'Africa/Tripoli':'ليبيا','Africa/Cairo':'مصر','Africa/Khartoum':'السودان',
              'Africa/Mogadishu':'الصومال','Africa/Nouakchott':'موريتانيا',
              'Asia/Riyadh':'السعودية','Asia/Dubai':'الإمارات','Asia/Kuwait':'الكويت',
              'Asia/Qatar':'قطر','Asia/Bahrain':'البحرين','Asia/Muscat':'عمان',
              'Asia/Baghdad':'العراق','Asia/Beirut':'لبنان','Asia/Damascus':'سوريا',
              'Asia/Amman':'الأردن','Asia/Gaza':'فلسطين','Asia/Hebron':'فلسطين',
              'Asia/Aden':'اليمن','Asia/Sanaa':'اليمن',
              'Asia/Tehran':'إيران','Asia/Istanbul':'تركيا','Asia/Kabul':'أفغانستان',
              'Asia/Karachi':'باكستان','Asia/Kolkata':'الهند','Asia/Dhaka':'بنغلاديش',
              'Asia/Jakarta':'إندونيسيا','Asia/Manila':'الفلبين','Asia/Shanghai':'الصين',
              'Asia/Tokyo':'اليابان','Asia/Seoul':'كوريا الجنوبية',
              'Europe/Moscow':'روسيا','Europe/Kiev':'أوكرانيا','Europe/London':'بريطانيا',
              'Europe/Paris':'فرنسا','Europe/Berlin':'ألمانيا','Europe/Rome':'إيطاليا',
              'Europe/Madrid':'إسبانيا','Europe/Amsterdam':'هولندا','Europe/Stockholm':'السويد',
              'America/New_York':'أمريكا','America/Los_Angeles':'أمريكا','America/Chicago':'أمريكا',
              'America/Sao_Paulo':'البرازيل','America/Mexico_City':'المكسيك',
              'Africa/Lagos':'نيجيريا','Africa/Nairobi':'كينيا','Africa/Addis_Ababa':'إثيوبيا',
              'Africa/Johannesburg':'جنوب أفريقيا','Africa/Accra':'غانا',
              'Australia/Sydney':'أستراليا','Pacific/Auckland':'نيوزيلندا',
            };
            if (tz && tzMap[tz]) {
              userCountry = tzMap[tz];
            } else if (tz) {
              // Fallback: extract region from timezone like "Africa/Algiers" → "Algiers"
              const parts = tz.split('/');
              userCountry = parts[parts.length - 1]?.replace(/_/g, ' ') || undefined;
            }
            // Second fallback: use locale region code if timezone didn't give a result
            if (!userCountry) {
              const locale = navigator.language || '';
              if (locale.includes('-')) {
                const regionCode = locale.split('-')[1]?.toUpperCase();
                const regionMap: Record<string,string> = { DZ:'الجزائر',MA:'المغرب',TN:'تونس',SA:'السعودية',EG:'مصر',IQ:'العراق',LB:'لبنان',JO:'الأردن',AE:'الإمارات',QA:'قطر',KW:'الكويت',BH:'البحرين',OM:'عمان',SY:'سوريا',YE:'اليمن',LY:'ليبيا',SD:'السودان',PS:'فلسطين',RU:'روسيا',US:'أمريكا',GB:'بريطانيا',FR:'فرنسا',DE:'ألمانيا',TR:'تركيا',IN:'الهند',PK:'باكستان' };
                userCountry = regionMap[regionCode] || regionCode;
              }
            }
          } catch { /* ignore */ }
  const deviceInfo = `${navigator.userAgent} | ${navigator.language} | ${screen.width}x${screen.height}`;
  const data = await getUserMutation.mutateAsync({
              telegramId: telegramUser.id,
              initData: initData || "",
              referredBy: startParam ? parseInt(startParam.replace(/^ref_/i, "")) || undefined : undefined,
              country: userCountry,
              deviceInfo,
            }).catch(() => ({ success: false, user: null }));
          if (data?.success && data.user) setUser(data.user as UserData);
          else setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id });
        } catch { setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id }); }
      } else {
        // No Telegram context (browser/moderator review) — use demo mode
        setUser({ ...DEFAULT_DEMO_USER });
      }
    } catch { setUser({ ...DEFAULT_DEMO_USER }); }
    finally { setLoading(false); }
  };

  const recheckMembership = async () => {
      if (typeof window === "undefined" || !window.Telegram?.WebApp) return;
      const tg = window.Telegram.WebApp;
      const telegramUser = tg.initDataUnsafe?.user;
      if (!telegramUser) return;
      setRecheckLoading(true);
      try {
        const memberResult = await checkMemberMutation.mutateAsync({
          telegramId: telegramUser.id,
          initData: tg.initData || "",
        });
        if (memberResult.isMember) {
          memberVerifiedRef.current = true;
          setMemberStatus('member');
          await initializeTelegramApp();
        } else {
          setMemberStatus('not_member');
        }
      } catch {
        setMemberStatus('not_member');
      } finally {
        setRecheckLoading(false);
      }
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

    // ✅ Mandatory channel subscription gate
    if (!loading && memberStatus === 'not_member' && user?.telegramId !== 123456789) {
      const channelUrl = 'https://t.me/Earn130';
      return (
        <div style={{ minHeight:'100vh', background:'#060610', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', color:'#fff', fontFamily:'sans-serif' }}>
          <style>{'@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes spin2{to{transform:rotate(360deg)}}'}</style>
          <div style={{ width:90, height:90, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24, animation:'pulse 2.5s ease-in-out infinite', boxShadow:'0 0 40px rgba(99,102,241,0.4)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8l-2.1 9.9c-.16.74-.6.92-1.2.57l-3.3-2.43-1.59 1.53c-.18.18-.33.33-.67.33l.24-3.38 6.14-5.55c.27-.24-.06-.37-.41-.13l-7.59 4.78-3.27-1.02c-.71-.22-.72-.71.15-1.05l12.77-4.93c.58-.22 1.1.13.83 1.38z" fill="white"/>
            </svg>
          </div>
          <h2 style={{ fontSize:22, fontWeight:900, margin:'0 0 10px', textAlign:'center' }}>اشترك في القناة أولاً</h2>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.55)', textAlign:'center', margin:'0 0 28px', lineHeight:1.6 }}>
            يجب الاشتراك في قناتنا الرسمية<br/>للوصول إلى التطبيق والحصول على المكافآت
          </p>
          <div style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:14, padding:'12px 24px', marginBottom:24, fontSize:16, fontWeight:700, color:'#a78bfa', letterSpacing:1 }}>
            @Earn130
          </div>
          <a href={channelUrl} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', width:'100%', maxWidth:320, background:'linear-gradient(135deg,#6366f1,#a78bfa)', color:'#fff', borderRadius:16, padding:'15px 24px', fontSize:16, fontWeight:800, textAlign:'center', textDecoration:'none', marginBottom:14, boxShadow:'0 4px 20px rgba(99,102,241,0.4)' }}
          >
            📢 اشترك في القناة
          </a>
          <button onClick={recheckMembership} disabled={recheckLoading}
            style={{ width:'100%', maxWidth:320, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.8)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'14px 24px', fontSize:15, fontWeight:600, cursor:recheckLoading?'not-allowed':'pointer' }}
          >
            {recheckLoading
              ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin2 0.8s linear infinite', display:'inline-block' }} />
                  جارٍ التحقق...
                </span>
              : '✅ تحققت من الاشتراك'}
          </button>
          <p style={{ marginTop:20, fontSize:12, color:'rgba(255,255,255,0.3)', textAlign:'center' }}>
            بعد الاشتراك اضغط "تحققت من الاشتراك"
          </p>
        </div>
      );
    }
    

    if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060610", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes fadeSlide { 0%{opacity:0;transform:translateY(8px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-8px)} }
          @keyframes dgbFloat { 0%,100%{transform:perspective(200px) rotateX(15deg) translateY(0);text-shadow:0 1px 0 #0960a0,0 2px 0 #084f8a,0 3px 0 #063e70,0 4px 4px rgba(0,0,0,0.4),0 0 20px rgba(14,143,239,0.9);} 50%{transform:perspective(200px) rotateX(15deg) translateY(-5px);text-shadow:0 1px 0 #0a6eb5,0 2px 0 #0960a0,0 3px 0 #084f8a,0 4px 0 #063e70,0 5px 5px rgba(0,0,0,0.3),0 0 30px rgba(14,143,239,1),0 0 50px rgba(168,85,247,0.5);} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.12);opacity:0.85} }
        @keyframes float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes orbMove1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-40px,30px)} }
        @keyframes orbMove2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-40px)} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1.1);opacity:1} }
        @keyframes gradientFlow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes starTwinkle { 0%,100%{opacity:0;transform:scale(0) rotate(0deg)} 50%{opacity:1;transform:scale(1) rotate(20deg)} }
      `}</style>

      {/* Background orbs */}
      <div style={{ position:"absolute", width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,rgba(5,150,105,0.2),transparent 70%)", top:"-80px", right:"-60px", animation:"orbMove1 8s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:280, height:280, borderRadius:"50%", background:"radial-gradient(circle,rgba(14,143,239,0.18),transparent 70%)", bottom:"-60px", left:"-40px", animation:"orbMove2 10s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:220, height:220, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.1),transparent 70%)", top:"40%", left:"-50px", animation:"orbMove1 12s ease-in-out infinite reverse", pointerEvents:"none" }} />

      {/* Star particles */}
      {([
        {top:"14%", left:"10%",  size:14, delay:"0s",   dur:"3.2s"},
        {top:"20%", right:"13%", size:10, delay:"0.7s",  dur:"2.8s"},
        {top:"65%", left:"7%",   size:12, delay:"1.3s",  dur:"3.8s"},
        {top:"72%", right:"9%",  size:16, delay:"0.4s",  dur:"3.5s"},
        {top:"42%", right:"4%",  size:8,  delay:"1.9s",  dur:"2.6s"},
        {top:"33%", left:"4%",   size:10, delay:"2.1s",  dur:"3s"},
      ] as {top?:string;left?:string;right?:string;bottom?:string;size:number;delay:string;dur:string}[]).map((s,i)=>(
        <div key={i} style={{ position:"absolute", top:s.top, left:s.left, right:s.right, bottom:s.bottom, animation:`starTwinkle ${s.dur} ${s.delay} ease-in-out infinite`, pointerEvents:"none" }}>
          
        </div>
      ))}

      {/* Logo */}
      <div style={{ position:"relative", marginBottom:36, animation:"float 3s ease-in-out infinite" }}>
        <div style={{ position:"absolute", inset:-18, borderRadius:"50%", background:"radial-gradient(circle,rgba(5,150,105,0.3),transparent 70%)", animation:"pulse 2.5s ease-in-out infinite" }} />
        <div style={{ position:"absolute", inset:-8, width:116, height:116, borderRadius:"50%", border:"2.5px solid transparent", borderTopColor:"#10B981", borderRightColor:"#0E8FEF", borderBottomColor:"rgba(16,185,129,0.25)", borderLeftColor:"rgba(14,143,239,0.25)", animation:"spin 2s linear infinite" }} />
        <div style={{ position:"absolute", inset:-16, width:132, height:132, borderRadius:"50%", border:"1.5px solid transparent", borderTopColor:"rgba(255,215,0,0.45)", borderBottomColor:"rgba(16,185,129,0.45)", animation:"spin 5s linear infinite reverse" }} />
        <div style={{ width:100, height:100, borderRadius:"50%", background:"linear-gradient(145deg,#0d1535,#090d28)", border:"1px solid rgba(16,185,129,0.4)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 50px rgba(14,143,239,0.4), 0 0 100px rgba(5,150,105,0.2), inset 0 1px 0 rgba(14,143,239,0.15)" }}>
          <span style={{
              fontSize:28, fontWeight:900, display:"block", lineHeight:1,
              color:"#4FC3F7",
              letterSpacing:"0.04em",
              fontFamily:"'Inter',system-ui,sans-serif",
              animation:"dgbFloat 2s ease-in-out infinite",
              textShadow:"0 1px 0 #0960a0,0 2px 0 #084f8a,0 3px 0 #063e70,0 4px 4px rgba(0,0,0,0.4),0 0 20px rgba(14,143,239,0.9),0 0 40px rgba(14,143,239,0.4)",
              transform:"perspective(200px) rotateX(15deg)",
            }}>DGB</span>
        </div>
      </div>

      {/* App name */}
      <h1 style={{ fontSize:32, fontWeight:900, margin:"0 0 6px", background:"linear-gradient(135deg,#6EE7B7,#FFD700,#A855F7,#0E8FEF)", backgroundSize:"200% 200%", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"gradientFlow 4s ease infinite", letterSpacing:"-0.02em" }}>
        EarnStar
      </h1>
      <p key={loadTextIdx} style={{ fontSize:11, color:"rgba(168,85,247,0.85)", fontWeight:700, margin:0, letterSpacing:"0.12em", textTransform:"uppercase", animation:"fadeSlide 2.4s ease-in-out", minHeight:18 }}>
        {LOAD_TEXTS[loadTextIdx]}
      </p>

      {/* Dots loader */}
      <div style={{ display:"flex", gap:9, marginTop:36 }}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{ width:9, height:9, borderRadius:"50%", background:i%2===0?"#10B981":"#FFD700", animation:`dotBounce 1.4s ${i*0.2}s ease-in-out infinite` }} />
        ))}
      </div>

      <p style={{ position:"absolute", bottom:28, fontSize:10, color:"rgba(255,255,255,0.12)", fontWeight:600, letterSpacing:"0.18em", textTransform:"uppercase", margin:0 }}>
        Jufo Utility Stars ✦ DGB Rewards
      </p>
    </div>
  );

  if (false && errorType === "no_telegram") return ( // disabled: always show demo
    <div style={{ minHeight:"100vh", background:"linear-gradient(170deg,#060610 0%,#0d0820 60%,#060610 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px", textAlign:"center", fontFamily:"'Segoe UI',sans-serif", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes lp-pulse{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:0.8;transform:scale(1.08)}}
        @keyframes lp-orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}}
        @keyframes lp-orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
      `}</style>
      <div style={{ position:"fixed",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.18),transparent 70%)",top:"-80px",right:"-60px",animation:"lp-orb1 9s ease-in-out infinite",pointerEvents:"none" }} />
      <div style={{ position:"fixed",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,0.12),transparent 70%)",bottom:"-60px",left:"-40px",animation:"lp-orb2 11s ease-in-out infinite",pointerEvents:"none" }} />
      <div style={{ animation:"lp-float 3s ease-in-out infinite",marginBottom:24,position:"relative" }}>
        <div style={{ position:"absolute",inset:-20,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.3),transparent 70%)",animation:"lp-pulse 2.5s ease-in-out infinite" }} />
        <div style={{ width:96,height:96,borderRadius:28,background:"linear-gradient(135deg,#059669,#EC4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,boxShadow:"0 0 50px rgba(4,120,87,0.5)" }}>💎</div>
      </div>
      <h1 style={{ color:"#fff",fontSize:28,fontWeight:900,margin:"0 0 8px",letterSpacing:"-0.5px" }}>EarnStar</h1>
      <p style={{ color:"rgba(255,255,255,0.5)",fontSize:13,margin:"0 0 28px",fontWeight:500 }}>Watch Ads · Spin & Win · Earn DigiByte (DGB)</p>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:32,width:"100%",maxWidth:340 }}>
        {[{icon:"📺",label:"Watch Ads",sub:"Earn points"},{icon:"🎡",label:"Spin Wheel",sub:"Win prizes"},{icon:"💸",label:"Withdraw",sub:"Get DGB"}].map((f,i)=>(
          <div key={i} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
            <span style={{ fontSize:24 }}>{f.icon}</span>
            <span style={{ fontSize:10,fontWeight:800,color:"#E2E8F0" }}>{f.label}</span>
            <span style={{ fontSize:9,color:"rgba(255,255,255,0.35)" }}>{f.sub}</span>
          </div>
        ))}
      </div>
      <a href="https://t.me/EarnStar123Bot/app" target="_blank" rel="noopener noreferrer"
        style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",maxWidth:300,height:56,borderRadius:18,background:"linear-gradient(135deg,#059669,#4F46E5)",color:"#fff",fontWeight:900,fontSize:17,textDecoration:"none",boxShadow:"0 8px 32px rgba(4,120,87,0.45)",marginBottom:12 }}>
        <span style={{ fontSize:22 }}>✈️</span> Open in Telegram
      </a>
      <a href="https://t.me/EarnStar123Bot" target="_blank" rel="noopener noreferrer"
        style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",maxWidth:300,height:46,borderRadius:16,background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:14,textDecoration:"none",border:"1px solid rgba(255,255,255,0.12)" }}>
        🤖 @EarnStar123Bot
      </a>
      <p style={{ color:"rgba(255,255,255,0.4)",fontSize:11,marginTop:20 }}>Optimized for Telegram Mini App experience</p>
    </div>
  );

  if (errorType === "no_user") return (
    <div style={{ minHeight: "100vh", background: "#070711", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🤖</div>
      <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, margin: 0 }}>افتح البوت واضغط Start أولاً</h2>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        يبدو أنك لم تبدأ البوت بعد.<br/>
        افتح البوت في Telegram، اضغط <strong style={{ color: "#10B981" }}>Start</strong>، ثم أعد فتح التطبيق.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: 8, padding: "12px 32px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #10B981, #047857)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
      >
        إعادة المحاولة
      </button>
    </div>
  );

  const safeUser = user || DEFAULT_DEMO_USER;
  const ADMIN_TELEGRAM_ID = 5279238199;
  const tgUserId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const isAdmin = safeUser.isAdmin === true || Number(tgUserId) === ADMIN_TELEGRAM_ID;
  const dgbEquivalent = ((safeUser.balance / 15000) * 0.05).toFixed(4);

  if (safeUser.isBanned && !isAdmin) return (
    <div style={{ minHeight: "100vh", background: "#060408", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "36px 28px", textAlign: "center", zIndex: 1 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>🚫</div>
          <div style={{ position: "absolute", bottom: -4, right: -4, width: 30, height: 30, borderRadius: "50%", background: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✕</div>
        </div>
        <div>
          <h1 style={{ color: "#EF4444", fontSize: 24, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Account Permanently Banned</h1>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, margin: 0, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>PERMANENT BAN · EarnStar</p>
        </div>
        <div style={{ width: "100%", maxWidth: 310, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 18, padding: "18px 18px" }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.85, margin: 0 }}>
            Your account has been <strong style={{ color: "#FCA5A5" }}>permanently banned</strong> due to a violation of our Terms of Service.<br/>
            The use of <strong style={{ color: "#FCA5A5" }}>scripts, bots, or automation tools</strong> is strictly prohibited.
          </p>
        </div>
        <div style={{ width: "100%", maxWidth: 310, display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            { icon: "🤖", text: "Script or bot usage detected on your account" },
            { icon: "⚡", text: "Suspicious and abnormal activity recorded" },
            { icon: "🔒", text: "This ban is permanent and enforced by the platform" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 12, padding: "10px 14px" }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", lineHeight: 1.7, maxWidth: 270, margin: "2px 0 0" }}>
          If you believe this is a mistake, please contact the admin via Telegram.
        </p>
      </div>
    </div>
  );

  const NAV_ALL = [
    { id: "home",        label: t.home,                               color: "#10B981", bannedAllowed: true  },
    { id: "ads",         label: t.ads,                                color: "#F59E0B", bannedAllowed: false },
    { id: "spin",        label: t.spin,                               color: "#EC4899", bannedAllowed: false },
    { id: "friends",     label: t.friends_title,                      color: "#3B82F6", bannedAllowed: false },
    { id: "leaderboard", label: t.leaderboard,                        color: "#FFD700", bannedAllowed: true  },
    { id: "withdraw",    label: t.withdraw,                           color: "#10B981", bannedAllowed: false },
    { id: "stats",       label: (t as any).stats_title || "إحصائياتي", color: "#34D399", bannedAllowed: true  },
    { id: "tools",       label: "أدوات DGB",                            color: "#0E8FEF", bannedAllowed: true  },
    ...(isAdmin ? [{ id: "admin", label: "إدارة", color: "#059669", bannedAllowed: true }] : []),
  ];
  const NAV = NAV_ALL.filter(n => !safeUser.isBanned || n.bannedAllowed || safeUser.isAdmin);

  const NavIcon = ({ id, active, color }: { id: string; active: boolean; color: string }) => {
    const c = active ? color : "rgba(255,255,255,0.3)";
    const s = { display: "block" } as React.CSSProperties;
    if (id === "home") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <path d="M3 12L12 3L21 12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 10V20C5 20.55 5.45 21 6 21H9V16H15V21H18C18.55 21 19 20.55 19 20V10" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {active && <path d="M10 21V17H14V21" stroke={color} strokeWidth="2" strokeLinecap="round"/>}
      </svg>
    );
    if (id === "ads") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <rect x="2" y="4" width="20" height="14" rx="3" stroke={c} strokeWidth="2"/>
        <circle cx="12" cy="11" r="4" stroke={c} strokeWidth="1.5"/>
        <path d="M10.5 9.5L14.5 11L10.5 12.5V9.5Z" fill={c}/>
        <line x1="8" y1="21" x2="16" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="18" x2="12" y2="21" stroke={c} strokeWidth="2"/>
      </svg>
    );
    if (id === "spin") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" fill={c}/>
        <line x1="12" y1="3" x2="12" y2="9" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="15" x2="12" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="12" x2="9" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="15" y1="12" x2="21" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="5.6" y1="5.6" x2="9.8" y2="9.8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="14.2" y1="14.2" x2="18.4" y2="18.4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    if (id === "friends") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <circle cx="9" cy="7" r="3.5" stroke={c} strokeWidth="2"/>
        <path d="M2 20C2 17.2 5 15 9 15C13 15 16 17.2 16 20" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="17" cy="7" r="2.5" stroke={c} strokeWidth="1.5"/>
        <path d="M20 17C21.5 17.8 22 19 22 20" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    if (id === "leaderboard") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <path d="M12 3L13.5 7.5H18.5L14.5 10.5L16 15L12 12L8 15L9.5 10.5L5.5 7.5H10.5L12 3Z" stroke={c} strokeWidth="2" strokeLinejoin="round" fill={active ? `${color}30` : "none"}/>
        <line x1="12" y1="15" x2="12" y2="20" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="20" x2="16" y2="20" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
    if (id === "withdraw") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <rect x="2" y="6" width="20" height="14" rx="3" stroke={c} strokeWidth="2"/>
        <path d="M2 10H22" stroke={c} strokeWidth="2"/>
        <circle cx="16" cy="15" r="2" fill={c}/>
        <path d="M7 3H17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
    if (id === "stats") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <rect x="3" y="14" width="4" height="7" rx="1.5" fill={active ? `${color}40` : "none"} stroke={c} strokeWidth="1.8"/>
        <rect x="10" y="9" width="4" height="12" rx="1.5" fill={active ? `${color}40` : "none"} stroke={c} strokeWidth="1.8"/>
        <rect x="17" y="4" width="4" height="17" rx="1.5" fill={active ? `${color}40` : "none"} stroke={c} strokeWidth="1.8"/>
      </svg>
    );
    if (id === "admin") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <path d="M12 3L20 7V13C20 17.4 16.4 21.4 12 22C7.6 21.4 4 17.4 4 13V7L12 3Z" stroke={c} strokeWidth="2" strokeLinejoin="round" fill={active ? `${color}25` : "none"}/>
        <path d="M9 12L11 14L15 10" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    if (id === "tools") return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={s}>
        <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2"/>
        <path d="M8 12h8M12 8v8" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3" fill={active ? color : "none"} stroke={c} strokeWidth="1.5"/>
      </svg>
    );
    return null;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070711", color: "#fff", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", paddingBottom: 88, overflowX: "hidden" }}>
      {/* ✅ Welcome Screen — shown once on first open */}
        {showWelcome && (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(7,7,17,0.97)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
            <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: 72, marginBottom: 16, filter: "drop-shadow(0 0 32px rgba(14,143,239,0.6))" }}>💎</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", background: "linear-gradient(135deg, #FFD700, #F59E0B, #EF4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Jufo Stars
              </h1>
              <p style={{ fontSize: 16, color: "rgba(110,231,183,0.9)", fontWeight: 600, margin: "0 0 24px", lineHeight: 1.5 }}>
                Welcome to Jufo Stars!<br />Complete tasks and watch ads to earn rewards.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28, textAlign: "left" }}>
                {[
                  { icon: "📺", text: "Watch rewarded video ads daily" },
                  { icon: "🎰", text: "Spin the wheel for bonus points" },
                  { icon: "🎁", text: "Claim daily gifts & streak bonuses" },
                  { icon: "👥", text: "Invite friends and earn referral rewards" },
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 14, padding: "10px 14px" }}>
                    <span style={{ fontSize: 22 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={dismissWelcome} style={{ width: "100%", padding: "16px 0", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 900, background: "linear-gradient(135deg, #FFD700 0%, #F59E0B 50%, #EF4444 100%)", color: "#1a0a00", boxShadow: "0 4px 24px rgba(255,200,0,0.35)" }}>
                🚀 Get Started
              </button>
            </div>
          </div>
        )}
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
                <p style={{ fontSize: 10, color: "rgba(16,185,129,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{t.greeting}</p>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #FFD700 0%, #F59E0B 50%, #EF4444 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {displayName} ✨
                </h1>
              </div>
              <button onClick={toggleLanguage} style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 24, padding: "8px 14px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                {lang === "ar" ? "🇸🇦" : lang === "en" ? "🇬🇧" : "🇷🇺"}
              </button>
            </div>

            {/* Balance Card */}
            <div style={{ borderRadius: 24, padding: "22px 22px 18px", position: "relative", overflow: "hidden", background: "linear-gradient(145deg, #130826 0%, #0b1240 50%, #150b2e 100%)", border: "1px solid rgba(16,185,129,0.28)", boxShadow: "0 8px 40px rgba(16,185,129,0.12), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
              <div className="shimmer-overlay" />
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 9, color: "rgba(52,211,153,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 10 }}>{t.balance}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 46, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg, #FFE44D, #FFB800)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 18px rgba(255,200,0,0.35))" }}>
                    {safeUser.balance.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 14, color: "rgba(255,215,0,0.4)", fontWeight: 700, letterSpacing: "0.05em" }}>{t.points}</span>
                </div>
                <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", margin: "14px 0" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <p style={{ fontSize: 9, color: "rgba(52,211,153,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{t.total_earned}</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: "#6EE7B7" }}>{safeUser.totalEarned.toLocaleString()}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 9, color: "rgba(52,211,153,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>DGB المكافأة</p>
                    <p style={{ fontSize: 18, fontWeight: 900, color: "#0E8FEF" }}>⟠ {dgbEquivalent}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { emoji: "📺", label: t.today_ads, value: Math.min(safeUser.todayAds, 50), color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", tab: "ads" },
                { emoji: "🎰", label: t.spins, value: `${safeUser.spinsLeft}/5`, color: "#EC4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.2)", tab: "spin" },
              ].map((s, i) => (
                <button key={i} onClick={() => { if (!isNavLocked) setActiveTab(s.tab); }} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", transition: "transform 0.15s", width: "100%" }}>
                  <span style={{ fontSize: 26 }}>{s.emoji}</span>
                  <div>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{s.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Redeem Code */}
            <RedeemCodeBox telegramId={safeUser.telegramId} lang={lang} onReward={(bal) => setUser(prev => prev ? { ...prev, balance: bal } : prev)} />

            {/* Daily Gift */}
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(16,185,129,0.12)", display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.08)" }}>
                <span style={{ fontSize: 15 }}>🎁</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#6EE7B7", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.daily_gift_title}</span>
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

            {/* Streak Banner */}
            {safeUser.dailyStreak > 0 && (
              <StreakBanner
                streak={safeUser.dailyStreak}
                newBadges={safeUser.newBadges}
                lang={lang}
                onViewStats={() => setActiveTab("stats")}
              />
            )}

            {/* Quick Actions */}
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>⚡ الإجراءات السريعة</span>
              </div>
              {[
                { emoji: "📺", label: t.watch_ad, sub: `+${safeUser.adReward} ${t.points}`, color: "#F59E0B", tab: "ads" },
                { emoji: "🎡", label: t.try_luck, sub: t.random_prize, color: "#EC4899", tab: "spin" },
                { emoji: "👥", label: t.invite_friend, sub: t.extra_reward, color: "#3B82F6", tab: "friends" },
              ].map((a, i, arr) => (
                <button key={i} onClick={() => { if (!isNavLocked) setActiveTab(a.tab); }} style={{ width: "100%", padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", color: "#fff", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{a.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{a.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: a.color, background: `${a.color}18`, borderRadius: 8, padding: "3px 9px" }}>{a.sub}</span>
                    <CaretRight size={15} style={{ color: "rgba(255,255,255,0.2)" }} />
                  </div>
                </button>
              ))}
            </div>

            {/* Activity */}
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                <ClockCounterClockwise size={14} style={{ color: "rgba(255,255,255,0.35)" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.activity_log}</span>
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
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#F59E0B" }}> {t.watch_ad}</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>
                {t.earn_per_ad.replace("{reward}", String(safeUser.adReward))}
              </p>
            </div>
            <WatchAdsSection user={safeUser} lang={lang} onReward={(u) => refreshUser(u)} onLock={() => setIsNavLocked(true)} onUnlock={() => setIsNavLocked(false)} />
          </div>
        )}

        {/* SPIN TAB */}
        {activeTab === "spin" && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#EC4899" }}> {t.spin_title}</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>{t.spin_subtitle}</p>
            </div>
            <SpinWheelSection user={safeUser} lang={lang} onReward={(u) => refreshUser(u)} onSwitchToAds={() => setActiveTab("ads")} onLock={() => setIsNavLocked(true)} onUnlock={() => setIsNavLocked(false)} />
          </div>
        )}

        {/* FRIENDS TAB */}
        {activeTab === "friends" && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#3B82F6" }}>👥 {t.friends_title}</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>{t.friends_subtitle}</p>
            </div>
            <ReferralSection user={safeUser} lang={lang} initData={typeof window !== "undefined" && window.Telegram?.WebApp ? window.Telegram.WebApp.initData || "" : ""} />
          </div>
        )}

        {/* WITHDRAW TAB */}
        {activeTab === "withdraw" && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#10B981" }}>💸 {t.withdraw_title}</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 5 }}>{t.withdraw_subtitle}</p>
            </div>
            <WithdrawSection user={safeUser} lang={lang} onSuccess={() => refreshUser()} />
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === "leaderboard" && (
          <div style={{ paddingTop: 6 }}>
            <LeaderboardSection myTelegramId={safeUser.telegramId} lang={lang} />
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === "stats" && (
          <div style={{ paddingTop: 6, padding: "6px 0 0" }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#34D399" }}>📊 {(t as any).stats_title || "إحصائياتي"}</h2>
            </div>
            <StatsSection
              telegramId={safeUser.telegramId}
              initData={typeof window !== "undefined" && window.Telegram?.WebApp ? window.Telegram.WebApp.initData || "" : ""}
              lang={lang}
              streak={safeUser.dailyStreak}
              badges={safeUser.badges}
            />
          </div>
        )}
        {activeTab === "tools" && (
          <div style={{ paddingTop: 6, paddingBottom: 20 }}>
            <CryptoMarketSection />
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "center", padding: "0 10px 12px" }}>
        <div style={{ width: "100%", maxWidth: 480, background: "rgba(7,7,17,0.92)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderRadius: 28, border: "1px solid rgba(255,255,255,0.09)", padding: "8px 6px 6px", display: "flex", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", boxShadow: "0 -4px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.1), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          {NAV.map(({ id, label, color }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { if (isNavLocked) return; if (id === "admin") { const s = localStorage.getItem("adminSecret"); window.location.href = s ? "/admin?ak=" + encodeURIComponent(s) : "/admin"; return; } if (tabAdTimer.current) clearTimeout(tabAdTimer.current); tabAdTimer.current = setTimeout(showMonetagAd, 15000); setActiveTab(id); }}
                style={{ flex: "0 0 auto", minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px 5px", background: "none", border: "none", cursor: isNavLocked && !active ? "not-allowed" : "pointer", position: "relative", borderRadius: 20, transition: "all 0.22s ease", opacity: isNavLocked && !active ? 0.35 : 1 }}
              >
                {active && (
                  <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 32, height: 3, borderRadius: 3, background: `linear-gradient(90deg, ${color}cc, ${color})`, boxShadow: `0 0 8px ${color}88` }} />
                )}
                <div style={{
                  width: 44, height: 38, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  background: active ? `${color}20` : "transparent",
                  boxShadow: active ? `0 0 16px ${color}22, inset 0 1px 0 ${color}18` : "none",
                  transition: "all 0.22s ease",
                  transform: active ? "scale(1.08)" : "scale(1)",
                }}>
                  <NavIcon id={id} active={active} color={color} />
                </div>
                <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, color: active ? color : "rgba(255,255,255,0.25)", letterSpacing: "0.02em", transition: "all 0.22s", whiteSpace: "nowrap" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
  