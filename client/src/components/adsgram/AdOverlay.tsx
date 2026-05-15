import { useState, useEffect, useRef } from "react";

interface AdOverlayProps {
  seconds?: number;
  rewardLabel: string;
  onClaim: () => Promise<void>;
  onClose: () => void;
}

export default function AdOverlay({ seconds = 15, rewardLabel, onClaim, onClose }: AdOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

  // Load and show real Monetag interstitial ad when overlay opens
  useEffect(() => {
    // Try show_10996226 (Monetag interstitial) if available
    const tryShowAd = () => {
      const fn = (window as any)["show_10996226"];
      if (typeof fn === "function") {
        try { fn(); setAdLoaded(true); } catch {}
        return true;
      }
      return false;
    };

    if (!tryShowAd()) {
      // Script not loaded yet — load it and retry
      if (!document.getElementById("monetag-interstitial")) {
        const s = document.createElement("script");
        s.id = "monetag-interstitial";
        s.src = "//alwingulla.com/88/tag.min.js";
        s.setAttribute("data-zone", "10996226");
        s.setAttribute("data-type", "1");
        s.async = true;
        s.setAttribute("data-cfasync", "false");
        s.onload = () => {
          setTimeout(() => {
            if (tryShowAd()) setAdLoaded(true);
          }, 500);
        };
        document.head.appendChild(s);
      } else {
        setTimeout(() => {
          if (tryShowAd()) setAdLoaded(true);
        }, 800);
      }
    }

    // Also load in-page push for additional impression
    if (!document.getElementById("monetag-inpage")) {
      const s2 = document.createElement("script");
      s2.id = "monetag-inpage";
      s2.src = "//3nbf4.com/400/10996226";
      s2.async = true;
      s2.setAttribute("data-cfasync", "false");
      document.head.appendChild(s2);
    }
  }, []);

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanClaim(true);
          return 0;
        }
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
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: "#0f1117" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 border-b border-white/5">
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">إعلان</span>
        <div className="px-4 py-1 bg-slate-800 rounded-full border border-slate-700">
          <span className="text-sm font-black text-white tabular-nums">
            {timeLeft > 0 ? `${mm}:${ss}` : "✓ جاهز"}
          </span>
        </div>
        <span className="text-[11px] text-gray-500 font-bold">مدعوم من Monetag</span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
          style={{ width: `${pct}%`, transition: canClaim ? "none" : "width 1s linear" }}
        />
      </div>

      {/* Ad area — Monetag renders here */}
      <div
        ref={adContainerRef}
        className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        id="monetag-ad-container"
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle, #60a5fa 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        {/* Monetag will inject its ad via the global show function */}
        {/* This placeholder shows while ad loads */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6">
          <div
            className="w-52 h-52 rounded-2xl flex items-center justify-center"
            style={{ background: "radial-gradient(ellipse at center,#1a1a6e 0%,#0a0a2e 70%)" }}
          >
            <div className="absolute inset-0 rounded-2xl animate-pulse bg-blue-900/20" />
            <span
              className="text-9xl font-black relative z-10 select-none"
              style={{ filter: "drop-shadow(0 0 24px #60a5fa) drop-shadow(0 0 48px #3b82f6)", color: "#60a5fa" }}
            >?</span>
          </div>
          <p className="text-gray-400 text-sm text-center">
            {adLoaded ? "الإعلان يعمل الآن" : "جاري تحميل الإعلان..."}
          </p>
          <p className="text-[11px] text-gray-600">ads by Monetag</p>
        </div>
      </div>

      {/* Claim button */}
      <div className="px-4 pb-2">
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            background: canClaim ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(34,197,94,0.12)",
            color: canClaim ? "#fff" : "#4ade80",
            boxShadow: canClaim ? "0 0 24px rgba(34,197,94,0.4)" : "none",
            cursor: canClaim ? "pointer" : "not-allowed",
            border: "none",
          }}
        >
          {claiming
            ? "⏳ جاري الاستلام..."
            : canClaim
            ? <><span>⬇</span><span>انقر للحصول على المكافأة! ({rewardLabel})</span></>
            : <><span>⬇</span><span>جاري الاستلام... {timeLeft}</span></>
          }
        </button>
      </div>

      {/* Continue button */}
      <div className="px-4 pb-6 pt-2">
        <button
          onClick={canClaim ? onClose : undefined}
          disabled={!canClaim}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all"
          style={{
            background: canClaim ? "rgba(59,130,246,0.15)" : "rgba(30,41,59,0.5)",
            color: canClaim ? "#93c5fd" : "#4b5563",
            border: canClaim ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(71,85,105,0.3)",
            cursor: canClaim ? "pointer" : "not-allowed",
          }}
        >
          {canClaim ? "استمر ›" : `انتظر ${timeLeft}s`}
        </button>
      </div>
    </div>
  );
}
