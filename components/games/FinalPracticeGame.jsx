import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {verifyFinalRound,dartTables} from '@/lib/finalPracticeFairness';
const names={darts:'Darts',dicezone:'Dice Zone',hilo:'HiLo',towers:'Towers'};
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const sameOptions=(a,b)=>a&&b&&JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
export default function FinalPracticeGame({game}){
 const {user}=useAuth(),key=`imperial-final:${user?.id}:${game}`;
 const [round,setRound]=useState(null),[difficulty,setDifficulty]=useState('easy'),[start,setStart]=useState(1),[end,setEnd]=useState(50),[clientSeed,setClientSeed]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 const [pending,setPending]=useState(()=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}});
 const lock=useRef(false),readonly=!user||user.role==='tester'||user.is_excluded;
 const proofKey=id=>`imperial-final-proof:${user?.id}:${id}`;
 const read=id=>JSON.parse(localStorage.getItem(proofKey(id))||'null');
 async function call(body){
  const {data,error}=await supabase.functions.invoke('ig-final-practice',{body:{...body,game}});
  if(error||!data||data.error||!Object.hasOwn(data,'state')){let message=data?.error||'Round unavailable. Retry the same request.';try{message=(await error?.context?.json())?.error||message;}catch{}throw Error(message);}return data.state;
 }
 async function accept(state,expectedId){
  if(!state){setRound(null);return;}
  if(state.game!==game||state.algorithm!=='hmac-sha256-final-v1'||state.practiceOnly!==true||!['committed','active','ended'].includes(state.phase)||!Number.isInteger(state.version)||state.version<0||state.version>51||!Array.isArray(state.history)||!/^[0-9a-f]{64}$/.test(state.serverSeedHash)||expectedId&&state.roundId!==expectedId)throw Error('Invalid round response');
  let known=read(state.roundId);
  if(!known){if(state.phase!=='committed')throw Error('The original commitment is missing on this device. This round cannot be verified.');known={roundId:state.roundId,game,options:state.options,serverSeedHash:state.serverSeedHash,algorithm:state.algorithm,practiceOnly:true};}
  if(known.game!==game||known.roundId!==state.roundId||known.serverSeedHash!==state.serverSeedHash||!sameOptions(known.options,state.options)||known.algorithm!==state.algorithm||known.practiceOnly!==true)throw Error('The saved commitment changed. Round rejected.');
  if(state.phase!=='committed'&&(!known.clientSeed||known.clientSeed!==state.clientSeed))throw Error('The submitted client seed changed or is missing. Round rejected.');
  if(state.phase!=='ended'&&(Object.hasOwn(state,'serverSeed')||Object.hasOwn(state,'layout')))throw Error('Future outcome privacy check failed.');
  if(state.phase==='ended'&&!await verifyFinalRound(known,state))throw Error('The fairness proof did not match. Round rejected.');
  localStorage.setItem(proofKey(state.roundId),JSON.stringify(known));setRound(state);
 }
 useEffect(()=>{let alive=true;(async()=>{try{const state=await call({action:'current'});if(alive)await accept(state);}catch(e){if(alive)setError(e.message);}finally{if(alive)setBusy(false);}})();return()=>{alive=false;};},[user?.id,game]);
 async function mutate(body){
  if(lock.current||readonly)return;lock.current=true;setBusy(true);setError('');
  try{
   if(body.action==='start'){const known=read(body.roundId);if(!known||known.clientSeed&&known.clientSeed!==body.clientSeed)throw Error('Saved proof inputs changed');localStorage.setItem(proofKey(body.roundId),JSON.stringify({...known,clientSeed:body.clientSeed}));}
   localStorage.setItem(key,JSON.stringify(body));setPending(body);
   const state=await call(body);
   if(body.action==='commit'){
    if(state.roundId!==body.roundId||!sameOptions(body.options,state.options))throw Error('Submitted options changed');
    await accept(state,body.roundId);
   }
   await accept(await call({action:'current'}),body.roundId);
   localStorage.removeItem(key);setPending(null);
  }catch(e){setRound(null);setError(e.message);}finally{lock.current=false;setBusy(false);}
 }
 async function refresh(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await accept(await call({action:'current'}));}catch(e){setRound(null);setError(e.message);}finally{lock.current=false;setBusy(false);}}
 const active=round?.phase==='active',committed=round?.phase==='committed',ended=round?.phase==='ended',blocked=busy||readonly||!!pending;
 const options=game==='dicezone'?{start,end}:game==='hilo'?{}:{difficulty};
 const invalid=game==='dicezone'&&(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>100||start>end);
 const action=(type,choice)=>mutate({action:type,roundId:round.roundId,requestId:crypto.randomUUID(),version:round.version,...(choice!==undefined?{choice}:{}),...(type==='start'?{clientSeed:clientSeed.trim()}:{})});
 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white"><div className="mx-auto max-w-4xl space-y-5">
  <Link to="/Games" className="text-amber-300 underline">← Back to games</Link>
  <h1 className="text-4xl font-black">{names[game]}</h1>
  <p className="rounded-xl border border-sky-400/20 bg-sky-950/30 p-4 text-sky-100">Free practice. No coins, tokens, money or prizes are charged or awarded.</p>
  <div className="grid gap-5 md:grid-cols-2"><section className="space-y-4 rounded-xl bg-[#191529] p-5">
   {['darts','towers'].includes(game)&&<label className="block">Difficulty<select aria-label="Difficulty" value={round&&!ended?round.options.difficulty:difficulty} disabled={blocked||active||committed} onChange={e=>setDifficulty(e.target.value)} className="mt-2 block w-full rounded bg-slate-800 p-3">{(game==='darts'?['easy','medium','hard','expert']:['easy','hard']).map(x=><option key={x}>{x}</option>)}</select></label>}
   {game==='dicezone'&&<div className="grid grid-cols-2 gap-3">{[['Zone start',start,setStart,'start'],['Zone end',end,setEnd,'end']].map(([label,value,set,name])=><label key={label}>{label}<input aria-label={label} type="number" min="1" max="100" disabled={blocked||committed} value={round&&!ended?round.options[name]:value} onChange={e=>set(Number(e.target.value))} className="mt-2 w-full rounded bg-slate-800 p-3"/></label>)}</div>}
   <label className="block">Client seed<input aria-label="Client seed" maxLength={128} disabled={blocked||active} value={pending?.clientSeed??(active?round.clientSeed:clientSeed)} onChange={e=>setClientSeed(e.target.value)} className="mt-2 w-full rounded bg-slate-800 p-3"/></label>
   {pending?<button disabled={busy||readonly} onClick={()=>mutate(pending)} className="w-full rounded bg-violet-600 p-4 font-bold disabled:opacity-50">Retry pending request</button>:committed?<button disabled={blocked||!clientSeed.trim()} onClick={()=>action('start')} className="w-full rounded bg-violet-600 p-4 font-bold disabled:opacity-50">Start committed round</button>:active?<button disabled={blocked} onClick={()=>action('finish')} className="w-full rounded bg-emerald-600 p-4 font-bold disabled:opacity-50">Stop and reveal proof</button>:<button disabled={blocked||invalid} onClick={()=>mutate({action:'commit',roundId:crypto.randomUUID(),options})} className="w-full rounded bg-violet-600 p-4 font-bold disabled:opacity-50">{ended?'Commit a new round':'Commit round'}</button>}
   <button disabled={busy} onClick={refresh} className="text-sm underline">Refresh round</button>
   {game==='towers'&&<p className="text-sm text-gray-300">Nine floors, three tiles each. Easy has one hidden mine per floor; hard has two. Only the current floor can be selected.</p>}
   {game==='hilo'&&<p className="text-sm text-gray-300">Ace is low, King is high. Higher/lower includes equal ranks; Same requires equality. Cards are drawn with replacement. A round ends on a miss, at 50 predictions, or when you stop.</p>}
   {game==='darts'&&<p className="text-sm text-gray-300">Practice multipliers and weights: {dartTables[(round?.options.difficulty)||difficulty][0].map((n,i)=>`${n}× (${dartTables[(round?.options.difficulty)||difficulty][1][i]}%)`).join(', ')}. These are score labels, not payouts.</p>}
   {busy&&<p role="status">Loading round…</p>}{error&&<p role="alert" className="rounded bg-red-950 p-3 text-red-200">{error}</p>}
   {user?.role==='tester'&&<p>This account has read-only access.</p>}
  </section><section aria-label={`${names[game]} board`} className="rounded-xl bg-[#191529] p-5">
   {game==='towers'?<div className="space-y-2">{Array.from({length:9},(_,i)=>8-i).map(level=><div key={level} className="grid grid-cols-3 gap-2">{[0,1,2].map(tile=>{
    const selected=round?.history[level]?.tile===tile,mine=ended&&round.layout[level].includes(tile);
    return <button key={tile} aria-label={`Floor ${level+1} tile ${tile+1}`} disabled={!active||blocked||level!==round.history.length} onClick={()=>action('move',String(tile))} className={`rounded border p-4 ${selected?'border-amber-300':'border-white/15'} disabled:opacity-70`}>{mine?'💣':selected||ended?'💎':'◆'}</button>;
   })}</div>)}</div>:game==='hilo'?<div className="space-y-5 text-center"><p aria-live="polite" className="rounded-xl bg-white p-8 text-5xl font-bold text-slate-950">{round?.outcome?`${ranks[round.outcome.rank-1]} ${['♥','♦','♣','♠'][round.outcome.suit]}`:'?'}</p><div className="grid gap-2">{[['higherOrSame','Higher or same'],['lowerOrSame','Lower or same'],['same','Same']].map(([choice,label])=><button key={choice} disabled={!active||blocked} onClick={()=>action('move',choice)} className="rounded bg-violet-700 p-3 font-bold disabled:opacity-40">{label}</button>)}</div><p>Successful predictions: {round?.history.filter(h=>h.won).length||0}</p></div>:<div className="flex min-h-64 flex-col items-center justify-center gap-4"><p className="text-7xl">{game==='darts'?'🎯':'🎲'}</p><p aria-live="polite" className="text-3xl font-bold">{ended?(game==='darts'?`${round.outcome.multiplier}× · zone ${round.outcome.zone+1}`:`Roll ${round.outcome.roll} · ${round.outcome.won?'Inside your zone':'Outside your zone'}`):'Commit a round to begin'}</p></div>}
   {ended&&<p role="status" className="mt-5 text-emerald-300">✓ Fairness proof verified on your device · {round.endReason}</p>}
  </section></div>
  {round&&<details className="break-all rounded-xl bg-[#191529] p-4 text-sm"><summary>Round commitment and proof</summary><p className="mt-3">Round: {round.roundId}</p><p>SHA-256: {round.serverSeedHash}</p>{ended&&<><p>Server seed: {round.serverSeed}</p><p>Client seed: {round.clientSeed}</p><p>Transcript: {JSON.stringify(round.history)}</p></>}<p>Algorithm: HMAC-SHA256-final-v1</p></details>}
 </div></main>;
}
