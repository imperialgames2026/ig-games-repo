import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const number=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-US').format(Number(value)):'—';
const formatNames={scheduled_mtt:'Multi-table tournament',sit_and_go:'Sit & Go',ring:'Ring game'};
const statusNames={registration:'Registration open',running:'In progress',paused:'Paused',finished:'Finished'};
const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():'To be announced';

export default function PokerTournaments(){
 const [params,setParams]=useSearchParams();
 const eventId=params.get('eventId');
 const [events,setEvents]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const selected=useMemo(()=>events.find(event=>event.id===eventId),[events,eventId]);
 const load=useCallback(async()=>{
  setError('');
  try{
   const {data,error:invokeError}=await supabase.functions.invoke('poker-events-v1',{body:{action:'list'}});
   if(invokeError||data?.error)throw Error(data?.error||'Unable to load tournaments');
   setEvents(data.events||[]);
  }catch(e){setError(e?.message||'Unable to load tournaments');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer);},[load]);
 const register=async()=>{
  if(!selected||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:invokeError}=await supabase.functions.invoke('poker-events-v1',{body:{action:'register',eventId:selected.id}});
   if(invokeError||data?.error)throw Error(data?.error||'Registration failed');
   setNotice(data?.alreadyRegistered?'You are already in this tournament pool.':'Free practice registration confirmed. You are in the pool until a table is assigned.');
   await load();
  }catch(e){setError(e?.message||'Registration failed');}
  finally{setBusy(false);}
 };
 const blindLevels=Array.isArray(selected?.levels)?selected.levels:[];

 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white">
  <div className="mx-auto max-w-5xl space-y-6">
   <Link to="/PokerLobby" className="text-amber-300 underline">← Back to poker</Link>
   <header><p className="text-xs font-black uppercase tracking-widest text-amber-300">Practice tournaments</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Poker tournaments</h1>
    <p className="mt-3 max-w-3xl text-gray-300">Browse tournament details and join the player pool. Registration is free and uses non-redeemable practice chips only. No account transaction or payment approval is requested.</p>
   </header>
   <p className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-100">Late registration into a running event is not enabled. Players registered before the event starts stay in its pool and receive a table when the organizer starts the tournament.</p>
   {error&&<p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
   {notice&&<p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
   {loading&&<p role="status" className="text-gray-300">Loading tournaments…</p>}
   {!loading&&!events.length&&!error&&<p className="rounded-xl border border-white/10 bg-[#1c1729] p-6 text-gray-300">There are no published tournaments right now.</p>}
   {!eventId&&!!events.length&&<section className="grid gap-4 md:grid-cols-2">
    {events.map(event=><button key={event.id} type="button" onClick={()=>setParams({eventId:event.id})} className="rounded-xl border border-white/15 bg-[#1c1729] p-5 text-left transition hover:border-amber-300/60">
     <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-xl font-bold">{event.name}</h2><span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">{statusNames[event.status]||event.status}</span></div>
     <p className="mt-2 text-sm text-gray-300">{formatNames[event.format]||event.format} · {date(event.startAt)}</p>
     <p className="mt-4 text-sm text-gray-200">{event.registered}/{event.maxPlayers} players · {number(event.startingStack)} practice chips · Free entry</p>
     <span className="mt-4 inline-block text-sm font-bold text-amber-300">View tournament details →</span>
    </button>)}
   </section>}
   {eventId&&!uuid.test(eventId)&&<p role="alert" className="text-red-300">Invalid tournament ID.</p>}
   {eventId&&uuid.test(eventId)&&!loading&&!selected&&<p className="rounded-xl border border-white/10 bg-[#1c1729] p-6 text-gray-300">This tournament is not published or is no longer available.</p>}
   {selected&&<section className="space-y-5 rounded-2xl border border-white/15 bg-[#1c1729] p-5 sm:p-7">
    <button type="button" onClick={()=>setParams({})} className="text-sm font-semibold text-amber-300 underline">← All tournaments</button>
    <div><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{selected.name}</h2><span className="rounded-full bg-amber-300/10 px-3 py-1 text-sm font-bold text-amber-200">{statusNames[selected.status]||selected.status}</span></div>
     <p className="mt-2 text-gray-300">{formatNames[selected.format]||selected.format} · Start: {date(selected.startAt)}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <Spec label="Entry" value="Free · practice only"/>
     <Spec label="Players" value={`${selected.registered}/${selected.maxPlayers}`}/>
     <Spec label="Table capacity" value={`${selected.seatsPerTable} seats · up to ${selected.tableCount} tables`}/>
     <Spec label="Starting stack" value={`${number(selected.startingStack)} practice chips`}/>
     <Spec label="Current blind level" value={selected.currentLevel?number(selected.currentLevel):'Not started'}/>
     <Spec label="Tournament ID" value={selected.id}/>
    </div>
    {blindLevels.length>0&&<div><h3 className="mb-2 font-bold">Blind schedule</h3><div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full text-left text-sm"><thead><tr className="border-b border-white/10 text-gray-300"><th className="p-3">Level</th><th className="p-3">Small blind</th><th className="p-3">Big blind</th><th className="p-3">Duration</th></tr></thead><tbody>{blindLevels.map((level,index)=><tr key={level.level||index} className="border-b border-white/5"><td className="p-3">{level.level||index+1}</td><td className="p-3">{number(level.smallBlind)}</td><td className="p-3">{number(level.bigBlind)}</td><td className="p-3">{number(level.durationSeconds/60)} min</td></tr>)}</tbody></table></div></div>}
    {selected.myEntry?.status==='seated'&&selected.myEntry.table_id&&<div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4"><p className="font-bold text-emerald-200">You are seated · seat {Number(selected.myEntry.seat_no)+1}</p><Link to={`/PlayPoker?tableId=${encodeURIComponent(selected.myEntry.table_id)}`} className="mt-3 inline-block rounded-lg bg-emerald-300 px-4 py-2 font-black text-slate-950">Go to your tournament table</Link></div>}
    {selected.myEntry?.status==='registered'&&<p className="rounded-lg border border-sky-300/25 bg-sky-300/5 p-4 text-sm text-sky-100">You are in the tournament pool. The organizer will assign tables when the tournament starts. This is a practice queue, not a payment or transaction queue.</p>}
    {selected.status==='registration'&&!selected.myEntry&&<button type="button" onClick={()=>void register()} disabled={busy||selected.registered>=selected.maxPlayers} className="rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{busy?'Registering…':selected.registered>=selected.maxPlayers?'Tournament full':'Register free (practice)'}</button>}
    {selected.status==='running'&&!selected.myEntry&&<p className="rounded-lg border border-white/10 bg-black/10 p-4 text-sm text-gray-300">Registration is closed for this running tournament. Late registration is not enabled.</p>}
    {selected.status==='registration'&&selected.myEntry?.status==='seated'&&<p className="text-sm text-gray-300">You are already registered and seated.</p>}
    {selected.status==='running'&&selected.myEntry?.status==='registered'&&<p className="text-sm text-gray-300">Your tournament entry is recorded, but no table has been assigned. Contact an administrator; late seating is not enabled.</p>}
   </section>}
  </div>
 </main>;
}

function Spec({label,value}){
 return <div className="min-w-0 rounded-lg bg-black/15 p-3"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 break-all text-sm font-semibold text-white">{value}</p></div>;
}
