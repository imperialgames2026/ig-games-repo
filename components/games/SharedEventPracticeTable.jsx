import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSharedEventPractice } from '@/hooks/useSharedEventPractice';
import { CircleDot, Crown, Users, ShieldCheck } from 'lucide-react';
import GameTableScene3D from '@/components/games/3d/GameTableScene3D';

const ALL_CRASH = [
  {id:'auto_150',label:'AUTO 1.50×',detail:'Classic cashout at 1.50×',payout:'1.5×'},
  {id:'auto_200',label:'AUTO 2.00×',detail:'Classic cashout at 2.00×',payout:'2×'},
  {id:'auto_300',label:'AUTO 3.00×',detail:'Classic cashout at 3.00×',payout:'3×'},
  {id:'auto_500',label:'AUTO 5.00×',detail:'Classic cashout at 5.00×',payout:'5×'},
  {id:'auto_1000',label:'AUTO 10.00×',detail:'Classic cashout at 10.00×',payout:'10×'},
];
const TRENBALL = [
  {id:'tren_red',label:'RED · BEAR',detail:'Crash below 2.00×',payout:'1.96×',tone:'bg-red-900/55'},
  {id:'tren_green',label:'GREEN · BULL',detail:'Crash at or above 2.00×',payout:'2×',tone:'bg-green-800/50'},
  {id:'tren_moon',label:'MOON',detail:'Crash at or above 10.00×',payout:'10×',tone:'bg-amber-700/40'},
];
const BACCARAT = [
  {id:'player',label:'PLAYER',detail:'Winning Player hand',payout:'2× returned',tone:'bg-blue-900/55'},
  {id:'tie',label:'TIE',detail:'Both hands equal',payout:'9× returned',tone:'bg-green-900/55'},
  {id:'banker',label:'BANKER',detail:'Winning Banker hand · 5% commission',payout:'1.95× returned',tone:'bg-red-900/55'},
];
const CHIP_VALUES=[1,5,10,25,100];
const asChips = n => Number(n||0).toLocaleString();
const formatCard = rank => {
  const n=Number(rank);
  return n===1?'A':n===11?'J':n===12?'Q':n===13?'K':String(n);
};

function TableOptions({options,totals,onBet,canBet,busy}) {
  return <div className={'grid gap-3 '+(options.length===3?'sm:grid-cols-3':'sm:grid-cols-2 lg:grid-cols-3')}>
    {options.map(opt=>{
      const summary=totals.find(x=>x.target===opt.id);
      return <button type="button" key={opt.id} disabled={!canBet||busy}
        aria-label={'Place practice bet on '+opt.label} onClick={()=>onBet(opt.id)}
        className={'relative min-h-32 rounded-xl border-2 border-amber-200/50 p-4 text-left text-white shadow-md transition focus-visible:ring-4 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 hover:border-amber-200 '+(opt.tone||'bg-black/25')}>
        {summary?.units>0 && <span className="absolute right-2 top-2 rounded-full border border-amber-200 bg-purple-800 px-3 py-1 text-xs font-bold text-white">{asChips(summary.units)} chips</span>}
        <strong className="block text-lg font-black">{opt.label}</strong>
        <span className="mt-2 block text-sm text-white/80">{opt.detail}</span>
        <span className="mt-2 block text-sm font-black text-yellow-200">{opt.payout}</span>
      </button>;
    })}
  </div>;
}

function Results({game,last}) {
  if(!last)return <p className="text-sm text-white/60">Waiting for the first shared round.</p>;
  if(game==='crash')return <div className="space-y-2 text-center">
    <p className="text-xs uppercase tracking-widest text-yellow-200">Last shared Crash / Trenball result</p>
    <p className={'text-5xl font-black tabular-nums '+(last.crashX100<200?'text-red-300':'text-emerald-300')}>
      {Number(last.multiplier).toFixed(2)}×
    </p>
    <p className="text-sm text-gray-200">Round {last.round} · {last.crashX100>=1000?'MOON + GREEN':last.crashX100>=200?'GREEN':'RED'}</p>
  </div>;
  const hand=(cards,label,total)=> <div className="min-w-0 flex-1 text-center">
    <p className="mb-2 text-sm font-bold text-yellow-100">{label} · {total}</p>
    <div className="flex flex-wrap justify-center gap-1.5">{cards?.map((card,i)=><span key={i}
      className="flex h-14 w-11 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-lg font-black text-black shadow-lg">
      {formatCard(card)}
    </span>)}</div>
  </div>;
  return <div className="space-y-4 text-center">
    <p className="text-xs uppercase tracking-widest text-yellow-200">Shared Baccarat · round {last.round}</p>
    <div className="flex items-start gap-3">{hand(last.playerCards,'PLAYER',last.playerTotal)}
      <span className="pt-10 text-xl font-black text-yellow-200">VS</span>
      {hand(last.bankerCards,'BANKER',last.bankerTotal)}</div>
    <p className="text-xl font-black text-yellow-200">{last.winner?.toUpperCase()} {last.winner==='tie'?'PUSHES PLAYER / BANKER':'WINS'}</p>
  </div>;
}

