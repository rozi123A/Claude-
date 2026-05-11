import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap, Gift, TrendingUp, Wallet, Award, Globe, History } from "lucide-react";
import { translations, type Language } from "@/lib/i18n";
import WatchAdsSection from "@/components/adsgram/WatchAdsSection";
import SpinWheelSection from "@/components/adsgram/SpinWheelSection";
import WithdrawSection from "@/components/adsgram/WithdrawSection";
import ReferralSection from "@/components/adsgram/ReferralSection";
import { useToast } from "@/hooks/use-toast";
import DailyGiftBox from "@/components/adsgram/DailyGiftBox";
import { trpc } from "@/lib/trpc";

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
  adsgramBlockId: string;
  lastAdTime: number | null;
}

const DEFAULT_DEMO_USER: UserData = {
  telegramId: 123456789,
  balance: 0.00,
  totalEarned: 0.00,
  todayAds: 0,
  spinsLeft: 5,
  referralCode: "ref_NEW",
  adReward: 100,
  minWithdraw: 10000,
  starsRate: 1000,
  adCooldown: 30,
  adsgramBlockId: "29281",
  lastAdTime: null,
};

function txLabel(type: string, meta: string | null, t: any): string {
  if (type === "ad") return t.type_ad;
  if (type === "spin") return t.type_spin;
  if (type === "referral") return t.type_ref;
  if (type === "withdraw") return t.type_withdraw;
  if (type === "bonus") {
    try {
      const m = JSON.parse(meta || "{}");
      if (m.action === "daily_gift") return t.type_daily ?? "🎁 هدية يومية";
      if (m.action === "registration") return t.type_reg;
    } catch {}
    return t.type_reg;
  }
  if (type === "task") return "✅ مهمة";
  return t.type_reg;
}

function txIcon(type: string, meta: string | null): string {
  if (type === "ad") return "📺";
  if (type === "spin") return "🎡";
  if (type === "referral") return "👥";
  if (type === "withdraw") return "💸";
  if (type === "bonus") {
    try { if (JSON.parse(meta || "{}").action === "daily_gift") return "🎁"; } catch {}
    return "🎉";
  }
  return "⭐";
}

