import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

const withdrawMutation = trpc.withdraw.create.useMutation();

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

export default function WithdrawSection({ user, onSuccess }: WithdrawSectionProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const starsEquivalent = Math.floor(parseInt(amount || "0") / user.starsRate);
  const isValid = parseInt(amount || "0") >= user.minWithdraw && parseInt(amount || "0") <= user.balance;

  const handleWithdraw = async () => {
    if (!isValid) {
      toast({
        title: "خطأ",
        description: `الحد الأدنى للسحب: ${user.minWithdraw}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await withdrawMutation.mutateAsync({
        telegramId: user.telegramId,
        amount: parseInt(amount),
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (data.success) {
        toast({
          title: "✅ تم بنجاح",
          description: `طلب السحب تم إنشاؤه بنجاح. سيتم إرسال ${data.stars} نجمة قريباً.`,
        });
        setAmount("");
        onSuccess();
      } else {
        toast({
          title: "خطأ",
          description: data.message || "فشل طلب السحب",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error withdrawing:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في الاتصال",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-green-400" />
          سحب الأرباح
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-950/50 border-blue-700/50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-200">
            السحب يتم بشكل حقيقي إلى محفظة Telegram Stars الخاصة بك
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">
            المبلغ المراد سحبه (نقطة)
          </label>
          <Input
            type="number"
            placeholder="أدخل المبلغ"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="bg-slate-800/50 border-slate-700 text-white"
            min={user.minWithdraw}
            max={user.balance}
          />
          <p className="text-xs text-gray-400">
            الحد الأدنى: {user.minWithdraw.toLocaleString()} | الرصيد: {user.balance.toLocaleString()}
          </p>
        </div>

        {amount && (
          <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/30">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">المبلغ:</span>
              <span className="font-bold text-yellow-400">{parseInt(amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">النجوم المكافئة:</span>
              <span className="font-bold text-purple-400">⭐ {starsEquivalent}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleWithdraw}
          disabled={loading || !isValid}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold h-12"
        >
          {loading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              جاري المعالجة...
            </>
          ) : (
            "💸 طلب السحب"
          )}
        </Button>

        <div className="space-y-2 text-xs text-gray-400">
          <p className="flex items-center gap-2">
            <span>✓</span>
            <span>السحب آمن وموثوق 100%</span>
          </p>
          <p className="flex items-center gap-2">
            <span>✓</span>
            <span>يتم المعالجة خلال 24 ساعة</span>
          </p>
          <p className="flex items-center gap-2">
            <span>✓</span>
            <span>لا توجد رسوم إضافية</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
