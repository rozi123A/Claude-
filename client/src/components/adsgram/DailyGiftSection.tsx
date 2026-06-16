import { useState, useEffect } from "react";
import { Gift, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function DailyGiftSection({ telegramId, initData, lang, t }: any) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const { toast } = useToast();
  
  const claimMut = trpc.telegram.dailyGift.claim.useMutation();
  const userQ = trpc.telegram.getUser.useQuery({ telegramId, initData });

  useEffect(() => {
    if (!userQ.data?.user?.completedTasks) return;
    
    const checkCooldown = () => {
      try {
        const tasks = JSON.parse(userQ.data.user.completedTasks);
        const lastGift = tasks.lastDailyGift;
        if (!lastGift) {
          setCanClaim(true);
          return;
        }

        const nextClaim = new Date(lastGift).getTime() + 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now >= nextClaim) {
          setCanClaim(true);
          setTimeLeft(null);
        } else {
          setCanClaim(false);
          const diff = nextClaim - now;
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m`);
        }
      } catch {
        setCanClaim(true);
      }
    };

    checkCooldown();
    const timer = setInterval(checkCooldown, 60000);
    return () => clearInterval(timer);
  }, [userQ.data]);

  const handleClaim = async () => {
    if (!canClaim || isOpening) return;
    setIsOpening(true);
    
    try {
      const res = await claimMut.mutateAsync({ telegramId, initData });
      if (res.success) {
        toast({ title: "🎁 " + (lang === "ar" ? "مبروك!" : "Congrats!"), description: (lang === "ar" ? "حصلت على 10 نقاط هدية" : "You got 10 points gift") });
        userQ.refetch();
      } else {
        toast({ title: "❌", description: res.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setTimeout(() => setIsOpening(false), 2000);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-500/30 overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-200">
          <Gift className="w-5 h-5 text-yellow-400" />
          {t.dailyGift}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-6">
        <div className={`relative transition-all duration-700 ${isOpening ? 'scale-125 rotate-12' : 'hover:scale-110'}`}>
          <div className={`text-7xl mb-4 filter drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] ${isOpening ? 'animate-bounce' : ''}`}>
            {canClaim ? "🎁" : "📦"}
          </div>
          {!canClaim && (
             <div className="absolute -top-2 -right-2 bg-black/60 rounded-full p-1">
               <Clock className="w-4 h-4 text-gray-400" />
             </div>
          )}
        </div>

        <div className="text-center mt-2">
           {canClaim ? (
             <p className="text-green-400 font-bold text-sm animate-pulse mb-4">
               {lang === "ar" ? "الهدية جاهزة للاستلام!" : "Gift is ready!"}
             </p>
           ) : (
             <p className="text-gray-400 text-xs mb-4">
               {lang === "ar" ? "عد بعد: " : "Next in: "} <span className="text-purple-300 font-mono">{timeLeft}</span>
             </p>
           )}

           <Button 
             onClick={handleClaim}
             disabled={!canClaim || isOpening}
             className={`w-full min-w-[160px] h-11 rounded-xl font-bold transition-all ${
               canClaim 
               ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]" 
               : "bg-white/5 text-gray-500"
             }`}
           >
             {isOpening ? (lang === "ar" ? "جاري الفتح..." : "Opening...") : (canClaim ? (lang === "ar" ? "استلام 10 نقاط" : "Claim 10 pts") : (lang === "ar" ? "تم الاستلام" : "Claimed"))}
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}
