import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Tv2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trpc } from "@/lib/trpc";
import { translations, type Language } from "@/lib/i18n";
import AdOverlay from "./AdOverlay";

interface UserData { telegramId: number; balance: number; spinsLeft: number; adsgramBlockId: string; }
interface SpinWheelSectionProps {
  user: UserData; lang: Language;
  onReward: (update?: { balance: number; spinsLeft: number; totalEarned?: number }) => void;
  onSwitchToAds: () => void;
}

const PRIZES = [
  { label: "50",   value: 50,   color: "#FF6B6B" },
  { label: "200",  value: 200,  color: "#4ECDC4" },
  { label: "100",  value: 100,  color: "#FFE66D" },
  { label: "500",  value: 500,  color: "#FF9F43" },
  { label: "75",   value: 75,   color: "#A29BFE" },
  { label: "1000", value: 1000, color: "#FAB1A0" },
  { label: "150",  value: 150,  color: "#55E6C1" },
  { label: "250",  value: 250,  color: "#FD79A8" },
];

const MAX_AD_SPINS = 5;
const LS_COUNT = "spinAdCount";
const LS_DATE  = "spinAdDate";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function getAdSpinsUsed(): number {
  try {
    if (localStorage.getItem(LS_DATE) !== todayStr()) { localStorage.setItem(LS_COUNT,"0"); localStorage.setItem(LS_DATE,todayStr()); return 0; }
    return parseInt(localStorage.getItem(LS_COUNT)||"0",10);
  } catch { return 0; }
}
function bumpAdSpins() {
  try { localStorage.setItem(LS_COUNT,String(getAdSpinsUsed()+1)); localStorage.setItem(LS_DATE,todayStr()); } catch {}
}
function getAudioCtx(): AudioContext|null { try { return new (window.AudioContext||(window as any).webkitAudioContext)(); } catch { return null; } }
function playTick(ctx:AudioContext,t:number) {
  const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type="triangle"; o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(400,t+0.04);
  g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.04); o.start(t); o.stop(t+0.05);
}
function playSpinSound(ctx:AudioContext,dur:number) {
  const now=ctx.currentTime; let t=now,iv=0.06;
  while(t<now+dur){playTick(ctx,t);t+=iv;iv=0.06+((t-now)/dur)*0.55;}
}
function playWinSound(ctx:AudioContext) {
  const now=ctx.currentTime;
  [261.63,329.63,392.0,523.25].forEach((freq,i)=>{
    const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type="sine";
    const t=now+i*0.13; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.3,t+0.05); g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
    o.start(t); o.stop(t+0.4);
  });
}

