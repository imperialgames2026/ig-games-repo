import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {Search,RefreshCcw,MessageCircle,Send,ChevronLeft,ShieldAlert,Bot,LockKeyhole} from 'lucide-react';
import {Status,dt,fmt} from '@/components/admin/CommandCenterDataView';

async function support(action,more={}){
 const {data,error}=await supabase.functions.invoke('ig-support-v1',{body:{action,...more}});
 if(error||data?.error)throw Error(data?.error||'Support service unavailable');
 return data;
}
async function supervisor(action){
 const {data,error}=await supabase.functions.invoke('ig-support-supervisor',{body:{action}});
 if(error||data?.error)throw Error(data?.error||'Support supervisor unavailable');
 return data;
}
export default function AdminSupport(){
 const [params,setParams]=useSearchParams();
 const ticketId=params.get('ticket');
 const [rows,setRows]=useState([]);
 const [ticket,setTicket]=useState(null);
 const [messages,setMessages]=useState([]);
 const [search,setSearch]=useState('');
 const [status,setFilter]=useState('all');
 const [loading,setLoading]=useState(true);
 const [detailLoading,setDetailLoading]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [reply,setReply]=useState('');
 const [reviews,setReviews]=useState([]);
 const [alerts,setAlerts]=useState([]);
 const [supervisorInfo,setSupervisorInfo]=useState(null);
 const refreshQueue=useCallback(async()=>{
   setLoading(true);setError('');
   try{const x=await support('queue');setRows(x.tickets||[]);}
   catch(e){setError(e.message||'Unable to load tickets');setRows([]);}
   finally{setLoading(false);}
 },[]);
 const refreshSupervisor=useCallback(async()=>{
   try{const x=await supervisor('dashboard');
    setReviews(x.reviews||[]);setAlerts(x.alerts||[]);setSupervisorInfo(x.settings||null);}
   catch{setSupervisorInfo({available:false});}
 },[]);
 const refreshTicket=useCallback(async(id)=>{
  if(!id){setTicket(null);setMessages([]);return;}
  setDetailLoading(true);
  try{const x=await support('messages',{ticketId:id});
   setTicket(x.ticket);setMessages(x.messages||[]);}
  catch(e){setTicket(null);setMessages([]);setError(e.message||'Ticket not available');}
  finally{setDetailLoading(false);}
 },[]);
 useEffect(()=>{void refreshQueue();void refreshSupervisor();},[refreshQueue,refreshSupervisor]);
 useEffect(()=>{void refreshTicket(ticketId);},[ticketId,refreshTicket]);
 const filtered=useMemo(()=>rows.filter(t=>{
  const q=search.trim().toLowerCase();
  return (!q||[t.subject,t.id,t.user_id,t.status].some(v=>String(v||'').toLowerCase().includes(q)))&&
    (status==='all'||t.status===status);
 }),[rows,search,status]);
 const currentReview=reviews.find(x=>x.ticket_id===ticketId);
 const openTicket=id=>{setError('');setReply('');setParams({ticket:id});};
 const closeTicket=()=>{setTicket(null);setReply('');setParams({});};
 const send=async()=>{
  if(!ticketId||busy||!reply.trim()||reply.trim().length>2000||ticket?.status==='closed')return;
  setBusy(true);setError('');
  try{await support('post',{ticketId,body:reply.trim(),requestId:crypto.randomUUID()});
   setReply('');await Promise.all([refreshTicket(ticketId),refreshQueue()]);}
  catch(e){setError(e.message||'Could not send response');}
  finally{setBusy(false);}
 };
 const changeStatus=async(next)=>{
  if(!ticketId||busy||!['open','in_progress','closed'].includes(next))return;
  setBusy(true);setError('');
  try{await support('status',{ticketId,status:next});
   await Promise.all([refreshTicket(ticketId),refreshQueue()]);}
  catch(e){setError(e.message||'Could not update ticket');}
  finally{setBusy(false);}
 };
 const triage=async()=>{
  setBusy(true);setError('');
  try{await supervisor('scan');await Promise.all([refreshSupervisor(),refreshQueue()]);}
  catch(e){setError(e.message||'Supervisor review unavailable');}
  finally{setBusy(false);}
 };
 const lastAlert=alerts.find(x=>x.ticket_id===ticketId);
 return <div className="space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-4">
   <div><p className="text-[11px] font-bold tracking-[.22em] text-[#d2ab69]">PLAYER EXPERIENCE / HUMAN OVERSIGHT</p>
    <h1 className="mt-2 font-serif text-3xl font-bold text-white">Customer Support</h1>
    <p className="mt-2 max-w-2xl text-sm text-[#aeb3c3]">Open cases, read full conversations, answer customers, and review AI-assisted Superadmin escalations.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button disabled={loading||busy} onClick={()=>{void refreshQueue();void refreshSupervisor();if(ticketId)void refreshTicket(ticketId);}}
      className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"><RefreshCcw size={16}/> Refresh</button>
    <button disabled={busy} onClick={()=>void triage()}
      className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-300/10 px-4 py-2.5 text-sm font-bold text-amber-100 disabled:opacity-40"><Bot size={16}/> Run supervisor review</button>
   </div>
  </header>
  {error&&<div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
  <div className="grid gap-3 sm:grid-cols-4">
   {[
    ['Total cases',rows.length],['Open',rows.filter(t=>t.status==='open').length],
    ['In progress',rows.filter(t=>t.status==='in_progress').length],
    ['Superadmin escalations',reviews.filter(r=>r.requires_superadmin).length]
   ].map(([label,value])=><div key={label} className="rounded-xl border border-[#37394a] bg-[#181b25] p-4"><div className="text-xs text-[#aeb0be]">{label} (loaded)</div><div className="mt-2 text-2xl font-black text-white">{fmt(value)}</div></div>)}
  </div>
  <div className="rounded-xl border border-[#574626] bg-[#221d19] p-4 text-sm text-[#e0caa8]">
   <ShieldAlert size={17} className="mr-2 inline"/> The supervisor may flag cases and draft suggestions, but never sends customer replies, grants financial approvals or changes identity decisions. Email/SMS alerts require verified private provider configuration.
   {supervisorInfo?.available===false&&<p className="mt-2 text-amber-200">Supervisor reporting is currently unavailable; the human ticket queue still works.</p>}
   {supervisorInfo?.available!==false&&supervisorInfo&&<p className="mt-2 text-xs text-[#d8ba8c]">
     AI classification: {supervisorInfo.aiConfigured?'configured':'rules-only fallback'} · External alerts: {supervisorInfo.alertsEnabled?'enabled':'disabled until configured'} · Pending reviews: {supervisorInfo.pending??'—'}
   </p>}
  </div>
  <div className="grid gap-5 xl:grid-cols-[minmax(310px,.95fr)_minmax(0,1.35fr)]">
   <section className="min-w-0 rounded-2xl border border-[#303446] bg-[#151923]">
    <div className="border-b border-white/10 p-4">
     <label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9599aa]"/>
      <input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search support tickets"
       placeholder="Search subject, ID, player or status" className="w-full rounded-xl border border-white/20 bg-[#0e111a] py-3 pl-10 pr-3 text-sm text-white placeholder:text-[#808697] focus:border-amber-300 focus:outline-none"/>
     </label>
     <div className="mt-3 flex flex-wrap gap-2">
      {['all','open','in_progress','closed'].map(v=><button key={v} aria-pressed={status===v} onClick={()=>setFilter(v)}
       className={'rounded-lg border px-3 py-1.5 text-xs capitalize '+(status===v?'border-amber-300 bg-amber-300/15 text-amber-100':'border-white/10 text-[#b2b5c5]')}>{v.replace('_',' ')}</button>)}
     </div>
    </div>
    <div className="max-h-[630px] overflow-y-auto">
     {loading?<p className="p-6 text-sm text-[#a9adbd]">Loading ticket queue…</p>
     :filtered.length?filtered.map(t=>{
      const review=reviews.find(r=>r.ticket_id===t.id);
      return <button key={t.id} onClick={()=>openTicket(t.id)}
       aria-current={ticketId===t.id?'true':undefined}
       className={'block w-full border-b border-white/[.06] p-4 text-left hover:bg-amber-300/5 '+(ticketId===t.id?'bg-amber-300/10':'')}>
       <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-bold text-white">{t.subject}</span><Status value={t.status}/></div>
       <div className="mt-2 flex items-center gap-2 text-xs text-[#9b9db1]"><span className="font-mono">{t.id.slice(0,8)}</span><span>· {dt(t.updated_at)}</span></div>
       {review?.requires_superadmin&&<p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-200"><LockKeyhole size={13}/> Superadmin review required</p>}
      </button>;
     }):<p className="p-7 text-center text-sm text-[#9fa3b3]">No matching cases in the most recent 100 tickets.</p>}
    </div>
    <p className="border-t border-white/10 p-3 text-xs text-[#888fa0]">Search filters the 100 most recently updated cases. Ticket contents are retrieved only after opening a case.</p>
   </section>
   <section className="min-w-0 rounded-2xl border border-[#303446] bg-[#151923]">
    {!ticketId?<div className="flex min-h-[410px] flex-col items-center justify-center p-8 text-center"><MessageCircle size={40} className="text-amber-300/60"/><h2 className="mt-4 font-serif text-xl font-bold text-white">Select a support ticket</h2><p className="mt-2 text-sm text-[#a7acbb]">Open any ticket on the left to review and reply.</p></div>
    :<div>
     <div className="border-b border-white/10 p-5">
      <button onClick={closeTicket} className="mb-3 flex items-center gap-2 text-xs font-semibold text-amber-200 xl:hidden"><ChevronLeft size={14}/> All tickets</button>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
       <h2 className="break-words font-serif text-xl font-bold text-white">{ticket?.subject||'Loading conversation…'}</h2>
       <p className="mt-2 break-all font-mono text-xs text-[#a2a7b8]">{ticketId}</p></div>
       {ticket&&<Status value={ticket.status}/>}
      </div>
      {ticket&&<div className="mt-4 flex flex-wrap gap-2">
       {['open','in_progress','closed'].map(v=><button key={v} onClick={()=>void changeStatus(v)}
         disabled={busy||ticket.status===v} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white hover:border-amber-300 disabled:opacity-35">
         {v==='closed'?'Close ticket':v==='in_progress'?'Take ownership':'Reopen'}
       </button>)}
      </div>}
      {currentReview&&<div className={'mt-4 rounded-lg border p-3 text-sm '+(currentReview.requires_superadmin?'border-red-400/40 bg-red-400/10 text-red-100':'border-blue-400/25 bg-blue-400/5 text-[#bdcde1]')}>
       <p className="font-bold">Supervisor: {currentReview.category?.replaceAll('_',' ')} · {currentReview.priority} priority</p>
       <p className="mt-1 text-xs">{currentReview.reason}</p>
       {currentReview.requires_superadmin&&<p className="mt-1 text-xs font-bold">Awaiting human Superadmin review — no automatic approval</p>}
       {currentReview.suggested_reply&&<button onClick={()=>setReply(currentReview.suggested_reply)}
         disabled={busy||ticket?.status==='closed'} className="mt-2 rounded-md border border-white/30 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Use draft (review before sending)</button>}
      </div>}
      {lastAlert&&<p className="mt-2 text-xs text-[#9da6ba]">Alert delivery: email {lastAlert.email_state} · SMS {lastAlert.sms_state}</p>}
     </div>
     <div className="max-h-[430px] min-h-[280px] space-y-3 overflow-y-auto p-5">
      {detailLoading?<p className="text-sm text-[#aeb2c2]">Loading conversation…</p>
      :messages.length?messages.map(m=><div key={m.id} className={'max-w-[94%] rounded-xl border p-4 '+(m.sender_kind==='staff'?'ml-auto border-amber-300/30 bg-amber-300/10':'mr-auto border-white/15 bg-[#222735]')}>
       <div className="mb-2 flex justify-between gap-4 text-xs"><span className={m.sender_kind==='staff'?'font-bold text-amber-200':'font-bold text-[#b4d5fb]'}>{m.sender_kind==='staff'?'Support team':'Player'}</span><span className="text-[#999fb0]">{dt(m.created_at)}</span></div>
       <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">{m.body}</p>
      </div>):<p className="text-sm text-[#9ca1b0]">No messages yet.</p>}
     </div>
     <div className="border-t border-white/10 p-5">
      <label className="block text-xs font-bold uppercase tracking-widest text-[#c5ab80]">Staff reply</label>
      <textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={2000}
       disabled={!ticket||ticket.status==='closed'||busy} aria-label="Write a customer support reply"
       placeholder={ticket?.status==='closed'?'Reopen this ticket to reply':'Write a reply as the support team…'}
       rows={4} className="mt-3 w-full resize-y rounded-xl border border-white/20 bg-[#0c101a] p-3 text-sm leading-6 text-white placeholder:text-[#858ba0] focus:border-amber-300 focus:outline-none disabled:opacity-50"/>
      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-[#9da1b3]">{reply.length}/2000 · Human approval required</span>
       <button onClick={()=>void send()} disabled={!ticket||ticket.status==='closed'||busy||!reply.trim()} className="flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-[#221807] disabled:opacity-40"><Send size={15}/> Send reply</button>
      </div>
     </div>
    </div>}
   </section>
  </div>
 </div>;
}
