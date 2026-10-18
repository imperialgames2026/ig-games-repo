import React,{useState} from 'react';
import {Search,UsersRound,ShieldCheck,UserRoundX} from 'lucide-react';
import CommandCenterDataView,{DataTable,Status,dt,fmt} from '@/components/admin/CommandCenterDataView';
export default function AdminUsers(){
 const [search,setSearch]=useState('');
 return <CommandCenterDataView action="players" title="Player management" kicker="PLAYER OPERATIONS" subtitle="Review player records, identity status and exclusions. Sensitive account changes remain protected by backend permissions.">
 {data=>{
  const players=data.players||[],q=search.trim().toLowerCase(),filtered=players.filter(p=>[p.email,p.display_name,p.full_name,p.id].some(v=>String(v||'').toLowerCase().includes(q)));
  return <div className="space-y-6">
   <div className="grid gap-4 sm:grid-cols-3">
    <div className="rounded-2xl border border-[#37394b] bg-[#171b27] p-5"><div className="flex items-center gap-2 text-[#9abde8]"><UsersRound size={18}/> Recent player records</div><p className="mt-4 text-3xl font-black text-white">{fmt(players.length)}</p><p className="mt-2 text-xs text-[#9599ae]">Latest 60 • Total in system: {fmt(data.total)}</p></div>
    <div className="rounded-2xl border border-[#37394b] bg-[#171b27] p-5"><div className="flex items-center gap-2 text-[#abd7bb]"><ShieldCheck size={18}/> KYC approved (shown)</div><p className="mt-4 text-3xl font-black text-white">{fmt(players.filter(x=>x.kyc_status==='approved').length)}</p><p className="mt-2 text-xs text-[#9599ae]">Count within displayed records</p></div>
    <div className="rounded-2xl border border-[#37394b] bg-[#171b27] p-5"><div className="flex items-center gap-2 text-[#efb0b4]"><UserRoundX size={18}/> Excluded (shown)</div><p className="mt-4 text-3xl font-black text-white">{fmt(players.filter(x=>x.is_excluded).length)}</p><p className="mt-2 text-xs text-[#9599ae]">Count within displayed records</p></div>
   </div>
   <div className="relative max-w-lg"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#898d9f]"/><input aria-label="Search displayed players" placeholder="Search displayed players by name, email or ID…" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-xl border border-[#434657] bg-[#161a25] py-3 pl-11 pr-4 text-sm text-white placeholder:text-[#898b9b] focus:border-amber-300/50 focus:outline-none"/></div>
   <DataTable headings={['Player','Account ID','KYC status','Account','Joined']} rows={filtered} render={p=>[
    <div><div className="font-semibold text-white">{p.display_name||p.full_name||'Unnamed player'}</div><div className="mt-1 text-xs text-[#9da0b3]">{p.email||'No email shown'}</div></div>,
    <span title={p.id} className="font-mono text-xs text-[#b9b9ca]">{p.id?.slice(0,8)}…</span>,
    <Status value={p.kyc_status||'pending'}/>,
    <Status value={p.is_excluded?'excluded':'active'}/>,dt(p.created_at)
   ]} empty={q?'No displayed players match this search.':'No player records found.'}/>
   <p className="text-xs text-[#8d91a5]">Only the most recent 60 profiles are loaded. Search filters this page; it is not a global people search.</p>
  </div>;
 }}
 </CommandCenterDataView>;
}
