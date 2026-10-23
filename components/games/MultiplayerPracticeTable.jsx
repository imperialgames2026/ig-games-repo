import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Dices, RotateCw, Users, ShieldCheck } from 'lucide-react';
import { useMultiplayerPractice } from '@/hooks/useMultiplayerPractice';
import './craps-casino.css';
import {validCrapsDropTarget,canDropCrapsChip} from '@/lib/crapsChipDragRules';
import GameTableScene3D from '@/components/games/3d/GameTableScene3D';


const CHIP_VALUES = [1, 5, 10, 25, 100];
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CRAPS_POINTS = [4,5,6,8,9,10];
const CRAPS_BETS = [
  { target: 'pass', label: 'PASS LINE', detail: 'Come-out 7 / 11; point before seven', payout: '1:1' },
  { target: 'dont_pass', label: "DON'T PASS BAR", detail: '2 / 3 wins; 12 pushes; seven out', payout: '1:1' },
  { target: 'field', label: 'FIELD', detail: '2 · 3 · 4 · 9 · 10 · 11 · 12', payout: '1:1 · 2 & 12 pay 2:1' },
  { target: 'any_seven', label: 'ANY SEVEN', detail: 'One-roll proposition', payout: '4:1' },
];
const chip = (v) => Number(v ?? 0).toLocaleString();
// Pointer Events work with a mouse, pen and touch. Only a successful server action
// can remove practice chips or create a bet; the dragged token itself has no value.
function useCrapsChipDrag({enabled,blocked,available,point,onDrop}) {
  const gesture=useRef(null);
  const inFlight=useRef(false);
  const [drag,setDrag]=useState(null);
  const [hovered,setHovered]=useState(null);
  const [notice,setNotice]=useState('');
  const pickTarget=(x,y)=>{
    const element=document.elementFromPoint(x,y)?.closest('[data-craps-bet-target]');
    if(!element || element.disabled) return null;
    const target=element.getAttribute('data-craps-bet-target');
    if(!validCrapsDropTarget(target,point))return null;
    return target;
  };
  const clear=()=>{
    gesture.current=null;
    setDrag(null);
    setHovered(null);
  };
  const begin=(event,amount)=>{
    if(event.button!==0 || inFlight.current || !Number.isInteger(amount) || !enabled || blocked || amount>available)return;
    gesture.current={pointerId:event.pointerId,amount,startX:event.clientX,startY:event.clientY,moved:false};
    setNotice('');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move=event=>{
    const g=gesture.current;
    if(!g||event.pointerId!==g.pointerId)return;
    const distance=Math.hypot(event.clientX-g.startX,event.clientY-g.startY);
    if(distance<8 && !g.moved)return; // A tap selects a denomination without placing a bet.
    g.moved=true;
    setDrag({amount:g.amount,x:event.clientX,y:event.clientY});
    setHovered(pickTarget(event.clientX,event.clientY));
  };
  const end=event=>{
    const g=gesture.current;
    if(!g||event.pointerId!==g.pointerId)return;
    const target=g.moved?pickTarget(event.clientX,event.clientY):null;
    clear();
    if(!g.moved)return;
    if(!target){setNotice('Chip not placed. Drop it onto an available betting area.');return;}
    if(inFlight.current||!canDropCrapsChip({enabled,blocked,amount:g.amount,available,target,point})){
      setNotice('Betting is closed or there are not enough practice chips.');return;
    }
    inFlight.current=true;
    setNotice('Placing '+g.amount+' practice chips on '+labelForBet(target)+'…');
    void Promise.resolve(onDrop(target,g.amount)).then(ok=>{
      setNotice(ok?'Placed '+g.amount+' practice chips on '+labelForBet(target)+'.':
        'Bet not placed. Check the table message and try again.');
    }).catch(()=>{
      setNotice('Bet could not be placed. Refresh the table before retrying.');
    }).finally(()=>{inFlight.current=false;});
  };
  const cancel=event=>{
    if(gesture.current?.pointerId===event.pointerId)clear();
  };
  const handlers=amount=>({
    onPointerDown:event=>begin(event,amount),
    onPointerMove:move,
    onPointerUp:end,
    onPointerCancel:cancel,
    onLostPointerCapture:cancel,
    style:{touchAction:'none'},
  });
  return {handlers,drag,hovered,notice,inFlight};
}


function PracticeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-400/25 bg-sky-950/50 px-4 py-3 text-sm text-sky-100">
      <ShieldCheck className="h-5 w-5 shrink-0 text-sky-300" />
      <p><strong>Shared practice table only.</strong> All chips are imaginary, nontransferable and nonredeemable. No deposits, withdrawals, cash prizes or real wagers are connected to this room. Outcomes and chip accounting are server-controlled.</p>
    </div>
  );
}

