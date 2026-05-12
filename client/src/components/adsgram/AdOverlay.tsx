import { useState, useEffect, useRef } from "react";
import { translations, type Language } from "@/lib/i18n";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel: string;
  lang: Language;
  onClaim: () => Promise<void>;
  onClose: () => void;
}

const AD_SPONSORS = [
  { name: "Rich Dog REAL MONEY 💰🐶", desc: "Get \$RICH & Famous with hash miner, card upgrades and trading! Check in daily for the secret prize and open mystery boxes to win the USDT lottery!" },
  { name: "CryptoFarm 🌾", desc: "Farm crypto every day! Collect coins, upgrade your farm and earn real USDT rewards daily. Join millions of players now!" },
  { name: "Lucky Wheel Pro 🎡", desc: "Spin and win real crypto prizes every hour! Invite friends, complete tasks and climb the leaderboard to get the top reward!" },
];

export default function AdOverlay({ seconds = 15, rewardLabel, lang, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [sponsor] = useState(() => AD_SPONSORS[Math.floor(Math.random() * AD_SPONSORS.length)]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = translations[lang];

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setCanClaim(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleClaim = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    try { await onClaim(); } finally { setClaiming(false); }
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const pct = ((seconds - timeLeft) / seconds) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111827]">
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/5">
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{t.ad_overlay_label}</span>
        <div className="px-4 py-1 bg-slate-800 rounded-full border border-slate-700">
          <span className="text-sm font-black text-white tabular-nums">
            {timeLeft > 0 ? `${mm}:${ss}` : t.ad_ready_label}
          </span>
        </div>
        <span className="text-[11px] text-gray-600 font-bold">{t.powered_by_monetag}</span>
      </div>

      <div className="h-0.5 bg-slate-800">
        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
          style={{ width: `${pct}%`, transition: canClaim ? "none" : "width 1s linear" }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-4">
        <div className="w-48 h-48 rounded-2xl flex items-center justify-center relative overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center,#1a1a6e 0%,#0a0a2e 70%)" }}>
          <div className="absolute inset-0 bg-blue-900/20 animate-pulse" />
          <span className="text-8xl font-black relative z-10 select-none"
            style={{ filter: "drop-shadow(0 0 24px #60a5fa) drop-shadow(0 0 48px #3b82f6)", color: "#60a5fa" }}>?</span>
        </div>

        <div className="w-full max-w-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-sm font-black">
              {sponsor.name[0]}
            </div>
            <p className="text-sm font-black text-white leading-tight">{sponsor.name}</p>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{sponsor.desc}</p>
          <span className="inline-block text-[10px] text-gray-600 border border-gray-700 px-2 py-0.5 rounded">Ad</span>
        </div>

        <p className="text-[11px] text-gray-500 font-medium">ads by Monetag</p>
      </div>

      {canClaim && (
        <div className="px-4 pb-2">
          <button onClick={handleClaim} disabled={claiming}
            className="w-full py-3.5 rounded-xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 24px rgba(34,197,94,0.4)" }}>
            <span>⬇</span>
            {claiming ? t.claiming_label : `${t.claim_reward_btn} (${rewardLabel})`}
          </button>
        </div>
      )}

      <div className="px-4 pb-6 pt-2">
        <button onClick={canClaim ? onClose : undefined} disabled={!canClaim}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all"
          style={{
            background: canClaim ? "rgba(59,130,246,0.15)" : "rgba(30,41,59,0.5)",
            color: canClaim ? "#93c5fd" : "#4b5563",
            border: canClaim ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(71,85,105,0.3)",
          }}>
          {canClaim ? t.continue_btn : `${t.wait_seconds_btn} ${timeLeft}s`}
        </button>
      </div>
    </div>
  );
}
