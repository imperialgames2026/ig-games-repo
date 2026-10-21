import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { isPokerId, pokerErrorMessage, pokerTableView, pokerTurnSeconds } from '@/lib/pokerTableView';

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
 const canPlay=isAuthenticated&&user?.role!=='tester'&&!user?.is_excluded;
 const [params,setParams]=useSearchParams();
 const tableId=params.get('tableId');
 const [entry,setEntry]=useState('');
 const [snapshot,setSnapshot]=useState(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [raise,setRaise]=useState('40');
 const [receivedAt,setReceivedAt]=useState(null);
 const [now,setNow]=useState(Date.now());
 const [needsSeat,setNeedsSeat]=useState(false);
 const [offline,setOffline]=useState(false);
 const [notice,setNotice]=useState('');
 const requestRef=useRef(null);
 const busyRef=useRef(false);
 const scope=useRef(tableId);
 const requested=useRef(0);
 const applied=useRef(0);
 const alive=useRef(true);
 scope.current=tableId;

 const invoke=useCallback(async(input)=>{
   const {data,error:e}=await supabase.functions.invoke('poker-table-v1',{body:input});
   if(e){
     const details=await e.context?.json?.().catch(()=>null);
     throw new Error(details?.error||'Poker server unavailable. Refresh the table before retrying.');
   }
   if(!data||data.error)throw new Error(data?.error||'Poker action was rejected');
   return data;
 },[]);
 const fetchState=useCallback(async (quiet=false)=>{
   if(!isPokerId(tableId)||!isAuthenticated)return;
   const request=++requested.current;
   if(!quiet)setLoading(true);
   try {
     const s=await invoke({action:'snapshot',tableId});
     if(alive.current&&scope.current===tableId&&request>=applied.current){
       applied.current=request;setSnapshot(s);setReceivedAt(Date.now());setNow(Date.now());
       setNeedsSeat(false);setOffline(false);if(!quiet)setError('');
     }
   }catch(e){
     if(alive.current&&scope.current===tableId&&request>=applied.current){
       applied.current=request;
       if(e.message==='Not seated'){setNeedsSeat(true);setOffline(false);}
       else {setOffline(true);if(!quiet)setError(pokerErrorMessage(e));}
     }
   }finally{if(alive.current&&scope.current===tableId&&!quiet)setLoading(false);}
 },[tableId,isAuthenticated,invoke]);
 useEffect(()=>{
   alive.current=true;setSnapshot(null);setReceivedAt(null);setLoading(false);setNeedsSeat(false);setOffline(false);setError('');setNotice('');
   requestRef.current=null;
   void fetchState();
   const interval=window.setInterval(()=>void fetchState(true),2500);
   return ()=>{alive.current=false;clearInterval(interval);};
 },[fetchState]);
 useEffect(()=>{
   const timer=window.setInterval(()=>setNow(Date.now()),250);
   return ()=>clearInterval(timer);
 },[]);
 const doAction=useCallback(async(action,fields={})=>{
   if(busyRef.current||!canPlay||(action!=='create'&&!isPokerId(tableId)))return;
   busyRef.current=true;
   setBusy(true);setError('');
   try{
     if(action==='create') {
       const r=await invoke({action:'create',variant});
       if(!uuid.test(r.tableId))throw new Error('Invalid returned table');
       setParams({tableId:r.tableId});return;
     }
     if(action==='join') {
       await invoke({action,tableId,variant});await fetchState();return;
     }
     const body={action,tableId,...fields};
     if(action==='act'||action==='buyTime') {
       const fingerprint=JSON.stringify(body);
       const request=requestRef.current?.fingerprint===fingerprint
         ?requestRef.current.id:crypto.randomUUID();
       requestRef.current={fingerprint,id:request};
       body[action==='act'?'actionId':'requestId']=request;
     }
     await invoke(body);
     requestRef.current=null;
     await fetchState();
   }catch(e){if(alive.current)setError(pokerErrorMessage(e));}
   finally{busyRef.current=false;if(alive.current)setBusy(false);}
 },[canPlay,tableId,variant,invoke,setParams,fetchState]);

 const {table,seats,turn,mySeat,wrongVariant,myTurn,isOwner,canDeal,fundedSeats,
   due,callAmount,minRaise,maxRaise,canRaise,canAllIn,pot}=pokerTableView(snapshot,user?.id,variant);
 const seconds=pokerTurnSeconds(snapshot,receivedAt,now);
 const stale=offline||(receivedAt!==null&&now-receivedAt>10000);
 const controlsDisabled=busy||loading||!canPlay||stale||seconds===0;
 const rank=Number(raise);
 const validRaise=Number.isSafeInteger(rank)&&rank>=minRaise&&rank<=maxRaise;
 const copyInvite=async()=>{
   try{await navigator.clipboard.writeText(window.location.href);setNotice('Invite copied. Share it with a signed-in test player.');}
   catch{setNotice('Copy the table ID above and send it to your test player.');}
 };
 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white">
   <div className="mx-auto max-w-6xl space-y-5">
     <div className="flex flex-wrap items-center justify-between gap-2">
       <nav aria-label="Poker navigation" className="flex flex-wrap gap-4"><Link to="/PokerLobby" className="text-amber-300 hover:underline">← Poker lobby</Link>{user?.role==='superadmin'&&<Link to="/PokerBotLab" className="text-amber-300 hover:underline">AI Poker Lab</Link>}<Link to="/PastPlayedHands" className="text-amber-300 hover:underline">Past Played Hands</Link>{!isOmaha&&<Link to="/PokerMultiTable" className="font-bold text-amber-300 underline">My multi-table desk · Up to 3</Link>}</nav>
       <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-200">Tester chips · {isOmaha?'Omaha · 6 seats':'Hold’em · 8 seats'}</span>
       {table?.eventId&&<Link to={"/PokerTournamentPrizes?eventId="+encodeURIComponent(table.eventId)} className="text-sm font-semibold text-amber-300 underline">Tournament prize ladder</Link>}
     </div>
     <p className="rounded-xl border border-sky-300/20 bg-sky-950/30 p-4 text-sm text-sky-100">
       Multiplayer {isOmaha?'Omaha with four private cards, exactly two private and three community cards at showdown':'Texas Hold’em with two private cards'}; shared board, forced blinds and server-controlled turns. Each seat starts with 1,000 tester chips. Chips have no cash value and stay in this room between hands. No purchase, deposit, withdrawal or entry fee.
     </p>
     {!canPlay&&isAuthenticated&&<p role="alert" className="rounded-xl border border-amber-300/30 bg-amber-950/40 p-4 text-amber-100">This account has read-only access. Ask the host for a player account to take a seat.</p>}
     {!tableId && <section className="mx-auto max-w-xl rounded-xl border border-white/10 bg-[#1d1727] p-6">
       <h1 className="text-3xl font-black">{isOmaha?'Omaha':'Hold’em'} table lobby</h1>
       <p className="mt-3 text-sm text-gray-300">Create a private room, share the invite, then deal when at least two players are seated. Each player needs their own signed-in account.</p>
       <button type="button" disabled={busy||!canPlay} onClick={()=>void doAction('create')}
         className="mt-5 w-full rounded-lg bg-amber-400 p-3 font-black text-slate-950 disabled:opacity-50">Create {isOmaha?'six-seat Omaha':'eight-seat Hold’em'} table</button>
       <label className="mt-5 block text-sm">Or enter a table ID
         <input value={entry} onChange={e=>setEntry(e.target.value.trim())}
           className="mt-2 w-full rounded-lg border border-white/20 bg-[#0d0915] p-3 text-white" placeholder="UUID table code" />
       </label>
       <button type="button" disabled={!uuid.test(entry)} onClick={()=>setParams({tableId:entry})}
         className="mt-3 rounded-lg border border-amber-300 px-5 py-2 font-bold text-amber-200 disabled:opacity-50">Open table</button>
       {!isAuthenticated&&<Link to="/login" className="mt-4 block text-amber-200 underline">Sign in to join a table</Link>}
     </section>}
     {tableId&&!isPokerId(tableId)&&<p role="alert" className="rounded-lg bg-red-950 p-4 text-red-100">This invite has an invalid table ID. <button type="button" onClick={()=>setParams({})} className="underline">Return to the table lobby</button></p>}
     {isPokerId(tableId) && <section className="space-y-4">
       {wrongVariant&&<p role="alert" className="rounded-lg border border-red-400 bg-red-950 p-4 text-red-100">This is {table.variant==='omaha'?'an Omaha':'a Hold’em'} table. <Link className="font-bold underline" to={(table.variant==='omaha'?'/PlayOmaha':'/PlayPoker')+'?tableId='+encodeURIComponent(tableId)}>Open the matching table</Link>.</p>}
       <div className="rounded-xl border border-white/10 bg-[#1d1727] p-4 text-sm">
         <p className="font-semibold text-amber-200">Table invite link</p>
         <div className="mt-2 flex flex-wrap items-center gap-2">
           <code className="max-w-full break-all text-gray-300">{tableId}</code>
           <button type="button" onClick={()=>void copyInvite()}
             className="rounded-lg border border-white/30 px-3 py-1.5">Copy invite link</button>
           <button type="button" disabled={busy} onClick={()=>setParams({})} className="rounded-lg border border-white/30 px-3 py-1.5">Open another room</button>
         </div>
         <p className="mt-2 text-gray-400">Hand #{table?.handNo??0} · {table?.status||(needsSeat?'Join to view the table':'Connecting')} · {table?.street||'Preflop'}</p>
         {mySeat&&<p className="mt-2 font-bold text-amber-200">Your stack: {Number(mySeat.stack).toLocaleString()} tester chips · In pot: {Number(mySeat.committed).toLocaleString()}</p>}
         {needsSeat&&<p className="mt-2 text-sky-100">Take an open seat below to see this private room. Joining gives you one 1,000-chip starting stack.</p>}
         {stale&&<p role="status" className="mt-2 text-amber-200">Reconnecting to the table… Actions pause until a fresh server update arrives.</p>}
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
           <p className="mt-5 text-sm font-bold text-amber-100">Pot: {pot.toLocaleString()} chips</p>
           <div className="mx-auto mt-5 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
             {Array.from({length:isOmaha?6:8},(_,number)=>{
               const s=seats.find(x=>x.seat_no===number);
               return <div key={number} className={'rounded-xl border p-3 text-left text-sm '+(!!s&&s.seat_no===turn?.seat_no&&table?.status==='playing'?'border-amber-300 bg-amber-200/15':'border-white/30 bg-black/15')}>
                 <div className="font-bold">Seat {number+1} {s?.user_id===user?.id?'(You)':''} {table?.button===number&&<span className="rounded-full bg-white px-1.5 py-0.5 text-xs text-black" title="Dealer button">D</span>}</div>
                 <div className={'mt-1 '+(s?.isBot?'font-bold text-amber-200':'text-gray-300')}>{s?(s.displayName||(s.isBot?'Poker player [AI BOT]':'Seated player')):'Open seat'}</div>
                 {!!s&&<><p className="text-amber-200">{s.stack} chips</p><p className="text-gray-300">In pot: {s.committed}</p>
                   <p className="text-xs">{s.folded?'Folded':s.all_in?'All-in':s.acted?'Acted':'Waiting'}</p>
                   <div className="mt-1 flex gap-1" aria-label="Private cards hidden">{Array.from({length:isOmaha?4:2},(_,index)=><span key={index}>🂠</span>)}</div></>}
               </div>;
             })}
           </div>
           {mySeat&&<div className="mx-auto mt-6 max-w-sm rounded-xl border-2 border-amber-300 bg-black/30 p-4">
             <p className="mb-2 text-sm font-semibold text-amber-200">Your private cards</p>
             <div className="flex justify-center gap-3">{(snapshot?.holeCards||[]).map((c,i)=><span key={i}
               className="flex h-20 w-14 items-center justify-center rounded-lg bg-white text-xl font-black text-slate-950">{cardText(c)}</span>)}</div>
             {!snapshot?.holeCards?.length&&<p className="text-sm text-white/70">Waiting for the next deal</p>}
             <p className="mt-2 text-xs text-white/70">These cards are returned only to your authenticated player session.</p>
           </div>}
         </div>
       </div>
       <div className="rounded-xl border border-white/10 bg-[#1d1727] p-5">
         <div className="flex flex-wrap items-center justify-between gap-4">
           <div><h2 className="text-lg font-black">Table controls</h2>
             <p className="mt-1 text-sm text-gray-300">
               {table?.status==='complete'?'Hand complete · stacks carried forward':myTurn?(due>0?'Your turn · call '+callAmount+' tester chips':'Your turn · check or bet'):turn?'Waiting for seat '+(turn.seat_no+1):'Waiting for the host to deal'}
             </p>
             {table?.status==='playing'&&seconds!==null&&<p role="timer" aria-label="Turn time remaining" className={'mt-2 font-bold '+(seconds<=3?'text-red-300':'text-amber-200')}>{seconds}s {seconds===0?'· Server resolving timeout':'remaining'}</p>}
           </div>
           <div className="flex flex-wrap gap-2">
             {!mySeat&&<button disabled={busy||loading||!canPlay||wrongVariant||(!needsSeat&&!snapshot)} onClick={()=>void doAction('join')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Join open seat</button>}
             {isOwner&&!wrongVariant&&['waiting','complete'].includes(table?.status)&&<button disabled={busy||stale||!canPlay||!canDeal}
               onClick={()=>void doAction('start')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{table.status==='complete'?'Deal next hand':'Deal hand · 2+ players'}</button>}
             {mySeat&&!wrongVariant&&table?.status==='showdown'&&table?.street!=='river'&&<button disabled={busy||stale||!canPlay}
               onClick={()=>void doAction('advance')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Deal next street</button>}
             {mySeat&&!wrongVariant&&table?.status==='showdown'&&table?.street==='river'&&<button disabled={busy||stale||!canPlay}
               onClick={()=>void doAction('settle')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Resolve showdown on server</button>}
             <button type="button" disabled={busy||loading} onClick={()=>void fetchState()} className="rounded-lg border border-white/30 px-5 py-2 disabled:opacity-40">Refresh</button>
           </div>
         </div>
         {['waiting','complete'].includes(table?.status)&&fundedSeats<2&&<p className="mt-3 text-sm text-amber-100">{table.status==='complete'?'Fewer than two seats have chips. Create a new room for a fresh test session.':'Share the invite and wait for a second player to join.'}</p>}
         {table?.status==='showdown'&&<p className="mt-3 text-sm text-gray-300">Betting is complete for this street. A seated player can reveal the next street or resolve the river showdown.</p>}
         {myTurn&&<div className="mt-4 rounded-xl border border-white/20 p-4">
           <div className="flex flex-wrap gap-2">
             <button disabled={controlsDisabled} onClick={()=>void doAction('act',{move:'fold',version:table.version})}
               className="rounded-lg border border-red-300 px-4 py-2 text-red-200">Fold</button>
             {due===0?<button disabled={controlsDisabled} onClick={()=>void doAction('act',{move:'check',version:table.version})} className="rounded-lg border border-white/30 px-4 py-2 disabled:opacity-40">Check</button>
               :<button disabled={controlsDisabled} onClick={()=>void doAction('act',{move:'call',version:table.version})} className="rounded-lg bg-green-700 px-4 py-2 font-bold disabled:opacity-40">Call {callAmount}{callAmount<due?' · all-in':''}</button>}
             <button disabled={controlsDisabled||!canAllIn} onClick={()=>void doAction('act',{move:'allin',version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 text-amber-200 disabled:opacity-40">All in · {mySeat.stack}</button>
             {snapshot.timebank?.practicePreviewEnabled&&!table.turnExtensionUsed&&<button type="button" disabled={controlsDisabled}
               onClick={()=>void doAction('buyTime',{currency:'PRACTICE',version:table.version})} className="rounded-lg border border-sky-300 px-4 py-2 text-sky-100 disabled:opacity-40">Free +30 seconds</button>}
           </div>
           {canRaise&&<div className="mt-3 flex flex-wrap items-center gap-2">
             <label className="text-sm">Total bet / raise to
               <input type="number" min={minRaise} max={maxRaise} step="1" value={raise} onChange={e=>setRaise(e.target.value)}
                 className="ml-2 w-24 rounded-lg border border-white/30 bg-[#0d0915] p-2" />
             </label>
             <button disabled={controlsDisabled||!validRaise}
               onClick={()=>void doAction('act',{move:Number(table.currentBet)>0?'raise':'bet',amount:rank,version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 font-bold text-amber-200 disabled:opacity-40">Confirm {Number(table.currentBet)>0?'raise':'bet'}</button>
             <button type="button" onClick={()=>setRaise(String(minRaise))} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Min {minRaise}</button>
             <p className="w-full text-xs text-gray-400">Whole chips · minimum {minRaise} · maximum {maxRaise}. Use All in for a shorter stack.</p>
           </div>}
           {!canRaise&&mySeat.acted&&due>0&&<p className="mt-3 text-xs text-gray-300">A short all-in did not reopen raising. Call or fold.</p>}
           <p className="mt-3 text-xs text-gray-400">At timeout, the server checks if legal or folds. The free timebank is available once per turn.</p>
         </div>}
       </div>
     </section>}
     {error&&<p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
     {(loading||busy)&&<p role="status" className="text-sm text-gray-300">{busy?'Sending table action…':'Connecting to poker table…'}</p>}
     {notice&&<p role="status" className="text-sm text-emerald-200">{notice}</p>}
   </div>
 </main>;
}