function BetZone({ title, subtitle, target, payout, total, count, disabled, onBet, highlighted = false, className = '', dropTarget = false, hovered = false, mine = 0 }) {
  return (
    <button type="button" aria-label={'Place practice chips on ' + title}
      data-craps-bet-target={dropTarget ? target : undefined}
      disabled={disabled} onClick={() => onBet(target)}
      className={'relative min-w-0 rounded-xl border-2 p-3 text-center transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-300 ' +
        (hovered ? 'border-yellow-100 bg-amber-300/35 ring-4 ring-amber-300/60' : highlighted ? 'border-amber-300 bg-amber-300/20' : 'border-white/65 bg-black/10 hover:bg-white/15') +
        (disabled ? ' cursor-not-allowed opacity-65' : ' cursor-pointer') + ' ' + className}>
      <div className="text-base font-black tracking-wide sm:text-lg">{title}</div>
      {subtitle && <div className="mt-1 text-[11px] text-white/80">{subtitle}</div>}
      {payout && <div className="mt-1 text-[10px] font-bold text-yellow-200">{payout}</div>}
      {total > 0 && <div className="absolute -right-2 -top-2 flex min-w-9 items-center justify-center rounded-full border-2 border-amber-200 bg-purple-900 px-1.5 py-1 text-xs font-black shadow-lg" title={count + ' players/bets'}>
        {chip(total)}
      </div>}
      {mine > 0 && <div className="ig-craps-placed-chip absolute -bottom-2 -left-1 z-10 flex min-w-8 items-center justify-center rounded-full border-[3px] border-[#f2e1a7] bg-[#64338a] p-1 text-[10px] font-black text-white shadow-xl" title={'Your active practice bet: '+chip(mine)+' chips'}>{chip(mine)}</div>}
    </button>
  );
}

const DICE_GLYPHS=['⚀','⚁','⚂','⚃','⚄','⚅'];
const labelForBet=(target)=>CRAPS_BETS.find(x=>x.target===target)?.label||
  (target?.startsWith('place_')?'PLACE '+target.slice(6):target?.replaceAll('_',' ').toUpperCase())||'Choose a wager';
