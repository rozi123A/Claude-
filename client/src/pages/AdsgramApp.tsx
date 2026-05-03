import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Zap, Gift, TrendingUp, Wallet, Award } from "lucide-react";
import WatchAdsSection from "@/components/adsgram/WatchAdsSection";
import SpinWheelSection from "@/components/adsgram/SpinWheelSection";
import WithdrawSection from "@/components/adsgram/WithdrawSection";
import ReferralSection from "@/components/adsgram/ReferralSection";
import { useToast } from "@/hooks/use-toast";
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
  lastAdTime: null,
};

export default function AdsgramApp() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const { toast } = useToast();
  
  // استخدام tRPC للاتصال بالسيرفر
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

        if (!telegramUser) {
          setUser(DEFAULT_DEMO_USER);
          setLoading(false);
          return;
        }

        try {
          // استخدام tRPC mutation لجلب أو إنشاء المستخدم
          const data = await getUserMutation.mutateAsync({
            telegramId: telegramUser.id,
            initData: initData || "",
          });

          if (data.success && data.user) {
            setUser(data.user as UserData);
          } else {
            setUser({ ...DEFAULT_DEMO_USER, telegramId: telegramUser.id });
          }
        } catch (e) {
          console.error("tRPC Error:", e);
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
          <h1 className="text-xl font-black text-yellow-500">ADSGRAM PRO</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-[10px] font-bold uppercase">Online</span>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 border-none shadow-xl">
          <CardContent className="p-6">
            <div className="space-y-1 mb-6">
              <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">الرصيد الحالي</p>
              <div className="text-4xl font-black flex items-baseline gap-2">
                <span>{formatBalance(safeUser.balance)}</span>
                <span className="text-sm opacity-50 uppercase">PTS</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">إجمالي الأرباح</p>
                <p className="text-lg font-black">{formatBalance(safeUser.totalEarned)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-indigo-100 font-bold uppercase opacity-70">النجوم المقابلة</p>
                <p className="text-lg font-black text-yellow-400">⭐ {starsEquivalent}</p>
              </div>
            </div>
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
            <TabsTrigger value="home" className="text-xs font-bold">الرئيسية</TabsTrigger>
            <TabsTrigger value="ads" className="text-xs font-bold">إعلانات</TabsTrigger>
            <TabsTrigger value="spin" className="text-xs font-bold">عجلة</TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs font-bold">سحب</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="home" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-slate-800 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                    المهام المتاحة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-between border-slate-800 hover:bg-slate-800" onClick={() => setActiveTab("ads")}>
                    <span>مشاهدة إعلان</span>
                    <span className="text-yellow-500">+{safeUser.adReward} PTS</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-between border-slate-800 hover:bg-slate-800" onClick={() => setActiveTab("spin")}>
                    <span>تجربة الحظ</span>
                    <span className="text-purple-500">جائزة عشوائية</span>
                  </Button>
                </CardContent>
              </Card>
              <ReferralSection user={safeUser} />
            </TabsContent>

            <TabsContent value="ads" className="outline-none">
              <WatchAdsSection user={safeUser} onReward={() => initializeTelegramApp()} />
            </TabsContent>

            <TabsContent value="spin" className="outline-none">
              <SpinWheelSection 
                user={safeUser} 
                onReward={() => initializeTelegramApp()} 
                onSwitchToAds={() => setActiveTab("ads")}
              />
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
