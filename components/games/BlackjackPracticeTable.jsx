import TableFairnessPanel from './TableFairnessPanel';
import React,{useEffect,useState} from 'react';
import { Link } from 'react-router-dom';
import { useBlackjackPractice } from '@/hooks/useBlackjackPractice';
import { ShieldCheck, Crown, Users } from 'lucide-react';
import './game-cockpit.css';

const values=[1,5,10,25,100];
function Card({value,back=false}) {
  if(back||value==null)return <span className="ig-bj-card flex h-16 w-12 items-center justify-center rounded-lg border-2 border-pink-300 bg-gradient-to-br from-purple-950 to-blue-950 text-3xl text-amber-200 shadow-lg">✦</span>;
  const number=(value%13)+1;
  const rank={1:'A',11:'J',12:'Q',13:'K'}[number]||number;
  const suit=['♣','♦','♥','♠'][Math.floor(value/13)];
  const red=Math.floor(value/13)===1||Math.floor(value/13)===2;
  return <span className={'ig-bj-card flex h-16 w-12 flex-col items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-black shadow-lg '+(red?'text-red-600':'text-slate-950')}>
    <span>{rank}</span><span>{suit}</span>
  </span>;
}
const asChips=n=>Number(n||0).toLocaleString();
function WagerAmount({value,setValue,max=100,disabled=false}){
 const limit=Math.max(1,Math.floor(Number(max)||1));
 const set=n=>setValue(Math.max(1,Math.min(limit,Math.floor(Number(n)||1))));
 return <div className="ig-compact-wager" aria-label="Blackjack wager amount">
  <button type="button" disabled={disabled||value<=1} onClick={()=>set(Math.floor(value/2))} className="rounded-lg border border-white/30 bg-black/20 font-black disabled:opacity-40">÷2</button>
  <input aria-label="Blackjack wager amount" type="number" inputMode="numeric" min="1" max={limit} value={value} disabled={disabled} onChange={e=>set(e.target.value)} className="rounded-lg border border-amber-300/40 bg-[#0d0915] px-2 text-center font-black text-amber-100"/>
  <button type="button" disabled={disabled||value>=limit} onClick={()=>set(value*2)} className="rounded-lg border border-white/30 bg-black/20 font-black disabled:opacity-40">×2</button>
 </div>;
}