function CrapsFelt({table,choose,selected,disabled,canBet,canShoot,isShooter,onShoot,hovered}){
 const start=useRef(null);
 const [reveal,setReveal]=useState(true);
 const roll=table.lastResult?.game==='craps'?table.lastResult:null;
 useEffect(()=>{
   if(!roll||!Number.isInteger(roll.round))return;
   setReveal(false);
   const timer=window.setTimeout(()=>setReveal(true),1170);
   return ()=>window.clearTimeout(timer);
 },[roll?.round]);
 const totals=new Map((table.publicBets||[]).map(b=>[b.target,b]));
 const stats=t=>totals.get(t)||{units:0,count:0};
 const mine=target=>(table.myBets||[]).filter(b=>b.target===target).reduce((sum,b)=>sum+Number(b.units||0),0);
 const status=table.point===null||table.point===undefined?'COME OUT':'POINT '+table.point+' ON';
 return <div className="overflow-x-auto pb-4" aria-label="Casino craps practice table">
   <div className="ig-craps-rail min-w-[890px] rounded-[76px] p-[11px] sm:p-[18px]">
    <div className="ig-craps-table relative min-h-[410px] overflow-hidden rounded-[62px] border-[3px] border-[#d2bb80] px-9 py-5 text-white">
     <div className="flex items-center justify-between gap-6 border-b border-[#f4e3b2]/35 pb-3">
      <div><div className="text-[10px] font-black uppercase tracking-[.3em] text-[#f6dfa7]">Imperial Games · Casino felt</div>
      <div className="mt-1 font-serif text-3xl font-black italic tracking-[.12em]">CRAPS</div></div>
      <div className="rounded-2xl border-2 border-amber-200/70 bg-black/35 px-6 py-2 text-center">
       <div className="text-[10px] font-bold tracking-[.15em] text-[#fce3a9]">PUCK • ESTABLISHED POINT</div>
       <div className="text-2xl font-black">{status}</div>
      </div>
      <div className="text-right text-xs text-white/80"><div className="font-bold">ROUND {table.round}</div><div>24-player shared room</div></div>
     </div>
     <div className="mt-4 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-6 gap-1.5">
       {CRAPS_POINTS.map(num=>{
         const target = 'place_' + num;
         const b = stats(target);
         const odds=num===4||num===10?'9:5':num===5||num===9?'7:5':'7:6';
         return <BetZone key={target} target={target} title={String(num)} subtitle="PLACE BET"
           payout={odds} total={b.units} count={b.count} onBet={choose} dropTarget
           mine={mine(target)} hovered={hovered===target}
           disabled={!canBet||disabled} highlighted={table.point===num||selected===target}
           className={'ig-craps-target min-h-[102px] !rounded-md !px-1 '+(selected===target?'!border-amber-300 !bg-amber-300/30':'')}/>;
       })}
       <div className="col-span-6 mt-1 grid grid-cols-2 gap-2">
        {CRAPS_BETS.slice(0,2).map(b=><BetZone key={b.target} target={b.target} title={b.label} subtitle={b.detail}
          payout={b.payout} total={stats(b.target).units} count={stats(b.target).count} dropTarget
          mine={mine(b.target)} hovered={hovered===b.target}
          disabled={!canBet||disabled||!!table.point} highlighted={selected===b.target}
          onBet={choose} className="ig-craps-target min-h-[84px] !rounded-md"/>)}
       </div>
      </div>
      <div className="flex flex-col gap-3">
       <div className="grid grid-cols-2 gap-2">
        {CRAPS_BETS.slice(2).map(b=><BetZone key={b.target} target={b.target} title={b.label}
          subtitle={b.detail} payout={b.payout}
          total={stats(b.target).units} count={stats(b.target).count} dropTarget
          mine={mine(b.target)} hovered={hovered===b.target}
          disabled={!canBet||disabled} highlighted={selected===b.target}
          onBet={choose} className="ig-craps-target min-h-[90px] !rounded-md !px-2"/>)}
       </div>
       <div className={'relative flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/30 bg-[#00291f]/60 p-2 '+(isShooter&&canShoot?'cursor-grab active:cursor-grabbing':'')}
        style={{touchAction:isShooter&&canShoot?'none':'auto'}}
        onPointerDown={e=>{if(isShooter&&canShoot)start.current={x:e.clientX,y:e.clientY}}}
        onPointerUp={e=>{if(!isShooter||!canShoot||!start.current)return;
           const dist=Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y);
           start.current=null;if(dist>=45)onShoot();
         }}
        onPointerCancel={()=>{start.current=null}}>
        <div className="text-xs font-bold tracking-[.1em] text-[#f5e5b5]">THE DICE PIT</div>
        <div className="mt-2 flex min-h-[86px] items-center justify-center gap-6">
         {[0,1].map(i=><div key={(roll?.round||'opening')+'-'+i}
           className={'ig-craps-die '+(!reveal?'ig-craps-die--flight-'+(i===0?'a':'b'):'')}>
           {DICE_GLYPHS[(roll?.dice?.[i]||1)-1]||'⚀'}
         </div>)}
        </div>
        <div className="mt-3 text-xs font-semibold text-white/80">{roll?'LAST THROW: '+roll.dice.join(' + ')+' = '+roll.total:'Awaiting first throw'}</div>
        <div className="mt-1 text-[11px] text-[#ead09b]">{isShooter?'Drag across the pit or press Shoot':'Watching the current shooter'}</div>
       </div>
      </div>
     </div>
     <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2 text-[11px] text-white/75">
       <div>{roll&&table.point&&roll.total!==table.point?'Last roll '+roll.total+' did not clear the point '+table.point+'.':'A point remains ON until repeated or a seven-out.'}</div>
       <div>CHIPS ARE FOR PRACTICE ONLY</div>
     </div>
    </div>
   </div>
   <p className="mt-2 text-xs text-[#b6c9c0]">Slide sideways on smaller screens to see the complete, full-length casino felt. Pick a betting zone and confirm it on your betting card.</p>
 </div>;
}
function CrapsChipRack({table,stake,setStake,dragHandlers,busy,joined}) {
 return <div className="rounded-2xl border border-[#987344]/70 bg-[linear-gradient(120deg,#271c16,#171b24)] px-4 py-3 text-white">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><div className="text-[10px] font-black uppercase tracking-[.17em] text-[#e9c88a]">Pick up a chip</div>
      <p className="mt-1 text-xs text-white/70">Drag onto a green felt betting area • tap to choose</p></div>
    <div className="flex flex-wrap items-center gap-2">
     {CHIP_VALUES.map(value=><button type="button" key={value} {...dragHandlers(value)}
       aria-pressed={stake===value} aria-label={'Drag '+value+' practice chip to betting area'}
       onClick={()=>setStake(value)} disabled={busy||!joined||value>table.chips}
       className={'ig-craps-rack-chip flex h-12 w-12 items-center justify-center rounded-full border-[3px] text-xs font-black shadow-lg disabled:opacity-35 '+
         (stake===value?'border-amber-200 bg-[#c5a268] text-black ring-2 ring-amber-300/60':'border-[#d2bcd9] bg-[#573774] text-white')}>{value}</button>)}
    </div>
   </div>
 </div>;
}