export default function SharedEventPracticeTable({mode='crash'}) {
  const game=mode==='baccarat'?'baccarat':'crash';
  const {table,user,loading,busy,error,isAuthenticated,refresh,join,leave,claim,bet,resolve}=useSharedEventPractice(game);
  const [stake,setStake]=useState(5);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),250);
    return ()=>clearInterval(timer);
  },[]);
  const end=Date.parse(table?.bettingClosesAt||'');
  const remaining=Number.isFinite(end)?Math.max(0,end-(now-(table?.clockOffsetMs||0))):0;
  const seconds=Math.ceil(remaining/1000);
  const isOpen=!!table?.betsOpen && seconds>0;
  const joined=!!table?.joined;
  const canBet=joined && isOpen && table.chips>=stake && user?.role!=='tester' && !user?.is_excluded;
  const isController=joined && table?.shooterId===user?.id;
  const otherControllerActive=table?.players?.some(p=>p.shooter && p.active);
  const options=mode==='baccarat'?BACCARAT:mode==='trenball'?TRENBALL:ALL_CRASH;
  const title=mode==='trenball'?'TREN BALL':mode==='baccarat'?'BACCARAT':'CRASH';
  const playerBets=table?.myBets||[];
  return <main className="min-h-screen bg-[#0b0714] px-3 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/Games" className="text-sm font-semibold text-yellow-200 hover:underline">← Game lobby</Link>
        <span className="rounded-full border border-yellow-300/35 bg-yellow-300/10 px-4 py-1 text-xs font-black uppercase text-yellow-200">Shared multiplayer · Staging only</span>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-sky-300/25 bg-sky-950/60 p-4 text-sm text-sky-100">
        <ShieldCheck className="h-5 w-5 shrink-0 text-sky-300"/>
        <p>Practice chips only · No deposits, purchases, crypto, cashouts, transfers, or redeemable rewards. The server decides and settles every shared round.</p>
      </div>
      {game==='baccarat'&&<GameTableScene3D game="baccarat" outcome={table?.lastResult} seats={table?.players||[]} chipCount={table?.chips||0} label="3D baccarat table with card and chip presentation" />}
      {game==='crash' && <div className="flex flex-wrap gap-2">
        <Link className={'rounded-lg px-5 py-2 font-black '+(mode==='crash'?'bg-yellow-300 text-black':'border border-white/30')} to="/PlayCrash">Classic Crash · automatic cashout</Link>
        <Link className={'rounded-lg px-5 py-2 font-black '+(mode==='trenball'?'bg-yellow-300 text-black':'border border-white/30')} to="/PlayTrenball">Trenball · Red / Green / Moon</Link>
        <p className="self-center text-xs text-white/60">Both tabs share one multiplier and betting window.</p>
      </div>}
      {table && <div role="status" className={'flex items-center justify-between gap-3 rounded-xl border p-4 '+(isOpen?'border-green-400/40 bg-green-950/30':'border-yellow-300/40 bg-yellow-950/20')}>
        <span className="text-sm font-bold">{isOpen?'BETTING OPEN · ROUND '+table.round:'NO MORE BETS · READY TO RESOLVE'}</span>
        <strong className="font-mono text-2xl text-yellow-200">{isOpen?seconds+'s':'LOCKED'}</strong>
      </div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="rounded-[2.5rem] border-[12px] border-[#644222] bg-[#0e5b44] p-3 shadow-2xl sm:p-7">
            <div className="rounded-3xl border-2 border-yellow-200/65 bg-[radial-gradient(ellipse_at_top,_#116d53,_#064231)] p-4 sm:p-7">
              <p className="text-xs font-bold tracking-[0.22em] text-yellow-200">IMPERIAL GAMES · SHARED TABLE</p>
              <h1 className="mt-2 text-4xl font-black italic tracking-wider">{title}</h1>
              <div className="my-5 rounded-2xl border border-white/30 bg-black/20 px-4 py-7">
                <Results game={game} last={table?.lastResult}/>
              </div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-yellow-200">Place your chips on a betting area</h2>
              <TableOptions options={options} totals={table?.publicBets||[]} onBet={target=>void bet(target,stake)} canBet={canBet} busy={busy}/>
              {game==='crash' && <p className="mt-3 text-center text-xs text-white/70">Classic Crash offers server-side preset automatic cashouts; manual real-time cashout is not enabled in this practice build. Trenball pays Red 1.96×, Green 2×, Moon 10×.</p>}
              {game==='baccarat' && <p className="mt-3 text-center text-xs text-white/70">8-deck baccarat; Banker commission 5%, Tie pays 8:1 profit; Player/Banker push on a tie. Server deals the third card by baccarat drawing rules.</p>}
            </div>
          </div>
          {table && <div className="rounded-2xl border border-white/10 bg-[#1b1727] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-black">Practice chip selection</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CHIP_VALUES.map(v=><button key={v} type="button" disabled={busy} aria-pressed={v===stake}
                    onClick={()=>setStake(v)}
                    className={'h-12 w-12 rounded-full border-4 font-black '+(v===stake?'border-yellow-200 bg-purple-700 text-white':'border-white/40 bg-purple-950 text-yellow-100')}>{v}</button>)}
                </div>
                <p className="mt-3 text-sm text-gray-300">Your available nonredeemable chips: <strong className="text-yellow-200">{asChips(table.chips)}</strong></p>
              </div>
              <div className="flex flex-col gap-2">
                {!joined && <button type="button" disabled={busy||user?.role==='tester'||user?.is_excluded}
                  onClick={()=>void join()} className="rounded-lg bg-yellow-300 px-5 py-3 font-black text-black disabled:opacity-50">Join table</button>}
                {isController && <button type="button" disabled={busy||isOpen}
                  onClick={()=>void resolve()} className="rounded-lg bg-yellow-300 px-5 py-3 font-black text-black disabled:opacity-50">
                  {busy?'Processing…':isOpen?'Waiting for side bets…':game==='crash'?'REVEAL SHARED CRASH':'DEAL BACCARAT'}
                </button>}
                {joined&&!isController&&!otherControllerActive && <button type="button" disabled={busy}
                  onClick={()=>void claim()} className="rounded-lg border border-yellow-300 px-5 py-2 font-bold">Take idle dealer seat</button>}
                {joined&&!isController&&otherControllerActive && <p className="text-sm text-gray-300">Watch the communal result while the current dealer reveals it.</p>}
                {joined&&<button type="button" disabled={busy} onClick={()=>void leave()}
                  className="rounded-lg border border-red-300/50 px-5 py-2 font-bold text-red-200">Leave · preserve chips</button>}
                <button type="button" onClick={()=>void refresh()} className="rounded-lg border border-white/25 px-5 py-2 text-sm">Refresh</button>
              </div>
            </div>
            {error&&<p role="alert" className="mt-3 rounded-lg bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
            {!isAuthenticated&&<Link className="mt-3 block text-yellow-300 underline" to="/login">Sign in to participate</Link>}
          </div>}
          {loading&&!table&&<p role="status" className="rounded-lg bg-white/10 p-8 text-center">Connecting to the shared practice table…</p>}
        </div>
        <aside className="space-y-5">
          <section className="rounded-xl border border-white/10 bg-[#1b1727] p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-yellow-300"/>Seated players ({table?.players?.length||0}/24)</h2>
            {(table?.players||[]).map(p=><div key={p.id} className="mt-2 flex justify-between rounded-lg bg-white/5 p-2 text-sm">
              <span className="flex gap-2">{p.shooter&&<Crown className="h-4 w-4 text-yellow-200"/>}{p.seat}</span>
              <span className={p.active?'text-green-300':'text-gray-400'}>{p.active?'At table':'Away'}</span>
            </div>)}
            {!table?.players?.length&&<p className="mt-3 text-sm text-gray-400">Join to take the first seat.</p>}
          </section>
          <section className="rounded-xl border border-white/10 bg-[#1b1727] p-5">
            <h2 className="text-lg font-black">Your active practice bets</h2>
            {playerBets.map(b=><div key={b.id} className="mt-2 flex justify-between gap-3 text-sm">
              <span>{b.target.replaceAll('_',' ')}</span><strong className="text-yellow-200">{b.units} chips</strong>
            </div>)}
            {!playerBets.length&&<p className="mt-2 text-sm text-gray-400">Nothing pending.</p>}
            <h3 className="mt-4 border-t border-white/10 pt-3 font-bold">Recent settlements</h3>
            {(table?.myRecent||[]).map((b,i)=><div key={i} className="mt-2 flex justify-between gap-3 text-xs">
              <span>{b.target.replaceAll('_',' ')} · {b.units}</span>
              <span className={b.outcome==='win'?'text-green-300':'text-gray-400'}>{b.outcome} · {b.paid} back</span>
            </div>)}
          </section>
        </aside>
      </div>
    </div>
  </main>;
}
