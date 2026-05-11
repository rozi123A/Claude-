import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Send, Clock, CheckCircle, XCircle, History } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface UserData {
  telegramId: number;
  balance: number;
  minWithdraw: number;
  starsRate: number;
}

interface WithdrawSectionProps {
  user: UserData;
  onSuccess: () => void;
}

const STATUS_CONFIG = {
  pending:   { icon: Clock,         color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-700/40", label: "قيد المعالجة" },
  approved:  { icon: CheckCircle,   color: "text-green-400",  bg: "bg-green-900/20 border-green-700/40",   label: "تمت الموافقة" },
  completed: { icon: CheckCircle,   color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-700/40",     label: "مكتمل" },
  rejected:  { icon: XCircle,       color: "text-red-400",    bg: "bg-red-900/20 border-red-700/40",       label: "مرفوض" },
};

export default function WithdrawSection({ user, onSuccess }: WithdrawSectionProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createMutation = trpc.withdraw.create.useMutation();
  const { data: historyData, refetch: refetchHistory } = trpc.withdraw.getHistory.useQuery(
    { telegramId: user.telegramId },
    { refetchInterval: 15000 }
  );

  const parsedAmount = parseInt(amount || "0");
  const starsEquivalent = Math.floor(parsedAmount / user.starsRate);
  const isValid = parsedAmount >= user.minWithdraw && parsedAmount <= user.balance;
  const hasPending = historyData?.some((w: any) => w.status === "pending") ?? false;

  const handleWithdraw = async () => {
    if (!isValid) {
      toast({ title: "خطأ", description: `الحد الأدنى للسحب: ${user.minWithdraw.toLocaleString()} نقطة`, variant: "destructive" });
      return;
    }
    if (hasPending) {
      toast({ title: "انتظر", description: "لديك طلب سحب قيد المعالجة", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = await createMutation.mutateAsync({
        telegramId: user.telegramId,
        amount: parsedAmount,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (data.success) {
        toast({ title: "✅ تم الإرسال", description: data.message });
        setAmount("");
        refetchHistory();
        onSuccess();
      } else {
        toast({ title: "خطأ", description: data.message || "فشل طلب السحب", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ في الاتصال بالسيرفر", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Withdrawal Form */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-green-400" />
            سحب الأرباح بـ Telegram Stars
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPending && (
            <Alert className="bg-yellow-950/40 border-yellow-700/50">
              <Clock className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200 text-xs">
                لديك طلب سحب قيد المعالجة — انتظر حتى يتم البت فيه قبل تقديم طلب جديد.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="bg-blue-950/50 border-blue-700/50">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-xs">
              بعد إرسال الطلب يتم خصم نقاطك فوراً وتُرسَل النجوم لمحفظتك خلال 24 ساعة.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-bold">المبلغ المراد سحبه (نقطة)</label>
            <Input
              type="number"
              placeholder={`أدخل المبلغ (الحد الأدنى ${user.minWithdraw.toLocaleString()})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-800/50 border-slate-700 text-white"
              min={user.minWithdraw}
              max={user.balance}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>الحد الأدنى: <span className="text-yellow-500 font-bold">{user.minWithdraw.toLocaleString()}</span></span>
              <span>رصيدك: <span className="text-green-400 font-bold">{user.balance.toLocaleString()}</span></span>
            </div>
          </div>

          {parsedAmount > 0 && (
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">النقاط:</span>
                <span className="font-black text-yellow-400">{parsedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">ما ستستلمه:</span>
                <span className="font-black text-purple-300 text-lg">⭐ {starsEquivalent} نجمة</span>
              </div>
              <div className="border-t border-purple-700/30 pt-2">
                <p className="text-[10px] text-gray-500 text-center">معدل التحويل: {user.starsRate.toLocaleString()} نقطة = ⭐ 1 نجمة</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleWithdraw}
            disabled={loading || !isValid || hasPending}
            className="w-full h-14 text-base font-black bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {loading ? (
              <><span className="animate-spin mr-2">⏳</span> جاري الإرسال...</>
            ) : hasPending ? (
              "⏳ انتظر معالجة طلبك الحالي"
            ) : (
              "💸 إرسال طلب السحب"
            )}
          </Button>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[["🔒", "آمن 100%"], ["⚡", "خلال 24 ساعة"], ["🆓", "بدون رسوم"]].map(([icon, text]) => (
              <div key={text} className="bg-slate-800/40 rounded-lg p-2">
                <div className="text-lg">{icon}</div>
                <div className="text-[10px] text-gray-400 font-bold">{text}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      {historyData && historyData.length > 0 && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
              <History className="h-4 w-4 text-blue-400" />
              سجل طلبات السحب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {historyData.map((w: any) => {
              const cfg = STATUS_CONFIG[w.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={w.id} className={`flex items-center justify-between p-3 rounded-xl border ${cfg.bg}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
                    <div>
                      <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-[10px] text-gray-500">{new Date(w.createdAt).toLocaleString("ar-SA")}</p>
                      {w.note && <p className="text-[10px] text-gray-400 mt-0.5">ملاحظة: {w.note}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{Number(w.amount).toLocaleString()} نقطة</p>
                    <p className="text-xs text-purple-400">⭐ {w.stars} نجمة</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
