import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Zap, Gift, TrendingUp, Wallet, Award } from "lucide-react";
import WatchAdsSection from "@/components/adsgram/WatchAdsSection";
import SpinWheelSection from "@/components/adsgram/SpinWheelSection";
import WithdrawSection from "@/components/adsgram/WithdrawSection";
import ReferralSection from "@/components/adsgram/ReferralSection";
import { useToast } from "@/hooks/use-toast";

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
  lastAdTime: number | null;
}

const DEFAULT_DEMO_USER: UserData = {
  telegramId: 123456789,
  balance: 5000.00,
  totalEarned: 15000.00,
  todayAds: 3,
  spinsLeft: 2,
  referralCode: "ref_DEMO",
  adReward: 100,
  minWithdraw: 10000,
  starsRate: 1000,
  adCooldown: 30,
  lastAdTime: null,
};

export default function AdsgramApp() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const { toast } = useToast();

  useEffect(() => {
    initializeTelegramApp();
  }, []);

  const initializeTelegramApp = async () => {
    try {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.disableClosingConfirmation();

        if (tg.themeParams?.bg_color) {
          document.documentElement.style.setProperty(
            "--tg-theme-bg",
            tg.themeParams.bg_color
          );
        }

        const initData = tg.initData;
        const telegramUser = tg.initDataUnsafe?.user;

        if (!telegramUser) {
          console.warn("Telegram user not found in initDataUnsafe, falling back to demo user.");
          setUser(DEFAULT_DEMO_USER);
          setLoading(false);
          return;
        }

        try {
          const response = await fetch("/api/telegram.getUser", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              telegramId: telegramUser.id,
              initData: initData,
            }),
          });

          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            console.error("Server fetch failed:", data.message);
            setUser({
              ...DEFAULT_DEMO_USER,
              telegramId: telegramUser.id,
            });
            toast({
              title: "تنبيه",
              description: "تم تحميل بيانات تجريبية (فشل الاتصال بالسيرفر)",
            });
          }
        } catch (e) {
          console.error("Fetch error:", e);
          setUser({
            ...DEFAULT_DEMO_USER,
            telegramId: telegramUser.id,
          });
        }
      } else {
        setUser(DEFAULT_DEMO_USER);
        toast({
          title: "وضع العرض التوضيحي",
          description: "يتم تشغيل التطبيق خارج Telegram",
        });
      }
    } catch (error) {
      console.error("Error initializing app:", error);
      setUser(DEFAULT_DEMO_USER);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4 shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>
          <p className="text-yellow-400 font-bold tracking-widest animate-pulse">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const safeUser = user || DEFAULT_DEMO_USER;
  const starsEquivalent = Math.floor(safeUser.balance / safeUser.starsRate);

  // Helper to format balance as 00.00
  const formatBalance = (val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 font-sans selection:bg-purple-500/30">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center pt-2">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 bg-clip-text text-transparent">
              ADSGRAM PRO
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">النظام نشط ومؤمن</p>
            </div>
          </div>
          <div className="p-2 bg-slate-900/50 rounded-full border border-slate-800">
            <Award className="h-5 w-5 text-yellow-500" />
          </div>
        </div>

        {/* Balance Card - Modern Design */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700 border-none shadow-2xl shadow-purple-900/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-purple-100/70">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold uppercase tracking-tighter">الرصيد القابل للسحب</span>
                </div>
                <div className="text-4xl font-black tracking-tight flex items-baseline gap-1">
                  <span className="text-yellow-300 drop-shadow-md">{formatBalance(safeUser.balance)}</span>
                  <span className="text-sm font-medium text-purple-200/60 uppercase">PTS</span>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-lg border border-white/10 text-center">
                <p className="text-[10px] text-purple-200 font-bold uppercase">قيمة النجوم</p>
                <p className="text-sm font-black text-white">⭐ {starsEquivalent}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] text-purple-200/70 font-bold uppercase mb-0.5">إجمالي الأرباح</p>
                <p className="text-lg font-black text-white">{formatBalance(safeUser.totalEarned)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-purple-200/70 font-bold uppercase mb-0.5">رتبة المستخدم</p>
                <p className="text-lg font-black text-yellow-400">برونزي</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 flex items-center gap-4">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl">
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase">إعلانات اليوم</p>
              <p className="text-xl font-black">{safeUser.todayAds}</p>
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 flex items-center gap-4">
            <div className="p-2.5 bg-purple-500/10 rounded-xl">
              <Gift className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase">السبينات</p>
              <p className="text-xl font-black">{safeUser.spinsLeft}<span className="text-xs text-gray-600">/5</span></p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-14 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/50">
            <TabsTrigger value="home" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">الرئيسية</TabsTrigger>
            <TabsTrigger value="ads" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">إعلانات</TabsTrigger>
            <TabsTrigger value="spin" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">عجلة</TabsTrigger>
            <TabsTrigger value="withdraw" className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white">سحب</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="home" className="space-y-4 outline-none">
              <Card className="bg-slate-900/30 border-slate-800/50 rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                    خطتك الربحية اليومية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/50 flex justify-between items-center group transition-all hover:border-purple-500/50">
                    <div>
                      <p className="font-black text-sm">📺 مشاهدة الإعلانات</p>
                      <p className="text-[10px] text-gray-500 font-bold">اكسب {safeUser.adReward} نقطة فوراً</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs font-bold text-purple-400" onClick={() => setActiveTab("ads")}>إبدأ</Button>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/50 flex justify-between items-center group transition-all hover:border-purple-500/50">
                    <div>
                      <p className="font-black text-sm">🎰 عجلة الحظ</p>
                      <p className="text-[10px] text-gray-500 font-bold">جوائز تصل إلى 1000 نقطة</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs font-bold text-purple-400" onClick={() => setActiveTab("spin")}>العب</Button>
                  </div>
                </CardContent>
              </Card>
              <ReferralSection user={safeUser} />
            </TabsContent>

            <TabsContent value="ads" className="outline-none">
              <WatchAdsSection user={safeUser} onReward={() => initializeTelegramApp()} />
            </TabsContent>

            <TabsContent value="spin" className="outline-none">
              <SpinWheelSection user={safeUser} onReward={() => initializeTelegramApp()} />
            </TabsContent>

            <TabsContent value="withdraw" className="outline-none">
              <WithdrawSection user={safeUser} onSuccess={() => initializeTelegramApp()} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
