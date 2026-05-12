import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Send, Clock, CheckCircle, XCircle, History } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";

interface UserData { telegramId: number; balance: number; minWithdraw: number; starsRate: number; }
interface WithdrawSectionProps { user: UserData; lang: Language; onSuccess: () => void; }

export default function WithdrawSection({ user, lang, onSuccess }: WithdrawSectionProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const STATUS_CONFIG = {
    pending:   { icon: Clock,       color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-700/40", label: t.status_pending },
    approved:  { icon: CheckCircle, color: "text-green-400",  bg: "bg-green-900/20 border-green-700/40",   label: t.status_approved },
    completed: { icon: CheckCircle, color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-700/40",     label: t.status_completed },
    rejected:  { icon: XCircle,     color: "text-red-400",    bg: "bg-red-900/20 border-red-700/40",       label: t.status_rejected },
  };

  const createMutation = trpc.withdraw.create.useMutation();
  const { data: historyData, refetch: refetchHistory } = trpc.withdraw.getHistory.useQuery(
    { telegramId: user.telegramId }, { refetchInterval: 15000 }
  );

  const parsedAmount   = parseInt(amount || "0");
  const starsEquivalent = Math.floor(parsedAmount / user.starsRate);
  const isValid        = parsedAmount >= user.minWithdraw && parsedAmount <= user.balance;
  const hasPending     = historyData?.some((w: any) => w.status === "pending") ?? false;

  const handleWithdraw = async () => {
    if (!isValid) {
      toast({ title: "⚠️", description: `${t.withdraw_err_min} ${user.minWithdraw.toLocaleString()} ${t.pts_unit}`, variant: "destructive" });
      return;
    }
    if (hasPending) {
      toast({ title: "⚠️", description: t.withdraw_err_pending, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const data = await createMutation.mutateAsync({
        telegramId: user.telegramId, amount: parsedAmount, initData: window.Telegram?.WebApp?.initData || "",
      });
      if (data.success) {
        toast({ title: t.withdraw_success_title, description: data.message });
        setAmount(""); refetchHistory(); onSuccess();
      } else {
        toast({ title: "⚠️", description: data.message || t.withdraw_err_generic, variant: "destructive" });
      }
    } catch {
      toast({ title: "⚠️", description: t.withdraw_err_server, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-green-400" />
            {t.withdraw_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPending && (
            <Alert className="bg-yellow-950/40 border-yellow-700/50">
              <Clock className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200 text-xs">{t.withdraw_pending_warn}</AlertDescription>
            </Alert>
          )}
          <Alert className="bg-blue-950/50 border-blue-700/50">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-xs">{t.withdraw_info}</AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-bold">{t.amount_label}</label>
            <Input type="number"
              placeholder={`${t.min_label} ${user.minWithdraw.toLocaleString()}`}
              value={amount} onChange={e => setAmount(e.target.value)}
              className="bg-slate-800/50 border-slate-700 text-white"
              min={user.minWithdraw} max={user.balance} />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{t.min_label}: <span className="text-yellow-500 font-bold">{user.minWithdraw.toLocaleString()}</span></span>
              <span>{t.your_balance_label}: <span className="text-green-400 font-bold">{user.balance.toLocaleString()}</span></span>
            </div>
          </div>

          {parsedAmount > 0 && (
            <div className="p-3 bg-purple-900/30 rounded-xl border border-purple-700/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{t.points_colon}</span>
                <span className="font-black text-yellow-400">{parsedAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{t.you_get_label}</span>
                <span className="font-black text-purple-300 text-lg">⭐ {starsEquivalent} {t.stars_unit}</span>
              </div>
              <div className="border-t border-purple-700/30 pt-2">
                <p className="text-[10px] text-gray-500 text-center">
                  {t.rate_prefix}: {user.starsRate.toLocaleString()} {t.rate_suffix}
                </p>
              </div>
            </div>
          )}

          <Button onClick={handleWithdraw} disabled={loading || !isValid || hasPending}
            className="w-full h-14 text-base font-black bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            {loading ? <><span className="animate-spin mr-2">⏳</span>{t.sending_label}</>
              : hasPending ? t.wait_pending_btn
              : t.send_withdraw_btn}
          </Button>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[["🔒", t.secure_label], ["⚡", t.within_24h_label], ["🆓", t.no_fees_label]].map(([icon, text]) => (
              <div key={text} className="bg-slate-800/40 rounded-lg p-2">
                <div className="text-lg">{icon}</div>
                <div className="text-[10px] text-gray-400 font-bold">{text}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {historyData && historyData.length > 0 && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
              <History className="h-4 w-4 text-blue-400" />
              {t.withdraw_history_title}
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
                      <p className="text-[10px] text-gray-500">{new Date(w.createdAt).toLocaleString()}</p>
                      {w.note && <p className="text-[10px] text-gray-400 mt-0.5">{t.note_label}: {w.note}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{Number(w.amount).toLocaleString()} {t.pts_unit}</p>
                    <p className="text-xs text-purple-400">⭐ {w.stars} {t.stars_unit}</p>
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
