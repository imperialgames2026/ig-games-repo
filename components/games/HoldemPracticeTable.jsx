import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

// All cards/turns/side pots are managed by poker-table-v1.
// No local card shuffle, pot assignment, bankroll or wallet access.
const cardText = c => {
  if(!c)return '🂠';
  if(typeof c==='string')return c;
  const ranks={11:'J',12:'Q',13:'K',14:'A'};
  const suits={c:'♣',d:'♦',h:'♥',s:'♠'};
  return (ranks[c.rank]||c.rank)+(suits[c.suit]||'?');
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default function HoldemPracticeTable({variant='holdem'}) {
 const isOmaha=variant==='omaha';
 const {user,isAuthenticated}=useAuth();
 const [params,setParams]=useSearchParams();
 const tableId=params.get('tableId');
 const [entry,setEntry]=useState('');
 const [snapshot,setSnapshot]=useState(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [raise,setRaise]=useState('40');
 const requestRef=useRef(null);
 const last=useRef(null);
 const alive=useRef(true);

 const invoke=useCallback(async(input)=>{
   const {data,error:e}=await supabase.functions.invoke('poker-table-v1',{body:input});
   if(e)throw new Error('Poker server unavailable. Refresh table before retrying.');
   if(!data||data.error)throw new Error(data?.error||'Poker action was rejected');
   return data;
 },[]);
 const fetchState=useCallback(async (quiet=false)=>{
   if(!tableId||!isAuthenticated)return;
   try {
     const s=await invoke({action:'snapshot',tableId});
     if(alive.current){last.current=s;setSnapshot(s);if(!quiet)setError('');}
   }catch(e){if(alive.current&&!quiet)setError(e.message);}
 },[tableId,isAuthenticated,invoke]);
 useEffect(()=>{
   alive.current=true;setSnapshot(null);last.current=null;
   void fetchState();
   const interval=window.setInterval(()=>void fetchState(true),2500);
   return ()=>{alive.current=false;clearInterval(interval);};
 },[fetchState]);
 const doAction=useCallback(async(action,fields={})=>{
   if(busy||!isAuthenticated)return;
   setBusy(true);setError('');
   try{
     if(action==='create') {
       const r=await invoke({action:'create',variant});
       if(!uuid.test(r.tableId))throw new Error('Invalid returned table');
       setParams({tableId:r.tableId});return;
     }
     if(action==='join') {
       await invoke({action,tableId});await fetchState();return;
     }
     const body={action,tableId,...fields};
     if(action==='act') {
       const fingerprint=JSON.stringify(body);
       const request=requestRef.current?.fingerprint===fingerprint
         ?requestRef.current.id:crypto.randomUUID();
       requestRef.current={fingerprint,id:request};
       body.actionId=request;
     }
     await invoke(body);
     requestRef.current=null;
     await fetchState();
   }catch(e){if(alive.current)setError(e.message);}
   finally{if(alive.current)setBusy(false);}
 },[busy,isAuthenticated,tableId,invoke,setParams,fetchState]);

 const table=snapshot?.table;
 const seats=snapshot?.seats||[];
 const turn=seats.find(s=>s.seat_no===table?.turnIndex);
 const mySeat=seats.find(s=>s.user_id===user?.id);
 const toCall=mySeat?Math.max(0,Number(table?.currentBet||0)-Number(mySeat.street_bet||0)):0;
 const wrongVariant=!!table&&table.variant!==variant;
 const myTurn=!!mySeat && !wrongVariant && table?.turnIndex===mySeat.seat_no && table?.status==='playing';
 const isOwner=table?.ownerId===user?.id;
 const rank=Math.max(0,Number(raise)||0);
 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white">
   <div className="mx-auto max-w-6xl space-y-5">
     <div className="flex flex-wrap items-center justify-between gap-2">
       <div className="flex flex-wrap gap-4"><Link to="/Games" className="text-amber-300 hover:underline">← Games</Link><Link to="/PastPlayedHands" className="text-amber-300 hover:underline">Past Played Hands</Link><Link to="/ImperialMembership" className="text-amber-300 hover:underline">3-Bet Membership</Link>{!isOmaha&&<Link to="/PokerMultiTable" className="font-bold text-amber-300 underline">+ Add table · Open up to 3</Link>}</div>
       <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-200">Practice {isOmaha?'Omaha · 6 seats':'Hold’em · 8 seats'}</span>
       {table?.eventId&&<Link to={"/PokerTournamentPrizes?eventId="+encodeURIComponent(table.eventId)} className="text-sm font-semibold text-amber-300 underline">Tournament prize ladder</Link>}
     </div>
     <p className="rounded-xl border border-sky-300/20 bg-sky-950/30 p-4 text-sm text-sky-100">
       Multiplayer {isOmaha?'Omaha with four private cards, exactly two private and three community cards at showdown':'Texas Hold’em with two private cards'}; shared board, forced blinds and server-authoritative turns. Only nonredeemable 1,000-chip practice stacks. No deposits, prizes or payouts. Planned fees (not active): 1% of each participating player's ante at hand start, plus 2% of the final pot after ante fees. Whole practice-chip fees round down; winners split the net pot.
     </p>
     {!tableId && <section className="mx-auto max-w-xl rounded-xl border border-white/10 bg-[#1d1727] p-6">
       <h1 className="text-3xl font-black">{isOmaha?'Omaha':'Hold’em'} table lobby</h1>
       <p className="mt-3 text-sm text-gray-300">Create a private practice table, then share its link. Friends can join using the same table ID.</p>
       <button type="button" disabled={busy||!isAuthenticated} onClick={()=>void doAction('create')}
         className="mt-5 w-full rounded-lg bg-amber-400 p-3 font-black text-slate-950 disabled:opacity-50">Create {isOmaha?'six-seat Omaha':'eight-seat Hold’em'} table</button>
       <label className="mt-5 block text-sm">Or enter a table ID
         <input value={entry} onChange={e=>setEntry(e.target.value.trim())}
           className="mt-2 w-full rounded-lg border border-white/20 bg-[#0d0915] p-3 text-white" placeholder="UUID table code" />
       </label>
       <button type="button" disabled={!uuid.test(entry)} onClick={()=>setParams({tableId:entry})}
         className="mt-3 rounded-lg border border-amber-300 px-5 py-2 font-bold text-amber-200 disabled:opacity-50">Open table</button>
       {!isAuthenticated&&<Link to="/login" className="mt-4 block text-amber-200 underline">Sign in to join a table</Link>}
     </section>}
     {tableId && <section className="space-y-4">
       {wrongVariant&&<p role="alert" className="rounded-lg border border-red-400 bg-red-950 p-4 text-red-100">This table is {table?.variant}, not {variant}. Use the matching poker page. No actions will be permitted here.</p>}
       <div className="rounded-xl border border-white/10 bg-[#1d1727] p-4 text-sm">
         <p className="font-semibold text-amber-200">Table invite link</p>
         <div className="mt-2 flex flex-wrap items-center gap-2">
           <code className="max-w-full break-all text-gray-300">{tableId}</code>
           <button type="button" onClick={()=>navigator.clipboard?.writeText(window.location.href)}
             className="rounded-lg border border-white/30 px-3 py-1.5">Copy invite link</button>
         </div>
         <p className="mt-2 text-gray-400">Hand #{table?.handNo??0} · {table?.status||'Not yet joined'} · {table?.street||'Preflop'} · Version {table?.version??'—'}</p>
       </div>
       <div className="rounded-[3rem] border-[12px] border-[#67452a] bg-[#0b4e38] p-4 shadow-2xl sm:p-8">
         <div className="rounded-[2.5rem] border-2 border-amber-200/60 bg-[radial-gradient(ellipse_at_top,_#176448,_#06452f)] px-3 py-8 text-center">
           <h1 className="text-3xl font-black italic">{isOmaha?'OMAHA':'TEXAS HOLD’EM'}</h1>
           <p className="mt-2 text-sm text-amber-200">Small blind {table?.smallBlind??'—'} · Big blind {table?.bigBlind??'—'}</p>
           <p className="mt-3 text-xs text-white/70">Communal board</p>
           <div className="mt-3 flex min-h-20 flex-wrap items-center justify-center gap-2">
             {Array.from({length:5},(_,i)=><span key={i} className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-white/70 bg-white text-lg font-black text-slate-950">
               {cardText(table?.board?.[i])||'🂠'}
             </span>)}
           </div>
           <p className="mt-5 text-sm font-bold text-amber-100">Pot: {seats.reduce((sum,s)=>sum+Number(s.committed||0),0).toLocaleString()} chips</p>
           <div className="mx-auto mt-5 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3">
             {Array.from({length:isOmaha?6:8},(_,number)=>{
               const s=seats.find(x=>x.seat_no===number);
               return <div key={number} className={'rounded-xl border p-3 text-left text-sm '+(s?.seat_no===turn?.seat_no?'border-amber-300 bg-amber-200/15':'border-white/30 bg-black/15')}>
                 <div className="font-bold">Seat {number+1} {s?.user_id===user?.id?'(You)':''}</div>
                 <div className="mt-1 text-gray-300">{s?'Seated player':'Open seat'}</div>
                 {!!s&&<><p className="text-amber-200">{s.stack} chips</p><p className="text-gray-300">In pot: {s.committed}</p>
                   <p className="text-xs">{s.folded?'Folded':s.all_in?'All-in':s.acted?'Acted':'Waiting'}</p>
                   <div className="mt-1 flex gap-1"><span>🂠</span><span>🂠</span></div></>}
               </div>;
             })}
           </div>
           {mySeat&&<div className="mx-auto mt-6 max-w-sm rounded-xl border-2 border-amber-300 bg-black/30 p-4">
             <p className="mb-2 text-sm font-semibold text-amber-200">Your private cards</p>
             <div className="flex justify-center gap-3">{(snapshot?.holeCards||[]).map((c,i)=><span key={i}
               className="flex h-20 w-14 items-center justify-center rounded-lg bg-white text-xl font-black text-slate-950">{cardText(c)}</span>)}</div>
             <p className="mt-2 text-xs text-white/70">These cards are returned only to your authenticated player session.</p>
           </div>}
         </div>
       </div>
       <div className="rounded-xl border border-white/10 bg-[#1d1727] p-5">
         <div className="flex flex-wrap items-center justify-between gap-4">
           <div><h2 className="text-lg font-black">Table controls</h2>
             <p className="mt-1 text-sm text-gray-300">
               {myTurn?'Your turn · call '+toCall+' practice chips':turn?'Waiting for seat '+(turn.seat_no+1):'Waiting for hand to start'}
             </p>
           </div>
           <div className="flex flex-wrap gap-2">
             {!mySeat&&<button disabled={busy||wrongVariant} onClick={()=>void doAction('join')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Join open seat</button>}
             {isOwner&&!wrongVariant&&table?.status==='waiting'&&<button disabled={busy||seats.length<2}
               onClick={()=>void doAction('start')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Deal hand · 2+ players</button>}
             {!wrongVariant&&table?.status==='showdown'&&table?.street!=='river'&&<button disabled={busy}
               onClick={()=>void doAction('advance')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Deal next street</button>}
             {!wrongVariant&&table?.status==='showdown'&&table?.street==='river'&&<button disabled={busy}
               onClick={()=>void doAction('settle')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Resolve showdown on server</button>}
             <button type="button" onClick={()=>void fetchState()} className="rounded-lg border border-white/30 px-5 py-2">Refresh</button>
           </div>
         </div>
         {myTurn&&<div className="mt-4 rounded-xl border border-white/20 p-4">
           <div className="flex flex-wrap gap-2">
             <button disabled={busy} onClick={()=>void doAction('act',{move:'fold',version:table.version})}
               className="rounded-lg border border-red-300 px-4 py-2 text-red-200">Fold</button>
             {toCall===0?<button disabled={busy} onClick={()=>void doAction('act',{move:'check',version:table.version})} className="rounded-lg border border-white/30 px-4 py-2">Check</button>
               :<button disabled={busy} onClick={()=>void doAction('act',{move:'call',version:table.version})} className="rounded-lg bg-green-700 px-4 py-2 font-bold">Call {toCall}</button>}
             <button disabled={busy} onClick={()=>void doAction('act',{move:'allin',version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 text-amber-200">All in</button>
           </div>
           <div className="mt-3 flex flex-wrap items-center gap-2">
             <label className="text-sm">Total bet / raise to
               <input type="number" min="1" step="1" value={raise} onChange={e=>setRaise(e.target.value)}
                 className="ml-2 w-24 rounded-lg border border-white/30 bg-[#0d0915] p-2" />
             </label>
             <button disabled={busy||!Number.isSafeInteger(rank)||rank<=0}
               onClick={()=>void doAction('act',{move:Number(table.currentBet)>0?'raise':'bet',amount:rank,version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 font-bold text-amber-200">Confirm {Number(table.currentBet)>0?'raise':'bet'}</button>
           </div>
         </div>}
         {error&&<p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
         {loading&&<p role="status" className="mt-2 text-gray-400">Contacting poker table…</p>}
       </div>
     </section>}
   </div>
 </main>;
}
