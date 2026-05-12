import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

interface UserData {
  telegramId: number;
  balance: number;
  minWithdraw: number;
  starsRate: number;
}

interface WithdrawSectionProps {
  user: UserData;
  lang: Language;
  onSuccess: () => void;
}

export default function WithdrawSection({ user, lang, onSuccess }: WithdrawSectionProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const starsEquivalent = Math.floor(parseInt(amount || "0") / user.starsRate);
  const isValid = parseInt(amount || "0") >= user.minWithdraw && parseInt(amount || "0") <= user.balance;

  const handleWithdraw = async () => {
    if (!isValid) {
      toast({
        title: t.error,
        description: `${t.withdraw_min_error}: ${user.minWithdraw}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await trpc.withdraw.create.mutate({
        telegramId: user.telegramId,
        amount: parseInt(amount),
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (data.success) {
        toast({ title: t.success, description: t.withdraw_success_desc });
        setAmount("");
        onSuccess();
      } else {
        toast({ title: t.error, description: data.message || t.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error withdrawing:", error);
      toast({ title: t.error, description: t.connection_error, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-green-400" />
          {t.withdraw_title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-950/50 border-blue-700/50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-200">{t.withdraw_info}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm text-gray-400">{t.amount_label}</label>
          <Input
            type="number"
            placeholder={t.amount_placeholder}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-slate-800/50 border-slate-700 text-white"
            min={user.minWithdraw}
            max={user.balance}
          />
          <p className="text-xs text-gray-400">
            {t.min_label}: {user.minWithdraw.toLocaleString()} | {t.balance_label}: {user.balance.toLocaleString()}
          </p>
        </div>

        {amount && (
          <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-700/30">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">{t.amount_short}:</span>
              <span className="font-bold text-yellow-400">{parseInt(amount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">{t.stars_equiv_label}:</span>
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
            <><span className="animate-spin mr-2">⏳</span>{t.processing}</>
          ) : (
            t.withdraw_btn
          )}
        </Button>

        <div className="space-y-2 text-xs text-gray-400">
          <p className="flex items-center gap-2"><span>✓</span><span>{t.withdraw_secure}</span></p>
          <p className="flex items-center gap-2"><span>✓</span><span>{t.withdraw_time}</span></p>
          <p className="flex items-center gap-2"><span>✓</span><span>{t.no_fees}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}
