import { useState, useEffect, useCallback, useRef } from "react";

interface CoinData {
  id: string; symbol: string; name: string; image: string;
  current_price: number; price_change_percentage_24h: number;
  market_cap: number; total_volume: number; market_cap_rank: number;
}

const COIN_IDS = "bitcoin,ethereum,binancecoin,the-open-network,digibyte,dogecoin,solana";
const REFRESH_MS = 30000;

const FALLBACK: CoinData[] = [
  { id:"bitcoin",          symbol:"btc",  name:"Bitcoin",  image:"", current_price:67000,   price_change_percentage_24h:1.2,  market_cap:1320000000000, total_volume:38000000000, market_cap_rank:1 },
  { id:"ethereum",         symbol:"eth",  name:"Ethereum", image:"", current_price:3500,    price_change_percentage_24h:-0.8, market_cap:420000000000,  total_volume:18000000000, market_cap_rank:2 },
  { id:"binancecoin",      symbol:"bnb",  name:"BNB",      image:"", current_price:580,     price_change_percentage_24h:0.5,  market_cap:86000000000,   total_volume:2100000000,  market_cap_rank:4 },
  { id:"the-open-network", symbol:"ton",  name:"TON",      image:"", current_price:5.8,     price_change_percentage_24h:2.1,  market_cap:14000000000,   total_volume:320000000,   market_cap_rank:9 },
  { id:"digibyte",         symbol:"dgb",  name:"DigiByte", image:"", current_price:0.00105, price_change_percentage_24h:-1.3, market_cap:19000000,      total_volume:850000,      market_cap_rank:180 },
  { id:"dogecoin",         symbol:"doge", name:"Dogecoin", image:"", current_price:0.16,    price_change_percentage_24h:3.4,  market_cap:23000000000,   total_volume:1400000000,  market_cap_rank:8 },
  { id:"solana",           symbol:"sol",  name:"Solana",   image:"", current_price:170,     price_change_percentage_24h:-2.1, market_cap:78000000000,   total_volume:4200000000,  market_cap_rank:5 },
];
const COIN_ICONS: Record<string,string> = { bitcoin:"₿", ethereum:"Ξ", binancecoin:"⬡", "the-open-network":"💎", digibyte:"⟠", dogecoin:"Ð", solana:"◎" };
const COIN_COLORS: Record<string,string> = { bitcoin:"#F7931A", ethereum:"#627EEA", binancecoin:"#F3BA2F", "the-open-network":"#0088CC", digibyte:"#0E8FEF", dogecoin:"#C2A633", solana:"#9945FF" };

function fmt(n: number): string {
  if (n >= 1e12) return "$"+(n/1e12).toFixed(2)+"T";
  if (n >= 1e9)  return "$"+(n/1e9).toFixed(2)+"B";
  if (n >= 1e6)  return "$"+(n/1e6).toFixed(2)+"M";
  return "$"+n.toLocaleString();
}
function fmtPrice(p: number): string {
  if (p >= 1000) return "$"+p.toLocaleString(undefined,{maximumFractionDigits:0});
  if (p >= 1)    return "$"+p.toFixed(2);
  if (p >= 0.01) return "$"+p.toFixed(4);
  return "$"+p.toFixed(6);
}