function ActivityLog({ telegramId, lang }: { telegramId: number, lang: Language }) {
  const { data: transactions, isLoading } = trpc.telegram.getTransactions.useQuery(
    { telegramId },
    { refetchInterval: 10000, refetchOnWindowFocus: true }
  );
  const t = translations[lang];

  if (isLoading) return <div className="text-center py-4 text-xs text-gray-500">Loading...</div>;
  if (!transactions || transactions.length === 0) return <div className="text-center py-4 text-xs text-gray-500">{t.no_activity}</div>;

  return (
    <div className="space-y-2">
      {transactions.map((tx: any) => (
        <div key={tx.id} className="flex justify-between items-center p-2 bg-slate-800/30 rounded border border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm">{txIcon(tx.type, tx.metadata)}</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-300">
                {txLabel(tx.type, tx.metadata, t)}
              </span>
              <span className="text-[8px] text-gray-500">{new Date(tx.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <span className={`text-xs font-black ${tx.points > 0 ? 'text-green-400' : tx.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {tx.points > 0 ? '+' : ''}{tx.points !== 0 ? tx.points : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdsgramApp() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [lang, setLang] = useState<Language>("ar");
  const { toast } = useToast();
  
  const t = translations[lang];

  const toggleLanguage = () => {
    const langs: Language[] = ["ar", "en", "ru"];
    const nextIndex = (langs.indexOf(lang) + 1) % langs.length;
    setLang(langs[nextIndex]);
  };
  
  const getUserMutation = trpc.telegram.getUser.useMutation();

  useEffect(() => {
    initializeTelegramApp();
  }, []);

  const initializeTelegramApp = async () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        const initData = tg.initData;
        const telegramUser = tg.initDataUnsafe?.user;
        const startParam = tg.initDataUnsafe?.start_param;

        if (!telegramUser) {
          setUser(DEFAULT_DEMO_USER);
          setLoading(false);
          return;
        }

        try {
          const data = await getUserMutation.mutateAsync({
            telegramId: telegramUser.id,
            initData: initData || "",
            referredBy: startParam ? parseInt(startParam) : undefined,
          }).catch(err => {
            console.error("Mutation failed:", err);
            return { success: false, user: null };
          });

          if (data && data.success && data.user) {
            setUser(data.user as UserData);
          } else {
            console.warn("Using demo user due to API failure or invalid data");
            setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id });
          }
        } catch (err) {
          console.error("tRPC Error:", err);
          setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id });
        }
      } else {
        setUser(DEFAULT_DEMO_USER);
      }
    } catch (error) {
      setUser(DEFAULT_DEMO_USER);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = useCallback(async (partialUpdate?: Partial<UserData>) => {
    if (partialUpdate) {
      setUser(prev => prev ? { ...prev, ...partialUpdate } : prev);
    }

    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        const telegramUser = tg.initDataUnsafe?.user;
        if (!telegramUser) return;

        const data = await getUserMutation.mutateAsync({
          telegramId: telegramUser.id,
          initData: tg.initData || "",
        }).catch(err => {
          console.error("Refresh failed:", err);
          return { success: false, user: null };
        });

        if (data && data.success && data.user) {
          setUser(data.user as UserData);
        }
      }
    } catch (err) {
      console.error("Error refreshing user:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  const safeUser = user || DEFAULT_DEMO_USER;
  const starsEquivalent = Math.floor(safeUser.balance / safeUser.starsRate);

  const formatBalance = (val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-yellow-500">{t.welcome}</h1>
            <p className="text-[10px] text-gray-400 font-bold">{t.subtitle}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3"
          >
            <Globe className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase">{lang === "ar" ? "🇸🇦" : lang === "en" ? "🇬🇧" : "🇷🇺"}</span>
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 border-none shadow-xl">
          <CardContent className="p-6">
              <div className="space-y-1 mb-6">
                <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">{t.balance}</p>
                <div className="text-4xl font-black flex items-baseline gap-2">
                  <span>{formatBalance(safeUser.balance)}</span>
                  <span className="text-sm opacity-50 uppercase">PTS</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">{t.total_earned}</p>
                  <p className="text-lg font-black">{formatBalance(safeUser.totalEarned)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">{t.stars_equivalent}</p>
                  <p className="text-lg font-black text-yellow-400">⭐ {starsEquivalent}</p>
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Daily Gift */}
        <Card className="bg-slate-900/60 border border-purple-800/50 rounded-xl overflow-hidden">
          <div className="px-4 pt-3 pb-1" style={{ background: "linear-gradient(135deg,rgba(88,28,135,0.35),rgba(49,46,129,0.35))", borderBottom: "1px solid rgba(147,51,234,0.2)" }}>
            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
              🎁 {t.daily_gift_title}
            </CardTitle>
          </div>
          <CardContent className="p-4 flex justify-center">
            <DailyGiftBox
              telegramId={safeUser.telegramId}
              initData={typeof window !== "undefined" && window.Telegram?.WebApp ? window.Telegram.WebApp.initData || "" : ""}
              lang={lang}
              onClaim={(update) => setUser(prev => prev ? { ...prev, ...update } : prev)}
            />
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <Zap className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-[10px] text-gray-500 font-bold">إعلانات اليوم</p>
              <p className="text-lg font-black">{safeUser.todayAds}</p>
            </div>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
            <Gift className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-[10px] text-gray-500 font-bold">السبينات</p>
              <p className="text-lg font-black">{safeUser.spinsLeft}/5</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <TabsTrigger value="home" className="text-xs font-bold">{t.home}</TabsTrigger>
            <TabsTrigger value="ads" className="text-xs font-bold">{t.ads}</TabsTrigger>
            <TabsTrigger value="spin" className="text-xs font-bold">{t.spin}</TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs font-bold">{t.withdraw}</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="home" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-slate-800 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                    {t.tasks}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-between border-slate-800 hover:bg-slate-800" onClick={() => setActiveTab("ads")}>
                    <span>{t.watch_ad}</span>
                    <span className="text-yellow-500">+{safeUser.adReward} PTS</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-between border-slate-800 hover:bg-slate-800" onClick={() => setActiveTab("spin")}>
                    <span>{t.try_luck}</span>
                    <span className="text-purple-500">{t.random_prize}</span>
                  </Button>
                </CardContent>
              </Card>
              
              <ReferralSection user={safeUser} lang={lang} />

              {/* Activity Log Section */}
              <Card className="bg-slate-900/40 border-slate-800 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-400" />
                    {t.activity_log}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-60 overflow-y-auto">
                  <ActivityLog telegramId={safeUser.telegramId} lang={lang} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ads" className="outline-none">
              <WatchAdsSection 
                user={safeUser} 
                onReward={(update) => refreshUser(update)} 
              />
            </TabsContent>

            <TabsContent value="spin" className="outline-none">
              <SpinWheelSection 
                user={safeUser} 
                onReward={(update) => refreshUser(update)}
                onSwitchToAds={() => setActiveTab("ads")}
              />
            </TabsContent>

            <TabsContent value="withdraw" className="outline-none">
              <WithdrawSection user={safeUser} onSuccess={() => refreshUser()} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
