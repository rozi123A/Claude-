import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";

interface UserData {
  telegramId: number;
  lastGiftDate?: string;
}

interface DailyGiftSectionProps {
  user: UserData;
  onClaim?: () => void;
}

const GIFTS = [
  { amount: 50, color: "#FFD700", label: "50" },
  { amount: 100, color: "#C0C0C0", label: "100" },
  { amount: 150, color: "#CD7F32", label: "150" },
  { amount: 200, color: "#E5E4E2", label: "200" },
  { amount: 500, color: "#FF69B4", label: "500" },
];

export default function DailyGiftSection({ user, onClaim }: DailyGiftSectionProps) {
  const [canClaim, setCanClaim] = useState(false);
  const [giftAmount, setGiftAmount] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const { toast } = useToast();

  const claimMutation = trpc.dailyGift.claim.useMutation();

  useEffect(() => {
    checkGiftStatus();
  }, []);

  const checkGiftStatus = () => {
    const today = new Date().toISOString().split("T")[0];
    setCanClaim(!user.lastGiftDate || user.lastGiftDate !== today);
  };

  const handleClaim = async () => {
    if (!canClaim || isAnimating) return;

    setIsAnimating(true);
    setShowGift(true);

    try {
      const data = await claimMutation.mutateAsync({
        telegramId: user.telegramId,
        initData: window.Telegram?.WebApp?.initData || "",
      });

      if (data.success) {
        setGiftAmount(data.reward);
        
        // Animation delay
        setTimeout(() => {
          setIsAnimating(false);
          setShowGift(false);
          setCanClaim(false);
          
          toast({
            title: "🎁 مبروك!",
            description: `حصلت على ${data.reward} نقطة يومية!`,
          });
          
          onClaim?.();
        }, 2000);
      } else {
        setIsAnimating(false);
        setShowGift(false);
        toast({
          title: "😢",
          description: data.message || "حدث خطأ ما",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsAnimating(false);
      setShowGift(false);
      toast({
        title: "😢",
        description: "فشل الحصول على الهدية",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
          <Gift className="w-6 h-6 text-pink-400" />
          <span>الهدية اليومية</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="relative w-40 h-40 mx-auto mb-4">
          {/* 3D Gift Box */}
          <div 
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              showGift ? "scale-110 rotate-12" : "scale-100"
            } ${!canClaim ? "opacity-50" : ""}`}
          >
            {/* Box base */}
            <div className="relative w-32 h-32">
              {/* Top lid - 3D effect */}
              <div className={`absolute top-0 left-2 right-2 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-t-lg transform ${showGift ? "-translate-y-4 rotate-12" : ""} transition-all duration-500`}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full animate-pulse" />
              </div>
              
              {/* Box body */}
              <div className={`absolute top-6 left-0 right-0 bottom-0 bg-gradient-to-b from-pink-600 to-purple-700 rounded-lg ${showGift ? "animate-bounce" : ""}`}>
                {/* Ribbon */}
                <div className="absolute top-1/2 left-0 right-0 h-4 bg-yellow-400/30 transform -translate-y-1/2" />
                <div className="absolute top-0 bottom-0 left-1/2 w-4 bg-yellow-400/30 -translate-x-1/2" />
              </div>
            </div>
          </div>

          {/* Sparkles when claimed */}
          {showGift && (
            <>
              <Sparkles className="absolute top-0 left-0 w-8 h-8 text-yellow-400 animate-ping" />
              <Sparkles className="absolute top-0 right-0 w-8 h-8 text-pink-400 animate-ping delay-100" />
              <Sparkles className="absolute bottom-0 left-0 w-8 h-8 text-purple-400 animate-ping delay-200" />
            </>
          )}
        </div>

        {/* Claim button */}
        <Button
          onClick={handleClaim}
          disabled={!canClaim || isAnimating}
          className={`w-full py-6 text-lg font-bold ${
            canClaim 
              ? "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg shadow-pink-500/30" 
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isAnimating ? (
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 animate-pulse" />
              جاري فتح الهدية...
            </span>
          ) : canClaim ? (
            <span className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              احصل على هديتك
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              تم الاستلام - عد غداً
            </span>
          )}
        </Button>

        {/* Next gift countdown info */}
        {!canClaim && (
          <p className="text-gray-400 text-sm mt-3">
            🎁 الهدية التالية завтра
          </p>
        )}
      </CardContent>
    </Card>
  );
}