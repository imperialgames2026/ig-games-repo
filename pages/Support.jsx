import React,{useCallback,useEffect,useState} from 'react';
import {MessageCircle,Send,Plus,RefreshCcw,ArrowLeft,ShieldCheck} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';
const when=v=>v?new Date(v).toLocaleString():'—';
async function call(action,values={}){
 const {data,error}=await supabase.functions.invoke('ig-support-v1',{body:{action,...values}});
 if(error||data?.error)throw Error(data?.error||'Customer support is unavailable');
 return data;
}
export default function Support(){
 const {user}=useAuth();
 const [params,setParams]=useSearchParams();
 const selected=params.get('ticket');
 const [tickets,setTickets]=useState([]);
 const [ticket,setTicket]=useState(null);
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [showCreate,setShowCreate]=useState(false);
 const [subject,setSubject]=useState('');
 const [firstMessage,setFirstMessage]=useState('');
 const [reply,setReply]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{const r=await call('mine');setTickets(r.tickets||[]);setError('');}
  catch(e){setError(e.message);setTickets([]);}
  finally{setLoading(false);}
 },[]);
 const refreshDetail=useCallback(async(id)=>{
  if(!id){setTicket(null);setMessages([]);return;}
  try{const r=await call('messages',{ticketId:id});setTicket(r.ticket);setMessages(r.messages||[]);}
  catch(e){setError(e.message);setTicket(null);setMessages([]);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{void refreshDetail(selected);},[selected,refreshDetail]);
 const open=async()=>{
  if(busy||subject.trim().length<3||subject.trim().length>120||
   firstMessage.trim().length<1||firstMessage.trim().length>2000)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const response=await call('open',{subject:subject.trim(),body:firstMessage.trim(),requestId:crypto.randomUUID()});
   setSubject('');setFirstMessage('');setShowCreate(false);
   setParams({ticket:response.id});
   setSuccess('Support ticket created. Our team can now review it.');
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 const send=async()=>{
  if(!selected||busy||ticket?.status==='closed'||!reply.trim()||reply.trim().length>2000)return;
  setBusy(true);setError('');setSuccess('');
  try{
   await call('post',{ticketId:selected,body:reply.trim(),requestId:crypto.randomUUID()});
   setReply('');setSuccess('Message sent to support.');
   await Promise.all([refreshDetail(selected),refresh()]);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 return <div className="min-h-screen bg-[#0c0f18] px-4 py-10 text-white">
  <div className="mx-auto max-w-5xl space-y-6">
   <header className="flex flex-wrap items-center justify-between gap-4">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-200">Imperial Games</p>
     <h1 className="mt-2 font-serif text-3xl font-black sm:text-4xl">Customer Support</h1>
     <p className="mt-2 text-sm text-[#aeb3c0]">Open a support ticket or continue your conversation with the support team.</p></div>
    <div className="flex gap-2">
     <button onClick={()=>void refresh()} disabled={busy||loading} className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm text-white disabled:opacity-50"><RefreshCcw size={15}/> Refresh</button>
     <button onClick={()=>{setShowCreate(v=>!v);setParams({});}} disabled={busy} className="flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-[#25180d] disabled:opacity-50"><Plus size={16}/> New ticket</button>
    </div>
   </header>
   <div className="flex items-start gap-2 rounded-xl border border-[#394e41] bg-[#1b2921] p-4 text-sm text-[#c4dfcd]"><ShieldCheck size={20} className="shrink-0"/> Support conversations are private to you and authorized staff. AI-assisted ticket triage does not automatically make account, compliance or financial decisions.</div>
   {error&&<div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
   {success&&<div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{success}</div>}
   {showCreate&&<section className="space-y-4 rounded-2xl border border-amber-300/35 bg-[#1b1d28] p-5">
    <h2 className="font-serif text-xl font-bold">Open a support case</h2>
    <div><label className="block text-xs font-bold text-amber-200">Subject</label><input
      aria-label="Ticket subject" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={120}
      className="mt-2 w-full rounded-lg border border-white/20 bg-[#0b101a] p-3 text-sm text-white"
      placeholder="Describe the issue in a few words"/></div>
    <div><label className="block text-xs font-bold text-amber-200">What happened?</label><textarea
      aria-label="Ticket message" value={firstMessage} onChange={e=>setFirstMessage(e.target.value)} maxLength={2000} rows={5}
      className="mt-2 w-full rounded-lg border border-white/20 bg-[#0b101a] p-3 text-sm text-white"
      placeholder="Include game name, approximate time and a description. Never share passwords or private keys."/></div>
    <button onClick={()=>void open()} disabled={busy||subject.trim().length<3||!firstMessage.trim()}
     className="rounded-lg bg-amber-300 px-5 py-3 text-sm font-bold text-black disabled:opacity-40">Submit ticket</button>
   </section>}
   <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
    <aside className="rounded-2xl border border-[#2f3342] bg-[#171b26]">
     <h2 className="border-b border-white/10 p-4 font-semibold">Your tickets</h2>
     <div className="max-h-[600px] overflow-y-auto">
      {loading?<p className="p-5 text-sm text-[#a9aec0]">Loading your tickets…</p>:tickets.length?tickets.map(t=><button
       type="button" onClick={()=>{setShowCreate(false);setParams({ticket:t.id});setSuccess('');}} key={t.id}
       className={'block w-full border-b border-white/10 p-4 text-left hover:bg-white/5 '+(selected===t.id?'bg-amber-300/10':'')}>
       <div className="truncate text-sm font-semibold">{t.subject}</div>
       <div className="mt-2 text-xs capitalize text-amber-200">{t.status?.replaceAll('_',' ')}</div>
       <div className="mt-1 text-xs text-[#969cae]">{when(t.updated_at)}</div>
      </button>):<p className="p-5 text-sm text-[#a2a5b6]">No support tickets yet.</p>}
     </div>
    </aside>
    <section className="min-h-[360px] rounded-2xl border border-[#2f3342] bg-[#171b26]">
     {!selected?<div className="flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
      <MessageCircle size={38} className="text-amber-200"/><h2 className="mt-4 text-lg font-bold">Select a ticket or create one</h2>
      <p className="mt-2 text-sm text-[#9fa5b6]">Replies from our support team will appear here.</p>
     </div>:<div>
      <div className="border-b border-white/10 p-5">
       <button onClick={()=>setParams({})} className="mb-3 flex items-center gap-2 text-xs text-amber-200"><ArrowLeft size={14}/> All tickets</button>
       <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-words font-serif text-xl font-bold">{ticket?.subject||'Loading ticket…'}</h2><span className="text-xs uppercase text-amber-200">{ticket?.status?.replaceAll('_',' ')}</span></div>
      </div>
      <div className="max-h-[380px] min-h-[190px] space-y-4 overflow-y-auto p-5">
       {messages.length?messages.map(m=><div key={m.id} className={'max-w-[95%] rounded-xl border p-4 '+(m.sender_kind==='staff'?'mr-auto border-[#4e6383] bg-[#233046]':'ml-auto border-amber-300/30 bg-amber-300/10')}>
        <div className="mb-2 flex justify-between gap-2 text-xs"><span className="font-bold text-amber-200">{m.sender_kind==='staff'?'Support team':'You'}</span><span className="text-[#9da3b5]">{when(m.created_at)}</span></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{m.body}</p>
       </div>):<p className="text-sm text-[#9298a9]">Loading messages or no messages available.</p>}
      </div>
      <div className="border-t border-white/10 p-5">
       <textarea aria-label="Reply to support" value={reply} onChange={e=>setReply(e.target.value)} rows={4} maxLength={2000}
        disabled={!ticket||ticket.status==='closed'||busy}
        placeholder={ticket?.status==='closed'?'This ticket is closed. Open a new ticket for further support.':'Add more details or reply to support…'}
        className="w-full rounded-lg border border-white/20 bg-[#0a0f19] p-3 text-sm text-white disabled:opacity-50"/>
       <div className="mt-3 flex justify-end"><button disabled={!ticket||ticket.status==='closed'||!reply.trim()||busy}
        onClick={()=>void send()} className="flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"><Send size={15}/> Send message</button></div>
      </div>
     </div>}
    </section>
   </div>
  </div>
 </div>;
}
