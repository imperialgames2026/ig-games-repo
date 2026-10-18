import React,{useState} from 'react';
import {LifeBuoy,Search,Clock3,ShieldAlert} from 'lucide-react';
import CommandCenterDataView,{DataTable,Status,dt,fmt} from '@/components/admin/CommandCenterDataView';
export default function AdminSupport(){
 const [search,setSearch]=useState('');
 return <CommandCenterDataView title="Customer support" action="support" kicker="PLAYER EXPERIENCE" subtitle="A consolidated queue of customer cases from the Supabase support tables. AI support suggestions are not activated.">
 {data=>{
  const rows=data.tickets||[],q=search.toLowerCase().trim();
  const filtered=rows.filter(t=>[t.subject,t.status,t.user_id].some(x=>String(x||'').toLowerCase().includes(q)));
  return <div className="space-y-6">
   <div className="grid gap-4 sm:grid-cols-3">
    {[
     {icon:LifeBuoy,label:'Tickets shown',value:rows.length,color:'text-[#afc4ef]'},
     {icon:Clock3,label:'Open cases (shown)',value:rows.filter(x=>x.status==='open').length,color:'text-[#f0c27d]'},
     {icon:ShieldAlert,label:'Unassigned (shown)',value:rows.filter(x=>!x.assigned_to).length,color:'text-[#e5aab7]'}
    ].map(x=><div key={x.label} className="rounded-2xl border border-[#353847] bg-[#171b26] p-5"><p className={'flex items-center gap-2 text-sm font-semibold '+x.color}><x.icon size={17}/>{x.label}</p><div className="mt-4 text-3xl font-black text-white">{fmt(x.value)}</div></div>)}
   </div>
   <div className="relative max-w-lg"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d8fa0]"/><input aria-label="Search displayed support cases" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter cases by subject, status or player ID…" className="w-full rounded-xl border border-[#434657] bg-[#161a25] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#8f91a4] focus:border-amber-300 focus:outline-none"/></div>
   <DataTable headings={['Subject','Ticket','Player','Status','Owner','Last changed']} rows={filtered} render={t=>[
    <span className="font-semibold text-white">{t.subject}</span>,
    <span className="font-mono text-xs text-[#adaebe]" title={t.id}>{t.id?.slice(0,8)}…</span>,
    <span className="font-mono text-xs text-[#adaebe]" title={t.user_id}>{t.user_id?.slice(0,8)}…</span>,
    <Status value={t.status}/>,t.assigned_to?'Assigned':'Unassigned',dt(t.updated_at)
   ]}/>
   <div className="rounded-xl border border-[#534127] bg-[#211c18] p-5 text-sm text-[#e2cdaf]">AI customer service and secure reply workflows are planned integrations. This screen does not send replies or change ticket ownership yet.</div>
  </div>;
 }}
 </CommandCenterDataView>;
}
