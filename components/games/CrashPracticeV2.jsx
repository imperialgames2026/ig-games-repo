import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabaseClient';

const options = [{ value: 'red', label: 'Red · 0–1.99× · 1.97×' },{value:'green',label:'Green · 2–9.99× · 2×'},{value:'yellow',label:'Yellow · 10×+ · 10×'}];
const curve = t => Math.min(12000,Math.round((Math.exp(Math.log(12001)*Math.min(40000,Math.max(0,t))/40000)-1)*100)/100);
const fmt = n => Number(n ?? 0).toLocaleString('en-US',{maximumFractionDigits:2});

export default function CrashPracticeV2({ initialMode = 'crash' }) {
  const [mode,setMode] = useState(initialMode);
  const [snap,setSnap] = useState(null);
  const [amount,setAmount] = useState(10);
  const [auto,setAuto] = useState(false);
  const [target,setTarget] = useState(2);
  const [color,setColor] = useState('red');
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('');
  const [verified,setVerified] = useState('');
  const [clock,setClock] = useState(Date.now());
  const offset=useRef(0), running=useRef(false), alive=useRef(true);
  const call=useCallback(async body=>{
    const db=requireSupabase();
    const { data,error }=await db.functions.invoke('ig-crash-v2',{body});
    if(error) {
      let explanation=error.message;
      if(error.context?.json) { const detail=await error.context.json().catch(()=>null); explanation=detail?.error||explanation; }
      throw new Error(explanation);
    }
    if(data?.error) throw new Error(data.error);
    if(data?.state) {
      if(data.state.practiceOnly!==true||data.state.realMoneyEnabled!==false)throw new Error('Unexpected game currency configuration');
      offset.current=new Date(data.state.serverTime).getTime()-Date.now();
      if(alive.current)setSnap(data.state);
    }
    return data;
  },[]);
  const reload=useCallback(async()=>{
    if(running.current)return;
    running.current=true;
    try{await call({action:'state'});}catch(error){if(alive.current)setStatus(error.message);}
    finally{running.current=false;}
  },[call]);
  useEffect(()=>{
    alive.current=true;void reload();
    const tick=window.setInterval(()=>setClock(Date.now()),65);
    const poll=window.setInterval(()=>void reload(),700);
    return()=>{alive.current=false;window.clearInterval(tick);window.clearInterval(poll);};
  },[reload]);
  const now=clock+offset.current;
  const ms=Math.max(0,(snap ? new Date(snap.bettingEndsAt).getTime():0)-now);
  const live=snap?.phase==='live';
  const displayX=!snap||snap.phase==='betting'?0:live?curve(now-new Date(snap.startedAt).getTime()):Number(snap.multiplier);
  const own=snap?.myBets?.filter(b=>b.round===snap.round)??[];
  const manual=own.find(b=>b.mode==='crash_manual'&&b.status==='active');
  const writable=snap?.joined===true;
  async function act(action){
    if(busy||!snap)return;
    setBusy(true);setStatus('');
    try{
      let body={action};
      if(action==='bet'){
        if(!Number.isSafeInteger(amount)||amount<1||amount>100)throw new Error('Choose 1 to 100 practice chips');
        const selected=mode==='crash'?(auto?'crash_auto':'crash_manual'):'tren_'+color;
        body={action,round:snap.round,requestId:crypto.randomUUID(),mode:selected,target:selected==='crash_auto'?target:null,units:amount};
      }
      if(action==='cashout'){
        if(!manual)throw new Error('No active manual Crash bet');
        body={action,round:snap.round,requestId:crypto.randomUUID(),betId:manual.id};
      }
      const data=await call(body);
      if(action==='bet')setStatus('Practice bet accepted');
      if(action==='cashout')setStatus('Cashed out at '+Number(data.action.cashoutX).toFixed(2)+'× · '+fmt(data.action.paidUnits)+' practice chips returned');
      if(action==='refill')setStatus('Practice chips refilled');
      await reload();
    }catch(error){setStatus(error.message);await reload();}
    finally{setBusy(false);}
  }
  async function verify(p){
    const code=`${p.serverSeed}:${Number(p.crashPoint).toFixed(2)}:${p.durationMs}`;
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)));
    const digest=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    setVerified(digest===p.commitment?`Round #${p.round} matches the original preflight commitment`:'Commitment mismatch — report to support');
  }
  const vertices=Array.from({length:61},(_,i)=>{
    const time=Math.max(0,now-(snap?new Date(snap.startedAt).getTime():0))*i/60;
    const y=208-(Math.log1p(curve(time))/Math.log(12001))*174;
    return (15+i*570/60).toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const ended=snap?.phase==='crashed';
  return <main className="min-h-screen bg-[#0a0612] text-white px-4 py-6">
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Link to="/Games" className="text-amber-300 hover:text-amber-200 font-semibold">← Game library</Link>
        <span className="text-xs tracking-wider text-amber-200 border border-amber-500/40 rounded-full px-4 py-2">FREE-PLAY STAGING · NO REAL WAGERS</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div><h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-amber-200 to-fuchsia-300 bg-clip-text text-transparent">Imperial Crash Arena</h1><p className="text-gray-400 mt-2">One server-synchronized flight, two games. Cash out before the crash.</p></div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10" role="group" aria-label="Choose game">
          {['crash','trenball'].map(key=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)} className={'px-5 py-3 rounded-lg font-bold '+(mode===key?'bg-amber-400 text-gray-950':'text-gray-300')}>{key==='crash'?'🚀 Crash':'🎯 Trenball'}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(275px,1fr)] gap-5">
        <div className="space-y-5 min-w-0">
          <div className="bg-gradient-to-b from-[#101b35] to-[#100f22] border border-amber-500/20 rounded-3xl p-5">
            <div className="flex flex-wrap justify-between items-center gap-3 text-xs tracking-wide text-gray-400">
              <span>ROUND #{snap?.round??'–'}</span>
              <span>{snap?.players??0} PLAYERS JOINED</span>
              <span className={live?'text-green-400':ended?'text-rose-400':'text-amber-300'}>{!snap?'Connecting…':snap.phase==='betting'?'PLACE BETS · '+(ms/1000).toFixed(1)+'s':live?'🚀 FLIGHT LIVE':'💥 CRASHED'}</span>
            </div>
            <div style={{fontVariantNumeric:'tabular-nums'}} className={'text-center font-black text-5xl sm:text-7xl pt-8 '+(ended?'text-red-400':'text-amber-200')}>{Number(displayX).toFixed(2)}×</div>
            <svg role="img" aria-label="Real-time multiplier trajectory" className="w-full" viewBox="0 0 600 220">
              <path d="M15 208H585M15 15V208" stroke="#455073" fill="none" strokeWidth="2"/>
              {live&&<polyline points={vertices} fill="none" stroke="#efbb57" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>}
              <text x="30" y="25" fill="#d3c4a2" fontSize="13">{snap?.phase==='betting'?'Flight launches after 6 second betting window':live?'Live server-timed multiplier':'Awaiting the next round'}</text>
            </svg>
            <p className="text-xs text-gray-500 break-all">Commitment before launch: {snap?.commitment??'Loading…'}</p>
          </div>
          <div className="border border-white/10 rounded-3xl p-5 bg-[#181527]">
            <div className="flex gap-3 items-center justify-between flex-wrap">
              <div><span className="block text-xs text-gray-400">Your nonredeemable practice chips</span><b className="text-2xl text-amber-200">{fmt(snap?.chips)}</b></div>
              <button disabled={busy||!snap} onClick={()=>void act(writable?'leave':'join')} className="bg-amber-300 text-gray-950 font-bold rounded-xl px-5 py-3 disabled:opacity-40">{writable?'Leave table':'Join practice table'}</button>
            </div>
            {writable&&<div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <label className="text-sm">Stake (1–100) <input type="number" min="1" max="100" step="1" value={amount} onChange={e=>setAmount(Number(e.target.value))} className="block mt-2 w-28 rounded-xl bg-gray-900 border border-gray-600 px-3 py-2"/></label>
                {mode==='crash'?<><label className="text-sm"><input className="mr-2" type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Auto cashout</label>{auto&&<label className="text-sm">Target <select className="block mt-2 p-2 bg-gray-900 border border-gray-600 rounded-xl" value={target} onChange={e=>setTarget(Number(e.target.value))}>{[1.5,2,3,5,10].map(v=><option key={v} value={v}>{v.toFixed(2)}×</option>)}</select></label>}</>:
                  <label className="text-sm">Trenball color <select value={color} onChange={e=>setColor(e.target.value)} className="block mt-2 max-w-full p-2 bg-gray-900 border border-gray-600 rounded-xl">{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>}
              </div>
              <div className="flex flex-wrap gap-3">
                <button disabled={busy||!snap||snap.phase!=='betting'||ms<=0||!Number.isSafeInteger(amount)||amount<1||amount>100||amount>snap.chips} onClick={()=>void act('bet')} className="rounded-xl bg-amber-400 text-gray-950 font-bold px-5 py-3 disabled:opacity-40">Place practice bet</button>
                {manual&&<button disabled={busy||!live||displayX<=0} onClick={()=>void act('cashout')} className="rounded-xl bg-emerald-500 text-white font-bold px-5 py-3 disabled:opacity-40">Cash out at live multiplier</button>}
                {snap.chips<10&&<button disabled={busy} onClick={()=>void act('refill')} className="rounded-xl bg-gray-700 px-4 py-3">Free practice refill</button>}
              </div>
            </div>}
            {status&&<p role="status" className="text-amber-200 text-sm mt-4">{status}</p>}
          </div>
        </div>
        <aside className="space-y-5 min-w-0">
          <div className="bg-[#17192b] border border-white/10 rounded-3xl p-5">
            <h2 className="text-lg font-bold mb-4">Your round bets</h2>
            {own.length===0?<p className="text-gray-500">No bets in this round.</p>:own.map(b=><div key={b.id} className="border-b border-white/10 py-2 text-sm"><strong>{b.mode.replace('_',' ')}</strong> · {b.units} chips<div className="text-gray-400 mt-1">{b.status.toUpperCase()}{b.cashoutX!=null?' · '+Number(b.cashoutX).toFixed(2)+'×':''}{b.status!=='active'?' · Return: '+fmt(b.paidUnits):''}</div></div>)}
          </div>
          <div className="bg-[#17192b] border border-white/10 rounded-3xl p-5">
            <h2 className="text-lg font-bold mb-4">Recent crash points</h2><div className="flex flex-wrap gap-2">{(snap?.history??[]).map(h=><span key={h.round} title={'Round '+h.round} className={'text-xs rounded-md px-2 py-2 '+(h.crashPoint<2?'bg-rose-900':'')+(h.crashPoint>=2&&h.crashPoint<10?' bg-emerald-900':'')+(h.crashPoint>=10?' bg-yellow-800':'')}>{Number(h.crashPoint).toFixed(2)}×</span>)}</div>
          </div>
          <div className="bg-[#17192b] border border-white/10 rounded-3xl p-5">
            <h2 className="text-lg font-bold mb-3">Fairness proof</h2>
            <p className="text-xs text-gray-400 mb-3">A SHA-256 commitment is published before every round. Verify the revealed seed and outcome afterward.</p>
            {snap?.lastResult&&<button onClick={()=>void verify(snap.lastResult)} className="border border-amber-400/60 text-amber-200 rounded-lg px-3 py-2 text-sm">Verify last round #{snap.lastResult.round}</button>}
            {verified&&<p role="status" className="text-sm mt-3 text-amber-200">{verified}</p>}
          </div>
        </aside>
      </div>
      <p className="text-xs mt-7 text-gray-500">Zero-value practice only. No IGN, IGD, wallet settlement, deposits, or withdrawals. Results, bets and manual cashouts are handled on the staging server. Maximum round multiplier 12,000×.</p>
    </div>
  </main>;
}
