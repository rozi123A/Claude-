import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SubscriptionCheckProps {
  telegramId: number;
  onSubscribed: () => void;
  lang: "ar" | "en" | "ru";
}

const translations = {
  ar: {
    title: "الاشتراك الإجباري",
    description: "يجب الاشتراك في القناة لاستخدام البوت",
    channelName: "قناة الأرباح",
    subscribe: "اشترك الآن",
    checking: "جاري التحقق...",
    subscribed: "شكراً لاشتراكك!",
  },
  en: {
    title: "Required Subscription",
    description: "You must subscribe to the channel to use the bot",
    channelName: "Earnings Channel",
    subscribe: "Subscribe Now",
    checking: "Checking...",
    subscribed: "Thank you for subscribing!",
  },
  ru: {
    title: "Обязательная подписка",
    description: "Вы должны подписаться на канал, чтобы использовать бота",
    channelName: "Канал доходов",
    subscribe: "Подписаться",
    checking: "Проверка...",
    subscribed: "Спасибо за подписку!",
  },
};

export default function SubscriptionCheck({
  telegramId,
  onSubscribed,
  lang,
}: SubscriptionCheckProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const t = translations[lang];

  const checkSubscriptionMutation = trpc.telegram.checkSubscription.useMutation();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const result = await checkSubscriptionMutation.mutateAsync({
          telegramId,
        });
        if (result.success && result.isSubscribed) {
          setIsSubscribed(true);
          onSubscribed();
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
      } finally {
        setChecking(false);
      }
    };

    checkSubscription();
  }, [telegramId]);

  if (isSubscribed) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-900 border-slate-700 max-w-sm w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-300 text-sm">{t.description}</p>

          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-sm font-semibold text-white mb-2">
              {t.channelName}
            </p>
            <p className="text-xs text-gray-400 mb-3">@Earn130</p>
            <a
              href="https://t.me/Earn130"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
            >
              <ExternalLink className="h-4 w-4" />
              {t.subscribe}
            </a>
          </div>

          <Button
            onClick={() => checkSubscription()}
            disabled={checking}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
          >
            {checking ? t.checking : t.subscribed}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            بعد الاشتراك، اضغط على الزر أعلاه للتحقق
          </p>
        </CardContent>
      </Card>
    </div>
  );

  async function checkSubscription() {
    setChecking(true);
    try {
      const result = await checkSubscriptionMutation.mutateAsync({
        telegramId,
      });
      if (result.success && result.isSubscribed) {
        setIsSubscribed(true);
        onSubscribed();
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setChecking(false);
    }
  }
}
