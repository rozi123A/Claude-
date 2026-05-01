import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Zap, Gift, Share2, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
      // Check if running in Telegram WebApp
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.disableClosingConfirmation();

        // Apply theme
        if (tg.themeParams?.bg_color) {
          document.documentElement.style.setProperty(
            "--tg-theme-bg",
            tg.themeParams.bg_color
          );
        }

        // Get user data
        const initData = tg.initData;
        const telegramUser = tg.initDataUnsafe?.user;

        if (!telegramUser) {
          toast({
            title: "خطأ",
            description: "لم يتم التحقق من المستخدم",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Fetch user data from server using tRPC
        const response = await fetch("/api/trpc/telegram.getUser?batch=1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "0": {
              telegramId: telegramUser.id,
              initData: initData,
            }
          }),
        });

        const batchData = await response.json();
        const data = batchData[0]?.result?.data;
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          toast({
            title: "خطأ",
            description: data.message || "فشل تحميل بيانات المستخدم",
            variant: "destructive",
          });
        }
      } else {
        // Demo mode
        setUser({
          telegramId: 123456789,
          balance: 5000,
          totalEarned: 15000,
          todayAds: 3,
          spinsLeft: 2,
          referralCode: "ref_ABC123",
          adReward: 100,
          minWithdraw: 10000,
          starsRate: 1000,
          adCooldown: 30,
          lastAdTime: null,
        });
        toast({
          title: "وضع العرض التوضيحي",
          description: "يتم تشغيل التطبيق في وضع العرض التوضيحي",
        });
      }
    } catch (error) {
      console.error("Error initializing app:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في تهيئة التطبيق",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-yellow-400 font-semibold">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <Alert className="max-w-md bg-red-950 border-red-700">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-200">
            يجب فتح التطبيق من داخل Telegram
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const starsEquivalent = Math.floor(user.balance / user.starsRate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Start Coin✨
          </h1>
          <p className="text-gray-400">اكسب النقاط واسحبها كنجوم حقيقية</p>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-purple-900/50 to-slate-900/50 border-purple-700/50 mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1">الرصيد الحالي</p>
                <p className="text-3xl font-bold text-yellow-400">
                  {user.balance.toLocaleString()}
                </p>
                <p className="text-xs text-purple-300 mt-1">
                  ⭐ {starsEquivalent} نجمة
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1">إجمالي المكسب</p>
                <p className="text-3xl font-bold text-purple-400">
                  {user.totalEarned.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  منذ البداية
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <div>
                  <p className="text-xs text-gray-400">إعلانات اليوم</p>
                  <p className="text-lg font-bold">{user.todayAds}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-400" />
                <div>
                  <p className="text-xs text-gray-400">سبينات متبقية</p>
                  <p className="text-lg font-bold">{user.spinsLeft}/5</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-700/50">
            <TabsTrigger value="home" className="text-xs">
              الرئيسية
            </TabsTrigger>
            <TabsTrigger value="ads" className="text-xs">
              إعلانات
            </TabsTrigger>
            <TabsTrigger value="spin" className="text-xs">
              عجلة
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs">
              سحب
            </TabsTrigger>
          </TabsList>

          {/* Home Tab */}
          <TabsContent value="home" className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                  الطرق المتاحة للكسب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/30">
                  <p className="font-semibold text-sm mb-1">📺 مشاهدة الإعلانات</p>
                  <p className="text-xs text-gray-400">
                    اكسب {user.adReward} نقطة لكل إعلان
                  </p>
                </div>
                <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/30">
                  <p className="font-semibold text-sm mb-1">🎰 عجلة الحظ اليومية</p>
                  <p className="text-xs text-gray-400">
                    العب 5 مرات يومياً واكسب جوائز عشوائية
                  </p>
                </div>
                <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/30">
                  <p className="font-semibold text-sm mb-1">👥 نظام الإحالات</p>
                  <p className="text-xs text-gray-400">
                    ادعُ أصدقاءك واكسب مكافآت إضافية
                  </p>
                </div>
              </CardContent>
            </Card>

            <ReferralSection user={user} />
          </TabsContent>

          {/* Ads Tab */}
          <TabsContent value="ads">
            <WatchAdsSection user={user} onReward={() => initializeTelegramApp()} />
          </TabsContent>

          {/* Spin Tab */}
          <TabsContent value="spin">
            <SpinWheelSection user={user} onReward={() => initializeTelegramApp()} />
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw">
            <WithdrawSection user={user} onSuccess={() => initializeTelegramApp()} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