export default function SpinWheelSection({ user, lang, onReward }: SpinWheelSectionProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext|null>(null);
  const [isSpinning,  setIsSpinning]  = useState(false);
  const [rotation,    setRotation]    = useState(0);
  const [showAd,      setShowAd]      = useState(false);
  const [adSpinsUsed, setAdSpinsUsed] = useState(0);
  const { toast } = useToast();
  const t = translations[lang];

  const spinMutation     = trpc.spin.perform.useMutation();
  const getTokenMutation = trpc.ads.getToken.useMutation();
  const claimMutation    = trpc.ads.claim.useMutation();

  useEffect(()=>{ setAdSpinsUsed(getAdSpinsUsed()); },[]);
  useEffect(()=>{ drawWheel(); },[rotation]);

  function drawWheel() {
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    const cx=canvas.width/2,cy=canvas.height/2,r=cx-15;
    const seg=PRIZES.length,arc=(2*Math.PI)/seg;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.beginPath(); ctx.arc(cx,cy,r+5,0,2*Math.PI); ctx.fillStyle="#2d3436"; ctx.fill();
    ctx.strokeStyle="#f1c40f"; ctx.lineWidth=4; ctx.stroke();
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(rotation);
    for(let i=0;i<seg;i++){
      const s=i*arc,e=s+arc;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,s,e); ctx.closePath();
      ctx.fillStyle=PRIZES[i].color; ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=2; ctx.stroke();
      ctx.save(); ctx.rotate(s+arc/2); ctx.textAlign="right";
      ctx.fillStyle="#2d3436"; ctx.font="bold 18px 'Inter',sans-serif";
      ctx.fillText(PRIZES[i].label,r-25,7); ctx.restore();
    }
    ctx.restore();
    const grad=ctx.createRadialGradient(cx,cy,5,cx,cy,30);
    grad.addColorStop(0,"#f1c40f"); grad.addColorStop(1,"#e67e22");
    ctx.beginPath(); ctx.arc(cx,cy,30,0,2*Math.PI); ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font="bold 14px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("GO",cx,cy);
    ctx.beginPath(); ctx.moveTo(cx-10,cy-r-5); ctx.lineTo(cx+10,cy-r-5); ctx.lineTo(cx,cy-r+15); ctx.closePath();
    ctx.fillStyle="#fff"; ctx.fill(); ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.stroke();
  }

  async function handleClaimSpinAd() {
    const initData=window.Telegram?.WebApp?.initData||"";
    const tok=await getTokenMutation.mutateAsync({telegramId:user.telegramId,initData});
    if(!tok.success||!tok.token) throw new Error(tok.message||"failed");
    const cl=await claimMutation.mutateAsync({telegramId:user.telegramId,token:tok.token,initData,type:"spin"});
    if(!cl.success) throw new Error(cl.message||"failed");
    bumpAdSpins(); setAdSpinsUsed(getAdSpinsUsed());
    toast({title:t.congrats,description:t.spin_extra_msg});
    onReward(cl.balance!==undefined&&cl.spinsLeft!==undefined?{balance:Number(cl.balance),spinsLeft:Number(cl.spinsLeft)}:undefined);
    setShowAd(false);
  }

  async function handleSpin() {
    if(isSpinning||user.spinsLeft<=0) return;
    setIsSpinning(true);
    if(!audioCtxRef.current) audioCtxRef.current=getAudioCtx();
    const actx=audioCtxRef.current;
    if(actx?.state==="suspended") await actx.resume();
    try {
      const data=await spinMutation.mutateAsync({telegramId:user.telegramId,initData:window.Telegram?.WebApp?.initData||""});
      if(!data.success){toast({title:"⚠️",description:data.message||t.spin_failed_msg,variant:"destructive"});setIsSpinning(false);return;}
      const idx=PRIZES.findIndex(p=>p.value===data.prize);
      const seg=(2*Math.PI)/PRIZES.length;
      const target=rotation+8*Math.PI*2+(-(idx*seg+seg/2)-Math.PI/2-rotation%(Math.PI*2));
      const dur=4000,t0=Date.now(),r0=rotation;
      if(actx) playSpinSound(actx,dur/1000);
      const animate=()=>{
        const p=Math.min((Date.now()-t0)/dur,1);
        setRotation(r0+(target-r0)*(1-Math.pow(1-p,4)));
        if(p<1){requestAnimationFrame(animate);}
        else{
          if(actx) playWinSound(actx);
          toast({title:t.congrats,description:`${t.spin_won_prefix} ${data.prize} ${t.pts_unit}!`});
          onReward(data.balance!==undefined&&data.spinsLeft!==undefined?{balance:Number(data.balance),spinsLeft:Number(data.spinsLeft)}:undefined);
          setIsSpinning(false);
        }
      };
      animate();
    } catch {
      toast({title:"⚠️",description:t.spin_error_msg,variant:"destructive"});
      setIsSpinning(false);
    }
  }

  const adSpinsLeft=MAX_AD_SPINS-adSpinsUsed;
  const noFreeSpins=user.spinsLeft<=0;

  return (
    <>
      {showAd && <AdOverlay seconds={15} rewardLabel={`🎡 ${t.spin_extra_msg}`} lang={lang} onClaim={handleClaimSpinAd} onClose={()=>setShowAd(false)} />}

      <Card className="bg-gradient-to-b from-slate-900/80 to-slate-950 border-slate-700/50 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/50 bg-slate-900/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg"><Gift className="h-5 w-5 text-purple-400" /></div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t.spin_title}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
              <Sparkles className="h-3 w-3 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">{t.big_prizes}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-8 pb-6 space-y-6">
          <div className="relative flex justify-center items-center">
            <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
            <canvas ref={canvasRef} width={320} height={320}
              onClick={!isSpinning&&user.spinsLeft>0?handleSpin:undefined}
              className={`relative z-10 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-transform ${!isSpinning&&user.spinsLeft>0?"cursor-pointer hover:scale-105":"cursor-default opacity-60"}`} />
            {!isSpinning&&user.spinsLeft>0&&(
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="animate-ping absolute h-16 w-16 rounded-full bg-yellow-400/20" />
              </div>
            )}
          </div>

          <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">{t.free_spins_label}</span>
              <span className="text-sm font-bold text-purple-400">{user.spinsLeft} / 5</span>
            </div>
            <div className="flex gap-2">
              {Array.from({length:5}).map((_,i)=>(
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i<user.spinsLeft?"bg-gradient-to-r from-purple-500 to-purple-400":"bg-slate-800"}`} />
              ))}
            </div>
          </div>

          {user.spinsLeft>0 && (
            <Button onClick={handleSpin} disabled={isSpinning}
              className="w-full h-14 text-lg font-black bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-600 hover:scale-[1.02] active:scale-[0.98] text-slate-950 shadow-[0_4px_15px_rgba(234,179,8,0.3)] transition-all duration-300">
              {isSpinning ? t.spinning_label : t.start_spin_btn}
            </Button>
          )}

          {noFreeSpins && (
            <div className="space-y-3">
              <div className="bg-slate-800/60 border border-purple-700/40 rounded-xl p-4 text-center">
                <p className="text-yellow-400 font-bold text-sm">{t.no_spins_title}</p>
                <p className="text-gray-400 text-xs mt-1">{t.no_spins_desc}</p>
              </div>
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-400 font-bold">{t.spin_ads_label}</span>
                  <span className="text-xs font-black" style={{color:adSpinsLeft>0?"#c4b5fd":"#6b7280"}}>
                    {adSpinsUsed} / {MAX_AD_SPINS} {t.used_label}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({length:MAX_AD_SPINS}).map((_,i)=>(
                    <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-500"
                      style={{background:i<adSpinsUsed?"linear-gradient(90deg,#7c3aed,#6d28d9)":"rgba(71,85,105,0.4)"}} />
                  ))}
                </div>
              </div>
              {adSpinsLeft>0 ? (
                <>
                  <Button onClick={()=>setShowAd(true)} disabled={isSpinning}
                    className="w-full h-14 text-base font-black text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{background:"linear-gradient(135deg,#7c3aed,#4f46e5)",boxShadow:"0 4px 20px rgba(124,58,237,0.4)"}}>
                    <Tv2 className="h-5 w-5" />
                    {t.watch_ad_for_spin_btn}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{background:"rgba(255,255,255,0.2)"}}>
                      {adSpinsLeft} {t.remaining_label}
                    </span>
                  </Button>
                  <p className="text-[10px] text-gray-500 text-center">{t.spin_ad_info}</p>
                </>
              ) : (
                <div className="text-center py-3 px-4 bg-slate-800/40 rounded-xl border border-slate-700/30">
                  <p className="text-xs text-gray-500 font-bold">{t.spin_ads_done}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{t.spin_refresh_tomorrow}</p>
                </div>
              )}
            </div>
          )}
          {user.spinsLeft>0 && <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">{t.free_daily_attempts}</p>}
        </CardContent>
      </Card>
    </>
  );
}
