import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, TrendingUp, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalUsers: number;
  totalAds: number;
  pendingWithdrawals: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin.stats", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.success) {
        setStats({
          totalUsers: data.totalUsers || 0,
          totalAds: data.totalAds || 0,
          pendingWithdrawals: data.pendingWithdrawals || 0,
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الإحصائيات",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent mb-2">
            لوحة التحكم
          </h1>
          <p className="text-gray-400">إدارة التطبيق والمستخدمين</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-900/50 to-slate-900/50 border-blue-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">المستخدمين</p>
                  <p className="text-3xl font-bold text-blue-400">
                    {stats?.totalUsers || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/50 to-slate-900/50 border-purple-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">الإعلانات</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {stats?.totalAds || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/50 to-slate-900/50 border-green-700/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">طلبات السحب</p>
                  <p className="text-3xl font-bold text-green-400">
                    {stats?.pendingWithdrawals || 0}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-700/50">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="withdrawals">السحب</TabsTrigger>
            <TabsTrigger value="users">المستخدمين</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle>ملخص النشاط</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                    <span className="text-gray-400">إجمالي المستخدمين</span>
                    <span className="font-bold text-blue-400">{stats?.totalUsers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                    <span className="text-gray-400">إجمالي الإعلانات المشاهدة</span>
                    <span className="font-bold text-purple-400">{stats?.totalAds || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                    <span className="text-gray-400">طلبات السحب المعلقة</span>
                    <span className="font-bold text-green-400">{stats?.pendingWithdrawals || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle>إدارة طلبات السحب</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-center py-8">
                  لا توجد طلبات سحب معلقة حالياً
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle>إدارة المستخدمين</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-center py-8">
                  لا توجد بيانات مستخدمين متاحة حالياً
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  إعدادات التطبيق
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">مكافأة الإعلان (نقطة)</label>
                  <input
                    type="number"
                    defaultValue="100"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">الحد الأدنى للسحب (نقطة)</label>
                  <input
                    type="number"
                    defaultValue="10000"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">معدل التحويل (نقطة = نجمة)</label>
                  <input
                    type="number"
                    defaultValue="1000"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <Button className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold">
                  💾 حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