function CrapsBettingCard({table,stake,setStake,selected,setSelected,canBet,busy,placeBet,joined,refill,dragHandlers}){
 const [placing,setPlacing]=useState(false);
 const confirm=async()=>{
  if(!selected||!canBet||placing||busy)return;
  setPlacing(true);
  try{if(await placeBet(selected,stake))setSelected(null)}
  finally{setPlacing(false)}
 };
 return <section className="rounded-2xl border border-[#b28c4d]/60 bg-[linear-gradient(150deg,#24211d,#141a20)] p-5 shadow-xl">
   <div className="mb-1 text-[10px] font-black tracking-[.2em] text-[#e1b972]">PLAYER BETTING CARD</div>
   <h2 className="font-serif text-xl font-bold text-white">Get in on the action</h2>
   <p className="mt-1 text-xs text-white/60">Drag a chip from the rack onto a bet to place it, or tap a zone and confirm. No real money.</p>
   <div className="mt-4 rounded-xl border border-white/15 bg-black/25 p-3">
     <div className="text-[11px] uppercase tracking-wider text-[#dfcba5]">Selected wager</div>
     <div className="mt-1 text-lg font-black text-white">{selected?labelForBet(selected):'Select a table zone'}</div>
     <div className="mt-1 text-xs text-white/55">Open bets: {chip((table.myBets||[]).reduce((a,b)=>a+Number(b.units||0),0))} practice chips</div>
   </div>
   <div className="mt-4 text-[11px] font-bold text-[#ddc9a8]">CHIP DENOMINATION</div>
   <div className="mt-2 flex flex-wrap gap-2">
    {CHIP_VALUES.map(value=><button key={value} type="button" disabled={busy||placing||value>table.chips}
      aria-label={'Drag '+value+' practice chip onto craps table or tap to select'}
      {...dragHandlers(value)} aria-pressed={stake===value} onClick={()=>setStake(value)}
      className={'ig-craps-rack-chip h-11 w-11 rounded-full border-[3px] text-xs font-black shadow-lg transition '+(stake===value
        ?'scale-110 border-amber-200 bg-[#c39a52] text-black ring-2 ring-amber-300/50'
        :'border-[#c3b9d3] bg-[#483465] text-white hover:border-amber-200')}>{value}</button>)}
   </div>
   <div className="mt-4 flex items-center justify-between text-sm"><span className="text-white/75">Available practice chips</span><strong className="text-amber-200">{chip(table.chips)}</strong></div>
   <button onClick={()=>void confirm()} disabled={!selected||!canBet||busy||placing||!joined}
      className="mt-4 w-full rounded-xl bg-[#e5b86d] px-4 py-3 font-black text-[#1e170e] disabled:cursor-not-allowed disabled:opacity-40">
      {placing?'Placing practice chips…':selected?'Place '+stake+' chips on '+labelForBet(selected):'Choose a bet on the felt'}
   </button>
   {selected&&<button type="button" className="mt-2 w-full py-2 text-xs text-white/70 underline" onClick={()=>setSelected(null)}>Clear selected wager</button>}
   {joined&&table.chips<=100&&<button type="button" onClick={()=>void refill()} disabled={busy||placing}
      className="mt-3 w-full rounded-xl border border-amber-400/50 px-4 py-3 text-xs font-bold text-amber-200 disabled:opacity-50">
      Request +500 free practice chips (max once per 24h)
   </button>}
   <p className="mt-3 text-[11px] leading-5 text-white/55">Refills are server-limited, nonredeemable, and never touch your crypto or token wallets.</p>
 </section>;
}

function rouletteColor(n) {
  return n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
}

