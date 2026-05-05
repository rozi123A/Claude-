import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserData {
  referralCode: string;
  telegramId: number;
}

interface ReferralSectionProps {
  user: UserData;
}

export default function ReferralSection({ user }: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Use the bot username from Telegram or a default
  const botUsername = "ads_reward123_bot"; // Your bot username
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: "✅ تم النسخ",
      description: "تم نسخ رابط الإحالة",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Start Coin✨",
        text: "انضم إلي وادفع النقاط كنجوم حقيقية!",
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-400" />
          نظام الإحالات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700/30">
          <p className="text-sm text-gray-300 mb-3">
            ادعُ أصدقاءك واكسب مكافآت إضافية عند انضمامهم!
          </p>
          <div className="bg-slate-900/50 p-3 rounded border border-slate-700 mb-3 break-all">
            <p className="text-xs text-gray-400 mb-1">رابط الإحالة:</p>
            <p className="text-sm font-mono text-yellow-400">{referralLink}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="border-slate-700 text-white hover:bg-slate-800"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                تم النسخ
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                نسخ
              </>
            )}
          </Button>
          <Button
            onClick={handleShare}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Share2 className="h-4 w-4 mr-2" />
            مشاركة
          </Button>
        </div>

        <div className="space-y-2 text-xs text-gray-400">
          <p className="font-semibold text-yellow-400 mb-2">🎁 المكافآت:</p>
          <p className="flex items-center gap-2">
            <span>👤</span>
            <span>كل صديق ينضم: +500 نقطة</span>
          </p>
          <p className="flex items-center gap-2">
            <span>💰</span>
            <span>10% من أرباح الصديق</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
