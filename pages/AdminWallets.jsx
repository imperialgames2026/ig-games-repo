import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight,ArrowDownLeft,ShieldAlert} from 'lucide-react';
import CommandCenterDataView,{DataTable,Status,dt,fmt} from '@/components/admin/CommandCenterDataView';
export default function AdminWallets(){
 return <CommandCenterDataView title="Wallets & transfer oversight" action="operations" kicker="FINANCIAL OPERATIONS" subtitle="Inspect transaction records without authorizing credits, transfers, payouts or custody signing.">
 {data=>{
  const withdrawals=data.withdrawals||[],deposits=data.deposits||[];
  return <div className="space-y-7">
   <div className="grid gap-4 sm:grid-cols-3">
    <div className="rounded-2xl border border-[#56412b] bg-[#221d1c] p-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#f1cd92]"><ArrowUpRight size={18}/> Pending withdrawal records</p><p className="mt-4 text-3xl font-black text-white">{fmt(withdrawals.filter(x=>x.status==='pending').length)}</p><p className="mt-2 text-xs text-[#ad9d9c]">Among 40 latest records, not global totals</p></div>
    <div className="rounded-2xl border border-[#354e47] bg-[#15241e] p-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#9bd6b7]"><ArrowDownLeft size={18}/> Uncredited deposit observations</p><p className="mt-4 text-3xl font-black text-white">{fmt(deposits.filter(x=>x.credit_status!=='credited').length)}</p><p className="mt-2 text-xs text-[#a5aea9]">Among 40 latest records, no confirmation of funds</p></div>
    <div className="rounded-2xl border border-[#44455a] bg-[#171a27] p-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#b7b8ee]"><ShieldAlert size={18}/> Flagged withdrawals (shown)</p><p className="mt-4 text-3xl font-black text-white">{fmt(withdrawals.filter(x=>x.audit_flag).length)}</p><p className="mt-2 text-xs text-[#9699aa]">For manual risk review</p></div>
   </div>
   <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl font-bold text-white">Withdrawal requests</h2><span className="text-xs text-[#9598ac]">Latest 40 • Read only</span></div>
    <DataTable headings={['Request','Player ID','Requested amount','Method','State','Created']} rows={withdrawals} render={w=>[
     <span className="font-mono text-xs text-[#a7adbd]" title={w.id}>{w.id?.slice(0,8)}…</span>,
     <span className="font-mono text-xs text-[#a7adbd]" title={w.user_id}>{w.user_id?.slice(0,8)}…</span>,
     <span className="font-semibold text-white">{String(w.amount??'—')} <span className="font-normal text-xs text-[#a0a1b1]">units (unverified)</span></span>,w.payment_method||'—',
     <Status value={w.audit_flag?'flagged':w.status}/>,dt(w.created_at)
    ]}/>
   </div>
   <div><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl font-bold text-white">Deposit observations</h2><span className="text-xs text-[#9598ac]">Latest 40 • Not settled balances</span></div>
    <DataTable headings={['Observed','Player','Network / asset','Confirmations','Credit state']} rows={deposits} render={d=>[
     dt(d.created_at),
     <span className="font-mono text-xs text-[#a7adbd]" title={d.user_id}>{d.user_id?.slice(0,8)}…</span>,
     <div className="font-semibold text-white">{d.network_id} <span className="text-[#adb0c0]">/ {d.asset_code}</span></div>,
     fmt(d.confirmations),<Status value={d.credit_status}/>
    ]}/>
   </div>
   <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 px-5 py-5 text-sm leading-7 text-[#d0c0aa]">The $2,500 Superadmin approval threshold and independent screening remain policy designs, not enabled automatic payments. Displayed amounts are unverified accounting units, not USD valuations. <Link to="/AdminTreasury" className="font-bold text-amber-200 underline">View custody readiness</Link>.</div>
  </div>;
 }}
 </CommandCenterDataView>;
}