function RouletteFelt({ table, choose, disabled, canBet }) {
  const publicTotals = new Map((table.publicBets ?? []).map(b => [b.target, b]));
  const stats = target => publicTotals.get(target) || { units: 0, count: 0 };
  const last = table.lastResult?.game === 'roulette' ? table.lastResult : null;
  const tile = (target, title, extraClass = '', label = '') => {
    const data = stats(target);
    return <BetZone key={target} target={target} title={title} subtitle={label}
      onBet={choose} disabled={!canBet || disabled} total={data.units} count={data.count}
      className={extraClass} />;
  };
  return (
    <div className="rounded-[2.5rem] border-[10px] border-[#654023] bg-[#073f34] p-2 shadow-[0_16px_55px_rgba(0,0,0,0.6)] sm:border-[15px]">
      <div className="overflow-hidden rounded-[2rem] border-2 border-yellow-200/60 bg-[radial-gradient(ellipse_at_top,_#146d51,_#07533f_60%,_#043c31)] p-3 text-white sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.23em] text-yellow-200">Imperial Casino · Table R1</p>
            <h2 className="text-2xl font-black italic sm:text-3xl">EUROPEAN ROULETTE</h2>
            <p className="text-xs text-white/70">Single zero · 37 pockets · no double zero</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[8px] border-[#674224] bg-[conic-gradient(#b91c1c_0deg_20deg,#141414_20deg_40deg,#b91c1c_40deg_60deg,#141414_60deg_80deg,#b91c1c_80deg_100deg,#141414_100deg_120deg,#b91c1c_120deg_140deg,#141414_140deg_160deg,#b91c1c_160deg_180deg,#141414_180deg_200deg,#b91c1c_200deg_220deg,#141414_220deg_240deg,#b91c1c_240deg_260deg,#141414_260deg_280deg,#b91c1c_280deg_300deg,#141414_300deg_320deg,#b91c1c_320deg_340deg,#15803d_340deg_360deg)] shadow-xl">
              <span className={'flex h-14 w-14 items-center justify-center rounded-full border-4 border-amber-300 text-2xl font-black ' +
                (last?.color === 'red' ? 'bg-red-800' : last?.color === 'black' ? 'bg-black' : 'bg-emerald-800')}>
                {last?.number ?? '—'}
              </span>
            </div>
            <div className="text-right"><p className="text-xs text-yellow-200">LAST SPIN</p><p className="text-xl font-black">{last ? last.number + ' ' + last.color.toUpperCase() : 'Waiting'}</p><p className="text-xs text-white/60">Round {table.round}</p></div>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[740px]">
            <div className="grid grid-cols-[60px_minmax(0,1fr)_80px] gap-2">
              <div className="flex flex-col">{tile('number_0', '0', '!h-full !bg-emerald-700')}</div>
              <div className="grid grid-cols-12 gap-1">
                {[2,1,0].flatMap(row => Array.from({length:12}, (_,column) => {
                  const num=3*column+row+1;
                  return tile('number_'+num, String(num),
                    rouletteColor(num)==='red' ? '!rounded-sm !bg-red-900/75 !px-0' : '!rounded-sm !bg-black/75 !px-0');
                }))}
              </div>
              <div className="grid grid-rows-3 gap-1">
                {tile('column_3','2:1','!rounded-sm')}
                {tile('column_2','2:1','!rounded-sm')}
                {tile('column_1','2:1','!rounded-sm')}
              </div>
            </div>
            <div className="ml-[68px] mr-[88px] mt-2 grid grid-cols-3 gap-1.5">
              {tile('dozen_1', '1ST 12', '!rounded-sm','2:1')}
              {tile('dozen_2', '2ND 12', '!rounded-sm','2:1')}
              {tile('dozen_3', '3RD 12', '!rounded-sm','2:1')}
            </div>
            <div className="ml-[68px] mr-[88px] mt-2 grid grid-cols-6 gap-1.5">
              {tile('low', '1–18', '!rounded-sm')}
              {tile('even', 'EVEN', '!rounded-sm')}
              {tile('red', 'RED', '!rounded-sm !bg-red-900/70')}
              {tile('black', 'BLACK', '!rounded-sm !bg-black/80')}
              {tile('odd', 'ODD', '!rounded-sm')}
              {tile('high', '19–36', '!rounded-sm')}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/70">Inside bets (numbers) pay 35:1. Dozens / columns pay 2:1. Outside bets pay 1:1. Zero loses all outside bets.</p>
      </div>
    </div>
  );
}

function PlayersPanel({ table }) {
  const players=table.players ?? [];
  const shooter=players.find(p => p.shooter);
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Users className="h-5 w-5 text-amber-300" /> Players at table ({players.length}/24)</h2>
      <p className="mb-3 text-sm text-white/70">{shooter ? (table.game==='craps' ? 'Current shooter: ' : 'Current spinner: ') + shooter.seat : 'Waiting for a player to join'}</p>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {players.map(p => <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">{p.shooter && <Crown className="h-4 w-4 text-amber-300" />}{p.seat}</span>
          <span className={p.active ? 'text-emerald-300' : 'text-gray-500'}>{p.active ? 'Watching' : 'Away'}</span>
        </div>)}
        {!players.length && <p className="text-sm text-white/60">Join the table to become the first shooter/dealer.</p>}
      </div>
    </section>
  );
}

