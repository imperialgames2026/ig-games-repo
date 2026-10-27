import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import PokerPlayerProfile, { PLAYER_EMOTES } from '@/components/poker/PokerPlayerProfile';
import PokerSettingsModal from '@/components/poker/PokerSettingsModal';
import { usePokerSounds } from '@/components/poker/usePokerSounds';
import './game-cockpit.css';
import ApprovedPokerTableScene from '@/components/poker/ApprovedPokerTableScene';
import {POKER_FORMATS,pokerCapacity} from '@/lib/pokerFormats';
import HandReplay from '@/components/poker/HandReplay';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { verifyPokerSnapshot, rememberDealRoot } from '@/lib/pokerReplayProof';
import { safePokerAvatar } from '@/lib/pokerAvatar';
import {createPracticeActionQueue} from '@/lib/practiceActionQueue';
import {canConfirmPokerAction,pokerReconciliationReason,pokerRecoveryView} from '@/lib/pokerActionRecovery';

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
const SEAT_POSITIONS={
  8:[['50%','8%'],['78%','18%'],['91%','48%'],['78%','79%'],['50%','90%'],['22%','79%'],['9%','48%'],['22%','18%']],
  6:[['50%','8%'],['83%','27%'],['80%','74%'],['50%','90%'],['20%','74%'],['17%','27%']],
};
const POKER_SETTINGS_KEY='ig-poker-settings-v1';
const DEFAULT_POKER_SETTINGS={
 tableColor:'green',cardPattern:'classic',cardBack:0,betIncrement:'Big Blinds',
 preflopBB:'2.5BB',postflop:'1/2',gameSound:true,sliderConfirm:true,
 comment:true,fairCode:true,actionVoice:'None'
};
const POKER_SKINS={
 green:{rail:'#67452a',felt:'radial-gradient(ellipse at top,#176448,#06452f 72%)'},
 teal:{rail:'#0f4040',felt:'radial-gradient(ellipse at top,#157474,#073d3d 72%)'},
 purple:{rail:'#4a2080',felt:'radial-gradient(ellipse at top,#56308a,#281145 72%)'},
 navy:{rail:'#1a2580',felt:'radial-gradient(ellipse at top,#294793,#111f50 72%)'},
 black:{rail:'#2a2a2a',felt:'radial-gradient(ellipse at top,#343434,#090909 72%)'}
};
const CARD_BACKS=['🔵','🟤','👑','💎','🟢','🟩'];
const SOCIAL_ICON=Object.fromEntries(PLAYER_EMOTES.map(item=>[item.id,item.label.split(' ')[0]]));
function cardColor(c,pattern){
 if(!c||typeof c==='string')return 'text-slate-950';
 if(pattern==='four-color')return c.suit==='h'?'text-red-600':c.suit==='d'?'text-blue-600':c.suit==='c'?'text-emerald-700':'text-slate-950';
 if(pattern==='western')return c.suit==='h'||c.suit==='d'?'text-red-800':'text-amber-950';
 return c.suit==='h'||c.suit==='d'?'text-red-600':'text-slate-950';
}
function announcePokerAction(move,mode){
 if(mode==='None'||typeof window==='undefined'||!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function')return;
 const text=({fold:'Fold',check:'Check',call:'Call',bet:'Bet',raise:'Raise',all_in:'All in'})[move]||move?.replaceAll('_',' ');
 if(!text)return;
 const utterance=new window.SpeechSynthesisUtterance(text);
 utterance.rate=1.04;utterance.pitch=mode==='Female'?1.25:.78;utterance.volume=.8;
 const voices=window.speechSynthesis.getVoices?.()||[];
 const wanted=mode.toLowerCase();
 utterance.voice=voices.find(v=>v.name?.toLowerCase().includes(wanted))||null;
 window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
}
export default function HoldemPracticeTable({variant='holdem'}) {
 const isOmaha=variant==='omaha';
 const [selectedCapacity,setSelectedCapacity]=useState(isOmaha?6:8);
 const [modelAnchors,setModelAnchors]=useState([]);
 const {user,isAuthenticated}=useAuth();
 const [params,setParams]=useSearchParams();
 const tableId=params.get('tableId')?.toLowerCase();
 const requestGeneration=useRef(0);
 const [proofStatus,setProofStatus]=useState('');
 const [entry,setEntry]=useState('');
 const [snapshot,setSnapshot]=useState(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [raise,setRaise]=useState('40');
 const [profileSeat,setProfileSeat]=useState(null);
 const [profileAnalytics,setProfileAnalytics]=useState(null);
 const [profileAnalyticsLoading,setProfileAnalyticsLoading]=useState(false);
 const [profileAnalyticsError,setProfileAnalyticsError]=useState('');
 const [activeSocialEvent,setActiveSocialEvent]=useState(null);
 const profileTrigger=useRef(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [pokerSettings,setPokerSettings]=useState(()=>{
   if(typeof window==='undefined')return DEFAULT_POKER_SETTINGS;
   try{return {...DEFAULT_POKER_SETTINGS,...JSON.parse(window.localStorage.getItem(POKER_SETTINGS_KEY)||'{}')};}
   catch{return DEFAULT_POKER_SETTINGS;}
 });
 const sounds=usePokerSounds();
 const [pendingAction,setPendingAction]=useState(null);
 const dispatchLock=useRef(false),queueRef=useRef(null);
 const getQueue=useCallback(()=>{
   if(!user?.id||!uuid.test(tableId||''))throw Error('An authenticated poker table is required.');
   const key=`ig.practice.pending.v1:poker:${user.id}:${tableId}`;
   if(queueRef.current?.key!==key)queueRef.current={key,queue:createPracticeActionQueue({storage:window.sessionStorage,key,makeId:()=>crypto.randomUUID()})};
   return queueRef.current.queue;
 },[user?.id,tableId]);
 useEffect(()=>{
   if(!isAuthenticated||!tableId){setPendingAction(null);return;}
   try{setPendingAction(getQueue().peek());}catch(e){setError(e.message);}
 },[getQueue,isAuthenticated,tableId]);
 const lastSocialRef=useRef(null);
 const socialTimerRef=useRef(null);
 const last=useRef(null);
 const alive=useRef(true);
 useEffect(()=>{
   try{window.localStorage.setItem(POKER_SETTINGS_KEY,JSON.stringify(pokerSettings));}catch{}
 },[pokerSettings]);

 const invoke=useCallback(async(input)=>{
   const {data,error:e}=await supabase.functions.invoke('poker-table-v1',{body:input});
   if(e){
     let message=e.message||'Poker server unavailable. Refresh table before retrying.';
     if(e.context?.json){const detail=await e.context.json().catch(()=>null);message=detail?.error||message;}
     throw new Error(message);
   }
   if(!data||data.error)throw new Error(data?.error||'Poker action was rejected');
   return data;
 },[]);
 const fetchState=useCallback(async (quiet=false)=>{
   if(!tableId||!isAuthenticated)return;
   const generation=requestGeneration.current;
   try {
     const s=await invoke({action:'snapshot',tableId});
     if(s.table?.id!==tableId||!Number.isSafeInteger(s.table.version)||!Array.isArray(s.seats))throw Error('Poker returned no verifiable table snapshot.');
     let message='This hand began before verified history was enabled.';
     if(s.deckProof){
       if(s.deckProof.tableId!==tableId||s.deckProof.handNo!==s.table.handNo)throw Error('Wrong hand proof');
       await verifyPokerSnapshot(s);
       try{rememberDealRoot(s.deckProof,window.localStorage);message='Locked deck and visible cards verified.';}
       catch(e){if(e.message.includes('changed'))throw e;message='Cards verified; browser storage unavailable for comparing earlier observations.';}
     }
     if(alive.current&&generation===requestGeneration.current){last.current=s;setSnapshot(s);setProofStatus(message);setError('');return s;}
     return null;
   }catch(e){if(alive.current&&generation===requestGeneration.current){setSnapshot(null);last.current=null;setError(e.message);}return null;}

 },[tableId,user?.id,isAuthenticated,invoke]);
 useEffect(()=>{
   requestGeneration.current++;alive.current=true;setSnapshot(null);last.current=null;setProofStatus('');
   void fetchState();
   const interval=window.setInterval(()=>void fetchState(true),2500);
   return ()=>{requestGeneration.current++;alive.current=false;clearInterval(interval);};
 },[fetchState]);
 useEffect(()=>{
   const events=snapshot?.socialEvents||[];
   const newest=events[events.length-1];
   if(!newest||newest.id===lastSocialRef.current)return;
   lastSocialRef.current=newest.id;
   if(Date.now()-Date.parse(newest.created_at)>5000)return;
   setActiveSocialEvent(newest);
   if(pokerSettings.gameSound){
     try{newest.action_id==='cheers'?sounds.beerClink():sounds.taunt();}catch{}
   }
   if(socialTimerRef.current)window.clearTimeout(socialTimerRef.current);
   socialTimerRef.current=window.setTimeout(()=>setActiveSocialEvent(null),2600);
   return ()=>{if(socialTimerRef.current)window.clearTimeout(socialTimerRef.current);};
 },[snapshot?.socialEvents,pokerSettings.gameSound,sounds]);
 useEffect(()=>{
   let cancelled=false;
   if(!profileSeat?.user_id||!tableId||!isAuthenticated){setProfileAnalytics(null);setProfileAnalyticsError('');return;}
   setProfileAnalyticsLoading(true);setProfileAnalyticsError('');setProfileAnalytics(null);
   void invoke({action:'playerStats',tableId,targetUserId:profileSeat.user_id}).then(data=>{
     if(!cancelled)setProfileAnalytics(data);
   }).catch(e=>{
     if(!cancelled)setProfileAnalyticsError(e?.message||'Player statistics unavailable');
   }).finally(()=>{if(!cancelled)setProfileAnalyticsLoading(false);});
   return ()=>{cancelled=true;};
 },[profileSeat?.user_id,tableId,isAuthenticated,invoke]);
 const sendSocial=useCallback(async({targetPlayerId,actionId})=>{
   if(!tableId)throw new Error('Table unavailable');
   await invoke({action:'sendSocial',tableId,targetUserId:targetPlayerId,actionId});
   await fetchState(true);
 },[tableId,invoke,fetchState]);
 const doAction=useCallback(async(action,fields={},retry=false)=>{
   if(dispatchLock.current||!isAuthenticated||!user?.id)return false;
   dispatchLock.current=true;const epoch=requestGeneration.current;
   setBusy(true);setError('');let queue,request;
   try{
     if(action!=='create')queue=getQueue();
     if(queue?.peek()&&action!=='act')throw Error('Confirm the pending poker action before changing the table.');
     if(action==='create') {
       const r=await invoke({action:'create',variant,seatCapacity:isOmaha?6:selectedCapacity});
       if(!uuid.test(r.tableId))throw new Error('Invalid returned table');
       setParams({tableId:r.tableId});return;
     }
     if(action==='join') {
       await invoke({action,tableId});await fetchState();return;
     }
     let body={action,tableId,...fields};
     if(action==='act') {
       const saved=retry?queue.peek():null;
       if(retry&&!saved)throw Error('No pending poker action.');
       request=queue.prepare('pokerAct',saved?saved.params:{tableId,version:fields.version,move:fields.move,amount:fields.amount??0});
       setPendingAction(request);body={action,...request.params,actionId:request.requestId};
     }
     const acknowledgement=await invoke(body);
     if(action==='act'){
       const move=fields.move==='allin'?'all_in':fields.move;
       if(pokerSettings.gameSound){
         try{
           if(move==='fold')sounds.fold();
           else if(move==='check')sounds.check();
           else if(move==='all_in')sounds.allIn();
           else sounds.bet();
         }catch{}
       }
       announcePokerAction(move,pokerSettings.actionVoice);
     }
     const confirmed=await fetchState();
     if(request){
       if(!canConfirmPokerAction(request,acknowledgement,confirmed))throw Error('Poker action could not be confirmed by its acknowledgement and table snapshot. Retry its original request.');
       queue.confirm(request.requestId);
       if(alive.current&&epoch===requestGeneration.current)setPendingAction(queue.peek());
     }
     return true;
   }catch(e){
     if(request){
       const reason=pokerReconciliationReason(e.message);
       try{if(reason)queue.requireReconciliation(request.requestId,reason);else queue.failed(request.requestId);}catch{/* Preserve original receipt. */}
       if(reason)await fetchState();
     }
     if(alive.current&&epoch===requestGeneration.current){if(queue)setPendingAction(queue.peek());setError(e.message);}return false;
   }finally{dispatchLock.current=false;if(alive.current&&epoch===requestGeneration.current)setBusy(false);}
 },[getQueue,isAuthenticated,user?.id,tableId,invoke,setParams,fetchState,pokerSettings.gameSound,pokerSettings.actionVoice,sounds,variant,isOmaha,selectedCapacity]);

 const table=snapshot?.table;
 const seats=snapshot?.seats||[];
 const capacity=table?pokerCapacity(table,variant):null;
 const invalidCapacity=!!table&&capacity===null;
 const anchored=!isOmaha&&capacity!==null&&modelAnchors.length===capacity;
 const turn=seats.find(s=>s.seat_no===table?.turnIndex);
 const mySeat=seats.find(s=>s.user_id===user?.id);
 const toCall=mySeat?Math.max(0,Number(table?.currentBet||0)-Number(mySeat.street_bet||0)):0;
 const wrongVariant=!!table&&table.variant!==variant;
 const myTurn=!!mySeat && !wrongVariant && table?.turnIndex===mySeat.seat_no && table?.status==='playing';
 const isOwner=table?.ownerId===user?.id;
 const rank=Math.max(0,Number(raise)||0);
 const skin=POKER_SKINS[pokerSettings.tableColor]||POKER_SKINS.green;
 const recovery=pokerRecoveryView(pendingAction,snapshot);
 const actionsPaused=busy||!!pendingAction||invalidCapacity;
 const cardBack=CARD_BACKS[Number(pokerSettings.cardBack)||0]||CARD_BACKS[0];
 return <main className={(tableId?'ig-poker-screen ':'')+"min-h-screen bg-[#0a0612] px-4 py-8 text-white"}>
   <div className="ig-poker-shell mx-auto max-w-6xl space-y-5">
     <div className="ig-poker-header flex flex-wrap items-center justify-between gap-2">
       <div className="flex flex-wrap gap-4"><Link to="/Games" className="text-amber-300 hover:underline">← Games</Link><Link to="/PokerBotLab" className="text-amber-300 hover:underline">AI Poker Lab</Link><Link to="/PastPlayedHands" className="text-amber-300 hover:underline">Past Played Hands</Link><Link to="/ImperialMembership" className="text-amber-300 hover:underline">3-Bet Membership</Link>{!isOmaha&&<Link to="/PokerMultiTable" className="font-bold text-amber-300 underline">+ Add table · Open up to 3</Link>}</div>
       <div className="flex items-center gap-2">
         <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-amber-200">Practice {isOmaha?'Omaha · 6 seats':tableId&&!capacity?'Hold’em · format awaiting confirmation':`Hold’em · ${capacity??selectedCapacity} seats`}</span>
         <button type="button" onClick={()=>setSettingsOpen(true)} className="rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-bold text-white hover:border-amber-300">⚙ Table</button>
       </div>
       {table?.eventId&&<Link to={"/PokerTournamentPrizes?eventId="+encodeURIComponent(table.eventId)} className="text-sm font-semibold text-amber-300 underline">Tournament prize ladder</Link>}
     </div>
     <p className="ig-poker-practice rounded-xl border border-sky-300/20 bg-sky-950/30 p-4 text-sm text-sky-100">
       Multiplayer {isOmaha?'Omaha with four private cards, exactly two private and three community cards at showdown':'Texas Hold’em with two private cards'}; shared board, forced blinds and server-authoritative turns. Only nonredeemable 1,000-chip practice stacks. No deposits, prizes or payouts. Planned fees (not active): 1% of each participating player's ante at hand start, plus 2% of the final pot after ante fees. Whole practice-chip fees round down; winners split the net pot.
     </p>
     {recovery&&<section aria-label="Poker action recovery" className="rounded-xl border border-amber-300/40 bg-amber-950/30 p-4 text-amber-100">
       <h2 className="font-bold">{recovery.title}</h2><p role="status" className="mt-2 text-sm">{recovery.message}</p>
       <p className="mt-2 break-all text-xs">Request reference: {recovery.reference}</p>
       <div className="mt-3 flex flex-wrap gap-4"><button disabled={busy} onClick={()=>void fetchState()} className="underline">Refresh table view</button>
       {recovery.retryAllowed&&<button disabled={busy} onClick={()=>void doAction('act',{},true)} className="underline">Retry original poker action</button>}
       <Link to="/Support" className="underline">Contact support</Link></div>
     </section>}
     {!tableId && <section className="mx-auto max-w-xl rounded-xl border border-white/10 bg-[#1d1727] p-6">
       <h1 className="text-3xl font-black">{isOmaha?'Omaha':'Hold’em'} table lobby</h1>
       <p className="mt-3 text-sm text-gray-300">Create a private practice table, then share its link. Friends can join using the same table ID.</p>
       {!isOmaha&&<fieldset className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><legend className="mb-2 text-sm">Choose a table format</legend>{POKER_FORMATS.map(format=><button type="button" key={format.capacity} aria-pressed={selectedCapacity===format.capacity} onClick={()=>setSelectedCapacity(format.capacity)} className={"overflow-hidden rounded-lg border p-2 "+(selectedCapacity===format.capacity?'border-amber-300':'border-white/20')}><img src={format.preview} alt="" className="h-24 w-full object-contain"/><span>{format.label}</span></button>)}</fieldset>}
       <button type="button" disabled={actionsPaused||!isAuthenticated} onClick={()=>void doAction('create')}
         className="mt-5 w-full rounded-lg bg-amber-400 p-3 font-black text-slate-950 disabled:opacity-50">Create {isOmaha?'six-seat Omaha':`${selectedCapacity}-seat Hold’em`} table</button>
       <label className="mt-5 block text-sm">Or enter a table ID
         <input value={entry} onChange={e=>setEntry(e.target.value.trim())}
           className="mt-2 w-full rounded-lg border border-white/20 bg-[#0d0915] p-3 text-white" placeholder="UUID table code" />
       </label>
       <button type="button" disabled={!uuid.test(entry)} onClick={()=>setParams({tableId:entry})}
         className="mt-3 rounded-lg border border-amber-300 px-5 py-2 font-bold text-amber-200 disabled:opacity-50">Open table</button>
       {!isAuthenticated&&<Link to="/login" className="mt-4 block text-amber-200 underline">Sign in to join a table</Link>}
     </section>}
     {tableId && <section className="ig-poker-live space-y-4">
       {wrongVariant&&<p role="alert" className="rounded-lg border border-red-400 bg-red-950 p-4 text-red-100">This table is {table?.variant}, not {variant}. Use the matching poker page. No actions will be permitted here.</p>}
       <div className="ig-poker-invite rounded-xl border border-white/10 bg-[#1d1727] p-4 text-sm">
         <p className="font-semibold text-amber-200">Table invite link</p>
         <div className="mt-2 flex flex-wrap items-center gap-2">
           <code className="max-w-full break-all text-gray-300">{tableId}</code>
           <button type="button" onClick={()=>navigator.clipboard?.writeText(window.location.href)}
             className="rounded-lg border border-white/30 px-3 py-1.5">Copy invite link</button>
         </div>
         <p className="mt-2 text-gray-400">Hand #{table?.handNo??0} · {table?.status||'Not yet joined'} · {table?.street||'Preflop'} · Version {table?.version??'—'}</p>
       </div>
       {invalidCapacity&&<p role="alert">This table format requires administrator review. Table actions are paused.</p>}
       <div className={(isOmaha?'':'ig-approved-poker ')+"ig-poker-felt-shell rounded-[3rem] border-[12px] border-[#67452a] p-4 shadow-2xl sm:p-8"} style={isOmaha?{background:skin.rail}:undefined}>
         <div className="ig-poker-stage rounded-[2.5rem] border-2 border-amber-200/60 text-center" style={isOmaha?{background:skin.felt}:undefined}>
           <div className="ig-poker-table-area">
           {!isOmaha&&capacity&&<div className="ig-approved-model"><ApprovedPokerTableScene capacity={capacity} onAnchors={setModelAnchors}/></div>}
           <div className="ig-poker-board-center">
             <h1 className="text-3xl font-black italic">{isOmaha?'OMAHA':'TEXAS HOLD’EM'}</h1>
             <p className="mt-1 text-sm text-amber-200">SB {table?.smallBlind??'—'} · BB {table?.bigBlind??'—'} · Hand #{table?.handNo??0}</p>
             <div className="mt-2 flex items-center justify-center gap-2">
               {Array.from({length:5},(_,i)=>{const c=table?.board?.[i];return <span key={i} className={'ig-board-card flex h-16 w-12 items-center justify-center rounded-lg border-2 border-white/70 bg-white text-lg font-black '+cardColor(c,pokerSettings.cardPattern)}>
                 {c?cardText(c):cardBack}
               </span>;})}
             </div>
             <p className="mt-2 text-sm font-black text-amber-100">POT {seats.reduce((sum,s)=>sum+Number(s.committed||0),0).toLocaleString()}</p>
           </div>
           <div className={"ig-poker-seat-ring "+(!isOmaha&&!anchored?"ig-poker-seat-grid":"")}>
             {Array.from({length:capacity??0},(_,number)=>{
               const s=seats.find(x=>x.seat_no===number);
               const anchor=modelAnchors.find(a=>a.seatIndex===number);
               const [left,top]=isOmaha?SEAT_POSITIONS[6][number]:anchored&&anchor?[`${anchor.x}%`,`${anchor.y}%`]:[undefined,undefined];
               const seatClass='ig-poker-seat relative rounded-xl border p-2 text-left text-xs shadow-lg '+(s?.seat_no===turn?.seat_no?'border-amber-300 bg-amber-200/20 ring-2 ring-amber-300/30':'border-white/30 bg-[#0b241d]/90');
               if(!s)return <div key={number} style={{left,top}} className={seatClass}>
                 <div className="truncate font-black">Seat {number+1}</div><div className="ig-seat-detail mt-1 text-gray-300">Open seat</div>
               </div>;
               return <button type="button" key={number} style={{left,top}} onClick={event=>{profileTrigger.current=event.currentTarget;setProfileSeat(s);}}
                 aria-label={'Open '+(s.displayName||'player')+' profile'} className={seatClass+' transition hover:border-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300'}>
                 <div className="flex items-center gap-2">
                   {safePokerAvatar(s.avatarUrl,s.user_id)?<img src={safePokerAvatar(s.avatarUrl,s.user_id)} alt="" className="h-8 w-8 shrink-0 rounded-full border border-amber-200/60 object-cover" referrerPolicy="no-referrer"/>:
                     <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-amber-950 text-amber-200">♛</span>}
                   <div className="min-w-0"><div className="truncate font-black">{s.displayName||'Imperial Player'} {s.user_id===user?.id?'· YOU':''}</div>
                     <div className="ig-seat-detail truncate text-gray-300">Seat {number+1}</div></div>
                 </div>
                 <p className="ig-seat-detail mt-1 font-black text-amber-200">{s.stack} chips</p>
                 <p className="ig-seat-detail text-white/70">Pot {s.committed} · {s.folded?'Folded':s.all_in?'All-in':s.acted?'Acted':'Waiting'}</p>
                 {activeSocialEvent?.target_user_id===s.user_id&&<span aria-live="polite" className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 animate-bounce rounded-full border border-amber-200/60 bg-black/80 px-3 py-1 text-2xl shadow-xl">{SOCIAL_ICON[activeSocialEvent.action_id]||'✨'}</span>}
               </button>;
             })}
           </div>
           </div>
           {mySeat&&snapshot?.holeCards?.length>0&&<div className="ig-poker-hole-center rounded-xl border-2 border-amber-300 bg-black/55 px-3 py-2">
             <div className="flex justify-center gap-2">{(snapshot?.holeCards||[]).map((c,i)=><span key={i}
               className={'ig-hole-card flex h-20 w-14 items-center justify-center rounded-lg bg-white text-xl font-black '+cardColor(c,pokerSettings.cardPattern)}>{cardText(c)}</span>)}</div>
           </div>}
         </div>
       </div>
       <div className="ig-poker-controls rounded-xl border border-white/10 bg-[#1d1727] p-5">
         <div className="flex flex-wrap items-center justify-between gap-4">
           <div><h2 className="text-lg font-black">Table controls</h2>
             {table?.handNo>0&&<p role="status" className="text-sm text-emerald-200">{proofStatus}</p>}
             <p className="mt-1 text-sm text-gray-300">
               {myTurn?'Your turn · call '+toCall+' practice chips':turn?'Waiting for seat '+(turn.seat_no+1):'Waiting for hand to start'}
             </p>
           </div>
           <div className="flex flex-wrap gap-2">
             {isAuthenticated&&<Dialog key={tableId}>
               <DialogTrigger asChild><button type="button" className="rounded-lg border border-amber-300 px-4 py-2 font-bold text-amber-200">Hand history &amp; replay</button></DialogTrigger>
               <DialogContent className="w-[96vw] max-w-6xl max-h-[90dvh] overflow-y-auto border-slate-700 bg-slate-950 p-4 text-white sm:p-6">
                 <DialogTitle>Your table ledger</DialogTitle>
                 <DialogDescription className="text-slate-300">Replay your completed hands and check their locked card records.</DialogDescription>
                 <HandReplay tableId={tableId} completedHand={table?.status==='complete'?table.handNo:0}/>
               </DialogContent>
             </Dialog>}
             {!mySeat&&<button disabled={actionsPaused||wrongVariant} onClick={()=>void doAction('join')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Join open seat</button>}
             {isOwner&&!wrongVariant&&['waiting','complete'].includes(table?.status)&&<button disabled={actionsPaused||seats.length<2}
               onClick={()=>void doAction('start')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Deal hand · 2+ players</button>}
             {!wrongVariant&&table?.status==='showdown'&&table?.street!=='river'&&<button disabled={actionsPaused}
               onClick={()=>void doAction('advance')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Deal next street</button>}
             {!wrongVariant&&table?.status==='showdown'&&table?.street==='river'&&<button disabled={actionsPaused}
               onClick={()=>void doAction('settle')} className="rounded-lg bg-amber-300 px-5 py-3 font-black text-slate-950">Resolve showdown on server</button>}
             <button type="button" onClick={()=>void fetchState()} className="rounded-lg border border-white/30 px-5 py-2">Refresh</button>
           </div>
         </div>
         {myTurn&&<div className="mt-4 rounded-xl border border-white/20 p-4">
           <div className="flex flex-wrap gap-2">
             <button disabled={actionsPaused} onClick={()=>void doAction('act',{move:'fold',version:table.version})}
               className="rounded-lg border border-red-300 px-4 py-2 text-red-200">Fold</button>
             {toCall===0?<button disabled={actionsPaused} onClick={()=>void doAction('act',{move:'check',version:table.version})} className="rounded-lg border border-white/30 px-4 py-2">Check</button>
               :<button disabled={actionsPaused} onClick={()=>void doAction('act',{move:'call',version:table.version})} className="rounded-lg bg-green-700 px-4 py-2 font-bold">Call {toCall}</button>}
             <button disabled={actionsPaused} onClick={()=>void doAction('act',{move:'allin',version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 text-amber-200">All in</button>
           </div>
           <div className="mt-3 flex flex-wrap items-center gap-2">
             <span className="text-sm font-semibold">Bet / raise to</span>
             <button type="button" disabled={actionsPaused||rank<=1} onClick={()=>setRaise(String(Math.max(1,Math.floor(rank/2))))}
               className="rounded-lg border border-white/25 px-3 py-2 font-black disabled:opacity-35" aria-label="Halve bet">÷2</button>
             <input type="number" inputMode="numeric" min="1" step="1" value={raise} onChange={e=>setRaise(e.target.value)}
               className="w-24 rounded-lg border border-white/30 bg-[#0d0915] p-2 text-center font-black" aria-label="Bet or raise amount" />
             <button type="button" disabled={actionsPaused||!Number.isSafeInteger(rank)||rank<=0} onClick={()=>setRaise(String(rank*2))}
               className="rounded-lg border border-white/25 px-3 py-2 font-black disabled:opacity-35" aria-label="Double bet">×2</button>
             <button disabled={actionsPaused||!Number.isSafeInteger(rank)||rank<=0}
               onClick={()=>void doAction('act',{move:Number(table.currentBet)>0?'raise':'bet',amount:rank,version:table.version})}
               className="rounded-lg border border-amber-300 px-4 py-2 font-bold text-amber-200">Confirm {Number(table.currentBet)>0?'raise':'bet'}</button>
           </div>
         </div>}
         {error&&<p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
         {loading&&<p role="status" className="mt-2 text-gray-400">Contacting poker table…</p>}
       </div>
     </section>}
     {profileSeat&&<PokerPlayerProfile
       player={{id:profileSeat.user_id,displayName:profileSeat.displayName,avatarUrl:profileSeat.avatarUrl}}
       analytics={profileAnalytics}
       loading={profileAnalyticsLoading}
       analyticsError={profileAnalyticsError}
       onClose={()=>setProfileSeat(null)}
       onRestoreFocus={()=>profileTrigger.current?.focus()}
       onSendAction={sendSocial}
       disabled={profileSeat.user_id===user?.id}
     />}
     <PokerSettingsModal open={settingsOpen} onClose={()=>setSettingsOpen(false)}
       settings={pokerSettings} onSettingsChange={setPokerSettings}/>
   </div>
 </main>;
}
