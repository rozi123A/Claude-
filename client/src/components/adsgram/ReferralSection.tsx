import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translations, type Language } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

interface UserData {
  telegramId: number;
  referralCode: string;
}

interface ReferralSectionProps {
  user: UserData;
  lang: Language;
}

export default function ReferralSection({ user, lang }: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const t = translations[lang];

  const referralLink = `https://t.me/ads_reward123_bot?start=${user.telegramId}`;

  const { data: stats } = trpc.telegram.getReferralStats.useQuery(
    { telegramId: user.telegramId },
    { refetchInterval: 30000 }
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: t.copied, description: t.referral_link });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = `🎮 انضم معي في لعبة الأرباح! اربح نقاط وحوّلها لـ Telegram Stars⭐\n\n${referralLink}`;
    if (navigator.share) {
      navigator.share({ title: "Start Coin✨", text, url: referralLink });
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: t.copied });
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-5 w-5 text-blue-400" />
          {t.referral_system}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 text-center">
            <Users className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{stats?.count ?? 0}</p>
            <p className="text-[10px] text-gray-400 font-bold">{t.referral_count}</p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-center">
            <TrendingUp className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-black text-yellow-400">{(stats?.totalEarned ?? 0).toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 font-bold">{t.referral_earned}</p>
          </div>
        </div>

        {/* Rewards explanation */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/30 rounded-xl p-3 space-y-2">
          <p className="text-xs font-black text-purple-300">{t.rewards}</p>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-lg">💰</span>
            <span>{t.friend_join}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <span className="text-lg">🎁</span>
            <span>{t.friend_earnings}</span>
          </div>
        </div>

        {/* Referral link */}
        <div>
          <p className="text-[10px] text-gray-500 font-bold mb-1">{t.referral_link}</p>
          <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-3 break-all">
            <p className="text-xs font-mono text-yellow-400">{referralLink}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="border-slate-700 text-white hover:bg-slate-800 h-11"
          >
            {copied ? (
              <><Check className="h-4 w-4 mr-2 text-green-400" />{t.copied}</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" />{t.copy}</>
            )}
          </Button>
          <Button
            onClick={handleShare}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white h-11 font-bold"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t.share}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