export default function BlackjackPracticeTable() {
 const {user,isAuthenticated,state,loading,busy,error,refresh,join,leave,claim,bet,action,pendingAction,retryPending}=useBlackjackPractice();
 const [chip,setChip]=useState(5);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),250);return ()=>clearInterval(id);},[]);
 const deadline=Date.parse(state?.bettingClosesAt||'');
 const seconds=Number.isFinite(deadline)?Math.ceil(Math.max(0,deadline-(now-(state?.clockOffsetMs||0)))/1000):0;
 const canBet=state?.phase==='betting'&&seconds>0;
 const turnDeadline=Date.parse(state?.turnDeadlineAt||'');
 const turnSeconds=Number.isFinite(turnDeadline)?Math.ceil(Math.max(0,turnDeadline-(now-(state?.clockOffsetMs||0)))/1000):0;
 const players=state?.players||[];
 const me=players.find(x=>x.id===user?.id);
 const controller=state?.controllerId===user?.id;
 const myTurn=state?.turnActor===user?.id&&state?.phase==='playing';
 const activeController=players.some(p=>p.id===state?.controllerId&&p.active);
 const gameInProgress=state?.phase==='playing'||state?.phase==='showdown';
 const dealerCards=state?.dealerCards||[];
 const last=state?.lastResult;
 return <main className="ig-game-screen ig-blackjack-screen min-h-screen bg-[#0a0612] px-3 py-8 text-white sm:px-6">
  <div className="ig-blackjack-shell mx-auto max-w-7xl space-y-5">
   {error&&!state&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
   <div className="ig-cockpit-topbar flex flex-wrap justify-between gap-2">
    <Link to="/Games" className="font-semibold text-amber-300 hover:underline">← Game lobby</Link>
    <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1 text-xs font-black uppercase tracking-wider text-amber-200">Seven-seat shared practice table</span>
   </div>
   <p className="ig-blackjack-notice flex items-start gap-3 rounded-xl border border-sky-400/30 bg-sky-950/50 p-4 text-sm text-sky-100">
    <ShieldCheck className="h-5 w-5 shrink-0 text-sky-300"/>
    <span>Six-deck Blackjack with server-owned cards and player turns. Practice chips have no monetary value, cannot be bought or withdrawn, and are isolated from cryptocurrency and financial wallets.</span>
   </p>
   {state&&<div role="status" className={'ig-blackjack-status flex items-center justify-between rounded-xl border p-4 '+(canBet?'border-green-400/40 bg-green-950/30':'border-amber-300/30 bg-amber-950/20')}>
    <span className="text-sm font-black uppercase tracking-wide">Round {state.round} · {state.phase==='betting'?canBet?'Betting open':'Betting closed':state.phase==='playing'?'Player turns':'Dealer showdown'}</span>
    <span className="font-mono text-2xl font-black text-amber-200">{state.phase==='betting'?canBet?seconds+'s':'LOCKED':state.phase==='playing'?turnSeconds+'s TO ACT':'SETTLE'}</span>
   </div>}
   <div className="ig-blackjack-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="ig-blackjack-main space-y-5">
     <div className="ig-blackjack-stage rounded-[2.7rem] border-[12px] border-[#684125] bg-[#0d6547] p-2 shadow-2xl sm:p-6">
      <div className="ig-blackjack-felt rounded-[2.3rem] border-2 border-amber-200/70 bg-[radial-gradient(circle_at_top,_#186e4a,_#07513b_62%,_#063d30)] p-3 sm:p-6">
       <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">Imperial Games · Table BJ1</p>
        <h1 className="ig-blackjack-title mt-1 text-3xl font-black italic sm:text-4xl">BLACKJACK PAYS 3 TO 2</h1>
        <p className="mt-2 text-xs font-bold uppercase text-amber-100">Dealer stands on all 17s · 6 decks</p>
        <div className="ig-blackjack-dealer mt-5 flex min-h-20 flex-wrap justify-center gap-2">
         {dealerCards.length?dealerCards.map((card,i)=><Card value={card} key={i}/>):<Card back/>}
         {state?.dealerHidden&&<Card back/>}
        </div>
        <p className="mt-2 text-xs text-gray-200">Dealer {state?.dealerHidden?'hole card hidden until showdown':'cards'}</p>
       </div>
       <div className="ig-blackjack-ruleline mx-auto my-5 max-w-3xl rounded-full border-2 border-dashed border-yellow-200/50 p-3 text-center text-xs text-amber-200">
        Insurance is not enabled. Only base hands and Perfect Pairs practice side bets settle on this table.
       </div>
       <div className="ig-blackjack-seats grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({length:7},(_,seatNo)=>{
         const p=players.find(x=>x.seat===seatNo);
         const isTurn=p&&state?.turnActor===p.id;
         return <div key={seatNo} className={'ig-blackjack-seat min-h-36 rounded-2xl border-2 p-3 '+(isTurn?'border-amber-300 bg-amber-100/15':'border-white/40 bg-black/15')}>
          <p className="text-sm font-black">Seat {seatNo+1} {p?.id===user?.id?'· YOU':''}</p>
          {p?<><p className="mt-1 text-xs text-white/80">{p.mainBet?'Main '+p.mainBet:'Watching'}</p>
           <p className="text-xs text-yellow-100">{p.pairsBet?'Pairs '+p.pairsBet:''}</p>
           <div className="mt-2 flex flex-wrap gap-1">{p.cards?.map((card,i)=><Card key={i} value={card}/>)}</div>
           {p.cards?.length>0&&<p className="mt-2 text-sm font-bold">Score {p.total} {p.stood?'· Stood':''}</p>}</>
           :<p className="mt-2 text-xs text-white/60">Open seat</p>}
         </div>;
        })}
       </div>
       <div className="ig-blackjack-bets mt-5 grid grid-cols-2 gap-3">
        <button disabled={!canBet||!me||busy||me.mainBet>0||me.chips<chip}
          onClick={()=>void bet('main',chip)}
          className="min-h-28 rounded-xl border-2 border-white/60 bg-amber-200/15 p-3 text-left disabled:opacity-45">
          <strong className="block text-lg">MAIN HAND</strong><span className="mt-2 block text-xs">Beat the dealer · natural 3:2</span>
          <span className="mt-2 block font-bold text-amber-200">Tap to place {chip} chips</span>
        </button>
        <button disabled={!canBet||!me||busy||!me.mainBet||!!me.pairsBet||me.chips<chip}
          onClick={()=>void bet('perfect_pairs',chip)}
          className="min-h-28 rounded-xl border-2 border-amber-300 bg-purple-900/40 p-3 text-left disabled:opacity-45">
          <strong className="block text-lg">PERFECT PAIRS</strong><span className="mt-2 block text-xs">Mixed 5:1 · Colored 12:1 · Perfect 25:1</span>
          <span className="mt-2 block font-bold text-amber-200">Optional {chip}-chip side bet</span>
        </button>
       </div>
       <p className="ig-blackjack-footnote mt-3 text-center text-xs text-amber-100/75">The dealer handles a single shared six-deck shoe. Every seated player with a main practice bet gets a hand; each player chooses Hit or Stand on their turn.</p>
      </div>
     </div>
     {state&&<div className="ig-blackjack-controls rounded-2xl border border-white/10 bg-[#1b1727] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
       <div><h2 className="font-black">Wager amount</h2>
        <div className="mt-2"><WagerAmount value={chip} setValue={setChip} max={me?.chips??state.chips} disabled={busy}/></div>
        <div className="mt-2 flex flex-wrap gap-2">{values.map(v=><button type="button" key={v} disabled={busy}
          aria-pressed={v===chip} onClick={()=>setChip(v)}
          className={'h-12 w-12 rounded-full border-4 font-black '+(v===chip?'border-amber-300 bg-purple-700':'border-white/30 bg-purple-950')}>{v}</button>)}</div>
        <p className="mt-3 text-sm text-gray-300">Your nonredeemable chips: <strong className="text-amber-200">{asChips(state.chips)}</strong></p>
       </div>
       <div className="flex flex-col gap-2">
        {!state.joined&&<button disabled={busy||user?.role==='tester'} onClick={()=>void join()} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-black disabled:opacity-50">Sit at Blackjack table</button>}
        {controller&&state.phase==='betting'&&<button disabled={busy||canBet||!players.some(x=>x.mainBet>0)}
          onClick={()=>void action('deal')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-black disabled:opacity-50">
          {canBet?'Waiting for bets…':'DEAL CARDS'}</button>}
        {myTurn&&<div className="flex gap-2">
          <button disabled={busy} onClick={()=>void action('hit')} className="rounded-lg bg-green-700 px-6 py-3 font-black">HIT</button>
          <button disabled={busy} onClick={()=>void action('stand')} className="rounded-lg bg-red-800 px-6 py-3 font-black">STAND</button>
         </div>}
        {controller&&state.phase==='showdown'&&<button disabled={busy} onClick={()=>void action('resolve')}
          className="rounded-lg bg-amber-300 px-5 py-3 font-black text-black">SETTLE ALL HANDS</button>}
        {state.joined&&!controller&&!activeController&&<button disabled={busy} onClick={()=>void claim()}
          className="rounded-lg border border-amber-300 px-5 py-2">Take idle dealer position</button>}
        {state.joined&&state.phase==='betting'&&<button disabled={busy||!!me?.mainBet||!!me?.pairsBet} onClick={()=>void leave()}
          className="rounded-lg border border-red-300/40 px-5 py-2 text-red-200 disabled:opacity-50">Leave · keep chips</button>}
        <button onClick={()=>void refresh()} className="rounded-lg border border-white/25 px-5 py-2">Refresh</button>
       </div>
      </div>
      {pendingAction&&<p role="status" className="mt-4 text-amber-200">A practice action needs confirmation. <button disabled={busy} onClick={()=>void retryPending()} className="underline">Retry original practice action</button></p>}
      {error&&<p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {!isAuthenticated&&<Link to="/login" className="mt-4 inline-block text-yellow-300 underline">Sign in to join</Link>}
     </div>}
     {loading&&!state&&<p role="status" className="rounded-lg bg-white/10 p-8 text-center">Connecting to Blackjack table…</p>}
    </div>
    <aside className="ig-blackjack-rail space-y-5">
     <TableFairnessPanel state={state} game="blackjack"/>
     <section className="rounded-xl border border-white/10 bg-[#1b1727] p-5">
      <h2 className="flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-amber-200"/>Seated players ({players.length}/7)</h2>
      {players.map(p=><div key={p.id} className="mt-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
       <span className="flex items-center gap-1">{p.id===state?.controllerId&&<Crown className="h-4 w-4 text-amber-300"/>}Seat {p.seat+1}</span>
       <span>{p.id===user?.id?'You':p.active?'Active':'Away'}</span>
      </div>)}
      {!players.length&&<p className="mt-2 text-sm text-gray-400">No players seated yet.</p>}
     </section>
     {last&&<section className="rounded-xl border border-white/10 bg-[#1b1727] p-5">
      <h2 className="text-lg font-black">Previous dealer showdown</h2>
      <p className="mt-2 text-sm">Dealer: {last.dealerTotal} · Round {last.round}</p>
      <div className="mt-2 flex gap-1">{last.dealerCards?.map((c,i)=><Card key={i} value={c}/>)}</div>
      {last.seats?.map((r,i)=><div key={i} className="mt-3 rounded-lg border-b border-white/10 pb-2 text-sm">
       <strong>Seat {r.seat+1}</strong> · {r.status}
       <p className="text-amber-200">{r.returned} main returned · {r.pairsReturned} pairs returned</p>
      </div>)}
     </section>}
     <section className="rounded-xl border border-white/10 bg-[#1b1727] p-5 text-sm text-gray-300">
      <h2 className="text-lg font-black text-white">Table rules</h2>
      <p className="mt-2">Blackjack 3:2; dealer stands on soft 17; no split, double-down or insurance in this verified practice version. Each player can Hit or Stand within 20 seconds; inactive turns automatically stand. The dealer settles all completed hands.</p>
      <p className="mt-3 text-xs text-amber-100/80">Server timing and shoe resolution are authoritative; no real-money settlement, financial wallet or custody integration.</p>
     </section>
    </aside>
   </div>
  </div>
 </main>;
}
