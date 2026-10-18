import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {RefreshCcw,AlertTriangle,ShieldCheck} from 'lucide-react';
export const dt=value=>{
 if(!value)return '—';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString();
};
export const fmt=value=>value===null||value===undefined?'—':Number(value).toLocaleString();
export function Status({value}){
 const status=String(value||'unknown').toLowerCase();
 const cls=['approved','complete','completed','paid','verified','closed','running','provisioned','active'].includes(status)
  ?'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
  :['rejected','failed','blocked','excluded','cancelled'].includes(status)
   ?'border-red-400/25 bg-red-400/10 text-red-200'
   :['pending','submitted','open','quarantined','under_review','reserved','waiting'].includes(status)
    ?'border-amber-300/25 bg-amber-300/10 text-amber-200'
    :'border-white/15 bg-white/5 text-[#d0d1dc]';
 return <span className={'inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize '+cls}>{status.replaceAll('_',' ')}</span>;
}
export function DataTable({headings,rows,render,empty='No records currently available.'}){
 return <div className="overflow-hidden rounded-2xl border border-[#2b2f3c] bg-[#131721]">
  <div className="overflow-x-auto">
   <table className="min-w-full text-left text-sm"><thead className="bg-[#1e222d] text-xs font-bold uppercase tracking-[.08em] text-[#a6a9bb]"><tr>{headings.map(h=><th className="px-5 py-4" key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.length?rows.map((row,i)=><tr key={row.id||row.user_id||row.notification_id||i} className="border-t border-white/[.06] text-[#d7dae8] hover:bg-white/[.03]">{render(row).map((cell,index)=><td key={index} className="whitespace-nowrap px-5 py-4">{cell}</td>)}</tr>)
      :<tr><td className="px-5 py-10 text-center text-[#989bac]" colSpan={headings.length}>{empty}</td></tr>}</tbody>
   </table>
  </div>
 </div>;
}
export default function CommandCenterDataView({title,kicker='OPERATOR MODULE',subtitle,action,children}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:next,error:e}=await supabase.functions.invoke('ig-admin-command-center',{body:{action}});
   if(e||next?.error)throw Error(next?.error||'Unable to retrieve live data');
   setData(next);
  }catch(e){setError(e.message||'Unable to load');setData(null)}finally{setLoading(false)}
 },[action]);
 useEffect(()=>{void load()},[load]);
 return <div className="space-y-7">
  <div className="flex flex-wrap items-end justify-between gap-5">
   <div><p className="text-[10px] font-bold tracking-[0.22em] text-[#cda969]">{kicker}</p><h1 className="mt-2 font-serif text-3xl font-bold text-white sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#a8abbc]">{subtitle}</p></div>
   <button onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border border-[#4a4c5c] bg-[#1a1e28] px-4 py-3 text-sm font-semibold text-white hover:border-amber-300/50 disabled:opacity-50"><RefreshCcw size={16} className={loading?'animate-spin':''}/>Refresh data</button>
  </div>
  <div className="flex items-center gap-2 rounded-xl border border-[#36433b] bg-[#18221f] px-4 py-3 text-xs font-medium text-[#aed5b6]"><ShieldCheck size={16}/> Read-only audited operator view. No wallet credits, crypto signing or unreviewed payouts can be triggered here.</div>
  {loading&&<div role="status" className="rounded-xl border border-white/10 bg-[#171a24] p-5 text-sm text-[#bfc1ce]">Loading verified Supabase data…</div>}
  {error&&<div role="alert" className="flex items-start gap-3 rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-sm text-red-200"><AlertTriangle size={18}/><div>Unable to load this operator module: {error}. No synthetic records are displayed.</div></div>}
  {data&&children(data)}
 </div>;
}