function MyBetsPanel({ table }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
      <h2 className="text-lg font-black">Your practice bets</h2>
      <div className="mt-3 space-y-2 text-sm">
        {!(table.myBets?.length) && <p className="text-gray-400">No pending selections.</p>}
        {table.myBets?.map(b => <div key={b.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
          <span>{b.target.replace(/_/g, ' ').toUpperCase()}</span><span className="font-black text-amber-300">{chip(b.units)} chips</span>
        </div>)}
      </div>
      <h3 className="mt-5 border-t border-white/10 pt-3 text-sm font-black">Recent resolved practice bets</h3>
      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
        {!(table.myRecent?.length) && <p className="text-gray-400">No resolved bets.</p>}
        {table.myRecent?.map((b,i) => <div key={i} className="flex justify-between gap-2 text-gray-300">
          <span>{b.target.replace(/_/g,' ')} · {chip(b.units)} placed</span>
          <span className={b.outcome==='win' ? 'text-green-300' : 'text-gray-400'}>
            {b.outcome.toUpperCase()} · {chip(b.paid)} returned
          </span>
        </div>)}
      </div>
    </section>
  );
}

export default function MultiplayerPracticeTable({ game }) {
  const [stake,setStake] = useState(5);
  const [crapsBetTarget,setCrapsBetTarget]=useState(null);
  const [clockNow,setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const {table, loading, busy, error, user, isAuthenticated, refresh, join, leave, claim, placeBet, runRound, refill} = useMultiplayerPractice(game);
  const joined = !!table?.joined;
  // The server is authoritative; the client clock is only for an accurate visual countdown.
  const deadline = Date.parse(table?.bettingClosesAt ?? '');
  const clockOffset = table?.clockOffsetMs ?? 0;
  const remainingMs = Number.isFinite(deadline) ? Math.max(0, deadline - (clockNow - clockOffset)) : 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const bettingOpen = !!table?.betsOpen && secondsLeft > 0;
  const betEligible = joined && bettingOpen && user?.role !== 'tester' && !user?.is_excluded && Number(table?.chips||0)>0;
  const canBet = betEligible && Number(table.chips)>=stake;
  const amShooter = !!(table?.shooterId && user?.id === table.shooterId);
  const canShoot = amShooter && !bettingOpen && !busy;
  const liveShooter=table?.players?.find(p=>p.shooter)?.active;
  const canClaim=joined && !amShooter && !liveShooter && (game!=='craps'||table?.myJoinMode==='shooter');
  const last=table?.lastResult;
  const dragChips=useCrapsChipDrag({
    enabled:game==='craps'&&betEligible,
    blocked:busy,
    available:Number(table?.chips||0),
    point:table?.point,
    onDrop:async(target,amount)=>{
      if(game!=='craps'||!betEligible||busy||Number(table?.chips||0)<amount)return false;
      const ok=await placeBet(target,amount);
      if(ok){setStake(amount);setCrapsBetTarget(null);}
      return ok;
    },
  });
  return (
    <main className="min-h-screen bg-[#0a0612] px-3 py-7 text-white sm:px-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/Games" className="text-sm font-semibold text-amber-300 hover:underline">← All games</Link>
          <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">Multiplayer · Shared staging room</span>
        </div>
        <PracticeNotice />
        <GameTableScene3D game={game} outcome={last} chipCount={table?.chips||0} seats={table?.players||[]} label={game==='craps'?'3D craps table with animated dice and chip stacks':'3D roulette table with animated wheel, ball, and chip stacks'} />
        {table && <div role="status" aria-live="polite" className={"flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 " +
          (bettingOpen ? 'border-green-400/40 bg-green-950/35' : 'border-amber-400/40 bg-amber-950/25')}>
          <div><p className="font-black uppercase tracking-wider">{bettingOpen ? 'Bets open — place your chips' : 'No more bets — shooter turn'}</p>
            <p className="mt-1 text-sm text-gray-300">Shared round {table.round} · All players see the same lock time.</p>
          </div>
          <p className="font-mono text-3xl font-black tabular-nums text-amber-200" aria-label={bettingOpen ? secondsLeft + ' seconds remaining' : 'Betting closed'}>
            {bettingOpen ? secondsLeft + 's' : 'LOCKED'}
          </p>
        </div>}
        {game==='craps'&&dragChips.notice&&<div aria-live="polite" role="status" className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{dragChips.notice}</div>}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {loading && !table ? <div role="status" className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">Connecting to the practice table…</div> : null}
            {table && game==='craps'&&<CrapsChipRack table={table} stake={stake} setStake={setStake}
              dragHandlers={dragChips.handlers} busy={busy} joined={joined}/>}
            {table && (game==='craps'
              ? <CrapsFelt table={table} choose={setCrapsBetTarget} selected={crapsBetTarget}
                  hovered={dragChips.hovered} disabled={busy} canBet={betEligible} canShoot={canShoot} isShooter={amShooter} onShoot={()=>void runRound()} />
              : <RouletteFelt table={table} choose={target=>void placeBet(target,stake)} disabled={busy} canBet={canBet} />)}
            {table && <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
              <div className="grid gap-5 md:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="text-lg font-black">{game==='craps'?'Shooter and player controls':'Select practice chips'}</h2>
                  {game==='craps'
                    ? <p className="mt-2 text-sm text-gray-300">Join the action to bet on each roll, or volunteer as shooter. Shooters share one server-authoritative dice result with everyone at this table.</p>
                    : <><div className="mt-3 flex flex-wrap gap-2">
                      {CHIP_VALUES.map(v=><button key={v} type="button" disabled={busy}
                        aria-pressed={stake===v} onClick={()=>setStake(v)}
                        className={'flex h-14 w-14 items-center justify-center rounded-full border-4 font-black shadow-inner '+(stake===v?'scale-105 border-amber-300 bg-purple-700 text-white ring-2 ring-amber-300':'border-gray-200 bg-purple-950 text-amber-100')}>{v}</button>)}
                    </div>
                    <p className="mt-3 text-sm text-gray-400">Remaining practice chips: <strong className="text-amber-300">{chip(table.chips)}</strong></p></>}
                  {game==='craps'&&joined&&<div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">
                    {amShooter?'You are the active shooter.':table.myJoinMode==='shooter'
                      ?'You are waiting in the shooter queue ('+(((table.shooterQueue||[]).findIndex(p=>p.id===user?.id))+1)+' in line).'
                      :'You joined the action as a bettor; you can place wagers without throwing dice.'}
                  </div>}
                </div>
                <div className="flex flex-col justify-center gap-2">
                  {!joined && (game==='craps'
                    ? <div className="flex flex-col gap-2">
                      <button type="button" disabled={busy||user?.role==='tester'||user?.is_excluded}
                        onClick={()=>void join('shooter')} className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-gray-950 disabled:opacity-50">🎲 Join as Shooter</button>
                      <button type="button" disabled={busy||user?.role==='tester'||user?.is_excluded}
                        onClick={()=>void join('action')} className="rounded-xl border border-amber-300/50 px-6 py-3 text-sm font-black text-amber-200 disabled:opacity-50">♠ Join the Action (Bettor)</button>
                      <p className="text-center text-xs text-white/60">If a shooter is already active, Shooter joins the waiting queue.</p>
                    </div>
                    : <button disabled={busy||user?.role==='tester'||user?.is_excluded}
                      onClick={()=>void join()} className="rounded-xl bg-amber-400 px-7 py-3 font-black text-gray-950 disabled:opacity-50">Join practice table</button>)}
                  {game==='craps'&&joined&&!amShooter&&table.myJoinMode==='action'&&<button type="button"
                    disabled={busy} onClick={()=>void join('shooter')} className="rounded-xl border border-amber-400/60 px-6 py-3 text-sm font-semibold text-amber-200 disabled:opacity-50">Join shooter queue</button>}
                  {game==='craps'&&joined&&table.myJoinMode==='shooter'&&<button type="button"
                    disabled={busy} onClick={()=>void join('action')} className="rounded-xl border border-white/30 px-6 py-3 text-sm text-white/80 disabled:opacity-50">{amShooter?'Pass the dice • stay as bettor':'Leave shooter queue • stay as bettor'}</button>}
                  {joined && amShooter && <button disabled={!canShoot} onClick={()=>void runRound()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-7 py-4 text-lg font-black text-gray-950 disabled:opacity-50">
                    {game==='craps' ? <Dices className="h-5 w-5" /> : <RotateCw className="h-5 w-5" />}
                    {busy ? 'Processing…' : bettingOpen ? 'BETTING OPEN · '+secondsLeft+'s' : game==='craps' ? 'SHOOT THE DICE' : 'SPIN THE WHEEL'}
                  </button>}
                  {canClaim && <button onClick={()=>void claim()} disabled={busy}
                    className="rounded-xl bg-amber-400 px-6 py-3 font-black text-gray-950 disabled:opacity-50">Take idle {game==='craps' ? 'shooter' : 'spinner'} seat</button>}
                  {joined && !amShooter && !canClaim && <p className="rounded-xl border border-white/20 p-3 text-center text-sm text-gray-300">Place side bets and watch the action. The designated {game==='craps' ? 'shooter rolls' : 'spinner spins'} for the whole table.</p>}
                  {joined && <button type="button" disabled={busy} onClick={()=>void leave()} className="rounded-lg border border-red-400/40 px-5 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/30 disabled:opacity-50">Leave table · preserve chips</button>}
                  <button type="button" onClick={()=>void refresh()} className="rounded-lg border border-white/25 px-5 py-2 text-sm text-gray-300 hover:bg-white/10">Refresh table</button>
                </div>
              </div>
              {last && <p className="mt-3 border-t border-white/10 pt-3 text-sm text-gray-300">
                Last action, round {last.round}: {last.game==='craps' ? 'dice '+last.dice.join(' + ')+' = '+last.total : 'ball on '+last.number+' ('+last.color+')'}.
                {last.game==='craps' && (last.pointAfter ? ' Point is '+last.pointAfter+'.' : ' Come-out round next.')}
              </p>}
              {!isAuthenticated && <Link to="/login" className="mt-4 block text-sm text-amber-300 underline">Sign in to join this table</Link>}
              {user?.role==='tester' && <p className="mt-3 text-sm text-amber-200">Tester access is read-only; you may watch but cannot place chips or shoot.</p>}
              {user?.is_excluded && <p className="mt-3 text-sm text-red-300">Account exclusion disables gameplay.</p>}
              {error && <p role="alert" className="mt-3 rounded-xl bg-red-950/70 p-3 text-sm text-red-200">{error}</p>}
            </section>}
          </div>
          <aside className="space-y-5">
            {table && <>{game==='craps'&&<CrapsBettingCard table={table} stake={stake} setStake={setStake}
              selected={crapsBetTarget} setSelected={setCrapsBetTarget} canBet={canBet} busy={busy}
              placeBet={placeBet} joined={joined} refill={refill} dragHandlers={dragChips.handlers}/>}
              <PlayersPanel table={table}/><MyBetsPanel table={table}/></>}
            <section className="rounded-2xl border border-white/10 bg-[#1b1728] p-5">
              <h2 className="text-lg font-black">How this table works</h2>
              {game==='craps'
                ? <p className="mt-2 text-sm leading-6 text-gray-300">The shooter rolls for everyone. A 7 on the come-out does not pass the dice. When a point is established, repeat it to make the point, or roll a 7 to seven-out and rotate the shooter. Players may place Field and Any Seven side bets on the next roll, or Place Number bets while a point is active.</p>
                : <p className="mt-2 text-sm leading-6 text-gray-300">Everyone can place inside and outside practice bets on the same table. The designated spinner resolves all open selections in one European single-zero spin. After the result, a new round opens automatically.</p>}
              <p className="mt-2 text-xs text-yellow-200/80">Betting locks after a 12-second window; the server enforces the deadline. Refreshes approximately every 3 seconds. Rules and bet calculations are for staging demonstration, not approved real-money settlement. No independent randomness certification has been completed.</p>
            </section>
          </aside>
        </div>
      </div>
      {game==='craps'&&dragChips.drag&&<div className="ig-craps-chip-ghost"
        aria-hidden="true" style={{left:dragChips.drag.x,top:dragChips.drag.y}}>
        {dragChips.drag.amount}
      </div>}
    </main>
  );
}
