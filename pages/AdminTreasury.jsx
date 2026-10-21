import React from 'react';
import {Link} from 'react-router-dom';
import {Landmark,LockKeyhole} from 'lucide-react';
import CommandCenterDataView,{DataTable,Status,dt} from '@/components/admin/CommandCenterDataView';
export default function AdminTreasury(){
 return <CommandCenterDataView title="Treasury & custody readiness" action="treasury" kicker="CRYPTO INFRASTRUCTURE" subtitle="Fireblocks sandbox account tracking, signed webhook quarantine and treasury provider readiness—no signing or real transfers.">
 {data=><div className="space-y-7">
  <div className="grid gap-4 md:grid-cols-2">
   <div className="rounded-2xl border border-[#4a4734] bg-[linear-gradient(130deg,#27251c,#171b22)] p-6"><div className="flex items-center gap-3 text-[#e1c28b]"><Landmark size={20}/><h2 className="font-bold">Fireblocks sandbox</h2></div><p className="mt-4 text-sm leading-7 text-[#c3bbad]">Provisioning is isolated to the sandbox and requires credentials and verified asset IDs. Sandbox records are not real funded wallets, and no automatic disbursements are enabled.</p><p className="mt-3 text-xs text-[#a19c8b]">Sandbox vault records displayed: {data.vaults?.length??0}</p></div>
   <div className="rounded-2xl border border-[#365244] bg-[#16231f] p-6"><div className="flex items-center gap-3 text-[#b4dec6]"><LockKeyhole size={20}/><h2 className="font-bold">Custody signing boundary</h2></div><p className="mt-4 text-sm leading-7 text-[#b3c6ba]">Private keys remain outside the browser. Real-value withdrawal signing, sweeping, liquidity and hot-wallet execution are not made available here.</p></div>
  </div>
  <section><h2 className="mb-4 font-serif text-xl font-bold text-white">Provider integration readiness</h2>
   <DataTable headings={['Provider','Operational approval','Real funds enabled','Updated']} rows={data.providers||[]} render={p=>[
    p.provider_name||p.provider_id,<Status key="approval" value={p.operationally_approved?'approved':'not approved'}/>,
    <Status key="funds" value={p.real_funds_enabled?'active':'disabled'}/>,dt(p.updated_at)
   ]}/>
  </section>
  <section><h2 className="mb-4 font-serif text-xl font-bold text-white">Sandbox vault records</h2>
   <DataTable headings={['Player','Fireblocks vault ID','State','Created']} rows={data.vaults||[]} render={v=>[
    <span key="player" className="font-mono text-xs" title={v.user_id}>{v.user_id?.slice(0,8)}…</span>,
    v.vault_id||'Not provisioned',<Status key="state" value={v.status}/>,dt(v.created_at)
   ]}/>
  </section>
  <section><h2 className="mb-4 font-serif text-xl font-bold text-white">Quarantined sandbox webhooks</h2>
   <DataTable headings={['Notification','Type','State','Received']} rows={data.webhooks||[]} render={w=>[
    <span key="notification" className="font-mono text-xs" title={w.notification_id}>{w.notification_id?.slice(0,8)}…</span>,
    w.event_type,<Status key="state" value={w.processing_status}/>,dt(w.received_at)
   ]}/>
  </section>
  <p className="text-xs leading-6 text-[#9b9eb0]">Reconciliation, AML screening, independently signed custody withdrawals and per-user deposit assignment must pass sandbox testing and licensing reviews before activation. <Link className="text-amber-200 underline" to="/AdminWallets">Inspect transaction observations</Link>.</p>
 </div>}
 </CommandCenterDataView>;
}
