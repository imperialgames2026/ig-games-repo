import React, {useCallback, useEffect, useState} from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { BookOpen, Clock, ShieldCheck } from 'lucide-react';

/** Educational study is ONLY available from this completed-hand directory.
 * This page cannot submit free-form or in-progress hands to an AI service.
 * Analysis credits and backend generation remain disabled until audited.
 */
export default function PastPlayedHands(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState(null);
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   try {
     const {data:{user},error:authError}=await supabase.auth.getUser();
     if(authError||!user)throw Error('Sign in to view your completed hands.');
     const {data,error:e}=await supabase.from('ig_poker_completed_hands')
       .select('id,table_id,hand_no,variant,completed_at,hand_summary')
       .eq('player_user_id',user.id).order('completed_at',{ascending:false}).limit(50);
     if(e)throw e;setRows(data||[]);
   }catch(e){setError(e.message||'Unable to load hand history.');}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 return <main className="min-h-screen bg-[#0a0612] px-4 py-10 text-white">
   <div className="mx-auto max-w-4xl space-y-5">
     <Link to="/PokerLobby" className="text-amber-300 hover:underline">← Poker lobby</Link>
     <header><p className="flex items-center gap-2 text-amber-300 uppercase tracking-wide text-sm"><BookOpen size={18}/> Imperial Poker Academy</p><h1 className="text-3xl font-black mt-2">Past Played Hands</h1><p className="text-slate-300 mt-2">Review your completed hands. AI coaching will be available only for verified hands saved here, never during gameplay.</p></header>
     <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><ShieldCheck className="inline mr-2" size={18}/> Staging only · AI analysis and paid review credits are not activated. No live hand assistance.</div>
     <button onClick={load} disabled={loading} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50">Refresh history</button>
     {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">{error}</p>}
     {loading?<p role="status">Loading completed hands…</p>:rows.length===0?<section className="rounded-xl border border-white/10 bg-[#191529] p-7"><h2 className="font-bold text-xl">No archived hands yet</h2><p className="text-slate-300 mt-2">Completed hand records will appear here after the server settlement archive is connected. Until then, analysis requests remain unavailable.</p></section>:
       <div className="grid gap-3">{rows.map(h=><article key={h.id} className="rounded-xl border border-white/10 bg-[#191529] p-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <div><h2 className="font-semibold capitalize">{h.variant} · Hand #{h.hand_no}</h2><p className="text-sm text-slate-400 flex items-center gap-2"><Clock size={14}/>{new Date(h.completed_at).toLocaleString()}</p></div>
           <button onClick={()=>setSelected(selected===h.id?null:h.id)} aria-expanded={selected===h.id} className="rounded-lg border border-white/20 px-4 py-2">{selected===h.id?'Hide hand':'View hand'}</button>
         </div>
         {selected===h.id&&<div className="mt-4 border-t border-white/10 pt-4"><p className="text-sm text-slate-300">Server-archived hand summary:</p><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-sm">{JSON.stringify(h.hand_summary,null,2)}</pre><p className="text-amber-200 text-sm mt-3">AI review is coming after settlement verification and credit accounting are complete.</p></div>}
       </article>)}</div>}
   </div>
 </main>;
}