export default function CryptoMarketSection() {
  const [coins, setCoins]         = useState<CoinData[]>([]);
  const [flashing, setFlashing]   = useState<Record<string,"up"|"down">>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS/1000);
  const [updating, setUpdating]   = useState(false);
  const prevRef = useRef<Record<string,number>>({});

  const fetchCoins = useCallback(async (silent=false) => {
    if (!silent) setUpdating(true);
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error("err");
      const data: CoinData[] = await res.json();
      if (!Array.isArray(data)||data.length===0) throw new Error("empty");

      // Flash changed prices
      const flash: Record<string,"up"|"down"> = {};
      data.forEach(c => {
        const prev = prevRef.current[c.id];
        if (prev !== undefined && prev !== c.current_price)
          flash[c.id] = c.current_price > prev ? "up" : "down";
      });
      if (Object.keys(flash).length) {
        setFlashing(flash);
        setTimeout(()=>setFlashing({}), 1200);
      }
      const map: Record<string,number> = {};
      data.forEach(c => { map[c.id]=c.current_price; });
      prevRef.current = map;

      setCoins(data); setError(false); setLastUpdate(new Date()); setCountdown(REFRESH_MS/1000);
    } catch {
      if (!coins.length) { setCoins(FALLBACK); setError(true); }
      setCountdown(REFRESH_MS/1000);
    } finally { setLoading(false); setUpdating(false); }
  }, [coins.length]);

  useEffect(()=>{ fetchCoins(false); }, []);
  useEffect(()=>{ const t=setInterval(()=>fetchCoins(true), REFRESH_MS); return ()=>clearInterval(t); }, [fetchCoins]);
  useEffect(()=>{ const t=setInterval(()=>setCountdown(c=>c>0?c-1:REFRESH_MS/1000),1000); return ()=>clearInterval(t); }, []);

  const sorted = [...coins].sort((a,b)=>b.price_change_percentage_24h-a.price_change_percentage_24h);
  const gainers= sorted.filter(c=>c.price_change_percentage_24h>0).slice(0,3);
  const losers = sorted.filter(c=>c.price_change_percentage_24h<0).slice(-3).reverse();
  const totalPos = coins.filter(c=>c.price_change_percentage_24h>0).length;
  const bull = totalPos >= coins.length/2;
  const avg  = coins.length ? coins.reduce((s,c)=>s+c.price_change_percentage_24h,0)/coins.length : 0;

  if (loading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:300,gap:16}}>
      <div style={{width:44,height:44,border:"3px solid rgba(14,143,239,0.2)",borderTopColor:"#0E8FEF",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>جارٍ تحميل أسعار السوق...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{paddingBottom:20}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes livePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0.5}}
        @keyframes flashUp{0%{background:rgba(16,185,129,0.3)}100%{background:transparent}}
        @keyframes flashDown{0%{background:rgba(239,68,68,0.3)}100%{background:transparent}}
        .flash-up{animation:flashUp 1.2s ease-out;border-color:rgba(16,185,129,0.5)!important}
        .flash-down{animation:flashDown 1.2s ease-out;border-color:rgba(239,68,68,0.5)!important}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:900,margin:"0 0 2px",color:"#fff"}}>📊 سوق العملات</h2>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:0}}>
            {lastUpdate?"تحديث: "+lastUpdate.toLocaleTimeString("ar"):""}
          </p>
        </div>
        {/* LIVE badge + progress bar */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:updating?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)",border:"1px solid "+(updating?"rgba(245,158,11,0.35)":"rgba(16,185,129,0.35)"),borderRadius:20,padding:"5px 11px"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:updating?"#F59E0B":"#10B981",animation:"livePulse 1.4s infinite",flexShrink:0}}/>
            <span style={{fontSize:11,fontWeight:800,color:updating?"#F59E0B":"#10B981",letterSpacing:"0.06em"}}>
              {updating?"جارٍ...":"مباشر"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:36,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",background:"#10B981",borderRadius:2,transition:"width 1s linear",
                width:((REFRESH_MS/1000-countdown)/(REFRESH_MS/1000)*100)+"%"}}/>
            </div>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontVariantNumeric:"tabular-nums"}}>{countdown}s</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"8px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span>⚠️</span>
          <p style={{fontSize:11,color:"#FCA5A5",margin:0}}>تعذّر الاتصال بـ CoinGecko — بيانات احتياطية</p>
        </div>
      )}

      {/* Market Sentiment */}
      <div style={{background:bull?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.07)",border:"1px solid "+(bull?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"),borderRadius:18,padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:9,color:"rgba(255,255,255,0.4)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 4px"}}>اتجاه السوق</p>
            <p style={{fontSize:18,fontWeight:900,color:bull?"#10B981":"#EF4444",margin:0}}>{bull?"📈 سوق صاعد":"📉 سوق هابط"}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>{totalPos} من {coins.length} عملات في ارتفاع</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:9,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>متوسط التغير</p>
            <p style={{fontSize:22,fontWeight:900,color:avg>=0?"#10B981":"#EF4444",margin:0,fontVariantNumeric:"tabular-nums"}}>
              {avg>=0?"+":""}{avg.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Coin Cards */}
      <div style={{marginBottom:14}}>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 10px"}}>أسعار مباشرة</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {coins.map(coin=>{
            const up = coin.price_change_percentage_24h>=0;
            const color = COIN_COLORS[coin.id]||"#10B981";
            const icon  = COIN_ICONS[coin.id]||coin.symbol[0].toUpperCase();
            const flash = flashing[coin.id];
            return (
              <div key={coin.id} className={flash?"flash-"+(flash==="up"?"up":"down"):""} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,transition:"border-color 0.3s"}}>
                <div style={{width:42,height:42,borderRadius:13,background:color+"18",border:"1px solid "+color+"30",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:19,fontWeight:900,color}}>{icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <p style={{fontSize:13,fontWeight:800,color:"#fff",margin:0}}>{coin.name}</p>
                    <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.06)",padding:"1px 5px",borderRadius:5,textTransform:"uppercase"}}>{coin.symbol}</span>
                  </div>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:0}}>Vol: {fmt(coin.total_volume)}</p>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontSize:14,fontWeight:900,color:flash==="up"?"#10B981":flash==="down"?"#EF4444":"#fff",margin:"0 0 3px",fontVariantNumeric:"tabular-nums",transition:"color 0.4s"}}>{fmtPrice(coin.current_price)}</p>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3,background:up?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)",borderRadius:6,padding:"2px 7px"}}>
                    <span style={{fontSize:10}}>{up?"▲":"▼"}</span>
                    <span style={{fontSize:11,fontWeight:800,color:up?"#10B981":"#EF4444",fontVariantNumeric:"tabular-nums"}}>{up?"+":""}{coin.price_change_percentage_24h.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Cap */}
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"12px 14px",marginBottom:14}}>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 10px"}}>القيمة السوقية</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {coins.slice(0,5).map(coin=>{
            const color=COIN_COLORS[coin.id]||"#10B981";
            const pct=Math.max(4,(coin.market_cap/(coins[0]?.market_cap||1))*100);
            return (
              <div key={coin.id}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:700}}>{coin.symbol.toUpperCase()}</span>
                  <span style={{fontSize:11,color:"#fff",fontWeight:800}}>{fmt(coin.market_cap)}</span>
                </div>
                <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:3}}>
                  <div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,"+color+"80,"+color+")",borderRadius:3,transition:"width 0.8s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gainers & Losers */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.18)",borderRadius:16,padding:"12px"}}>
          <p style={{fontSize:10,color:"#10B981",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>📈 أعلى ارتفاعاً</p>
          {gainers.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700}}>{c.symbol.toUpperCase()}</span>
              <span style={{fontSize:12,fontWeight:900,color:"#10B981"}}>+{c.price_change_percentage_24h.toFixed(2)}%</span>
            </div>
          ))}
          {!gainers.length&&<p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:0}}>—</p>}
        </div>
        <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:16,padding:"12px"}}>
          <p style={{fontSize:10,color:"#EF4444",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>📉 أعلى انخفاضاً</p>
          {losers.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700}}>{c.symbol.toUpperCase()}</span>
              <span style={{fontSize:12,fontWeight:900,color:"#EF4444"}}>{c.price_change_percentage_24h.toFixed(2)}%</span>
            </div>
          ))}
          {!losers.length&&<p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:0}}>—</p>}
        </div>
      </div>

      {/* Volume */}
      <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.18)",borderRadius:16,padding:"14px 16px",marginBottom:12}}>
        <p style={{fontSize:10,color:"rgba(16,185,129,0.7)",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 10px"}}>💹 حجم التداول 24h</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {coins.slice(0,4).map(c=>(
            <div key={c.id} style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{c.symbol}</span>
              <span style={{fontSize:12,fontWeight:800,color:"#34D399"}}>{fmt(c.total_volume)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DGB Highlight */}
      {(()=>{
        const dgb=coins.find(c=>c.id==="digibyte");
        if(!dgb) return null;
        const up=dgb.price_change_percentage_24h>=0;
        return (
          <div style={{background:"linear-gradient(135deg,rgba(14,143,239,0.12),rgba(14,143,239,0.04))",border:"1px solid rgba(14,143,239,0.28)",borderRadius:18,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:12,background:"rgba(14,143,239,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#0E8FEF"}}>⟠</div>
                <div>
                  <p style={{fontSize:13,fontWeight:900,color:"#0E8FEF",margin:0}}>DigiByte (DGB)</p>
                  <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:0}}>عملة التطبيق</p>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:20,fontWeight:900,color:"#0E8FEF",margin:"0 0 3px",fontVariantNumeric:"tabular-nums"}}>{fmtPrice(dgb.current_price)}</p>
                <span style={{fontSize:12,fontWeight:800,color:up?"#10B981":"#EF4444"}}>{up?"+":""}{dgb.price_change_percentage_24h.toFixed(2)}% اليوم</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"rgba(14,143,239,0.08)",borderRadius:10,padding:"8px 10px"}}>
                <p style={{fontSize:9,color:"rgba(14,143,239,0.5)",margin:"0 0 2px"}}>القيمة السوقية</p>
                <p style={{fontSize:12,fontWeight:800,color:"#60A5FA",margin:0}}>{fmt(dgb.market_cap)}</p>
              </div>
              <div style={{background:"rgba(14,143,239,0.08)",borderRadius:10,padding:"8px 10px"}}>
                <p style={{fontSize:9,color:"rgba(14,143,239,0.5)",margin:"0 0 2px"}}>حجم التداول</p>
                <p style={{fontSize:12,fontWeight:800,color:"#60A5FA",margin:0}}>{fmt(dgb.total_volume)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      <p style={{fontSize:10,color:"rgba(255,255,255,0.18)",textAlign:"center",margin:"14px 0 0"}}>
        البيانات من CoinGecko · تتجدد تلقائياً كل 30 ثانية 🟢
      </p>
    </div>
  );
}