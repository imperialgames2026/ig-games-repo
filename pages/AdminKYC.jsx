import React from 'react';
import KycReviewer from '@/components/kyc/KycReviewer';
import {ShieldCheck,FileClock} from 'lucide-react';
import CommandCenterDataView,{DataTable,Status,dt} from '@/components/admin/CommandCenterDataView';
export default function AdminKYC(){
 return <div className="space-y-8"><KycReviewer/><CommandCenterDataView title="Compliance & risk" action="compliance" kicker="TRUST & SAFETY" subtitle="Review independent KYC verification states and administrative audit activity. Screening must happen before any real-value transfers.">
 {data=><div className="space-y-7">
  <div className="rounded-xl border border-[#62452d] bg-[#241d19] px-5 py-4 text-sm text-[#e8c8a4]">Identity status is informative only. Approval workflows, sanctions screening, location checks and transaction risk clearance are separate mandatory controls. No real-money rails are active.</div>
  <div><h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-white"><ShieldCheck size={20} className="text-amber-200"/> Verification records</h2>
   <DataTable headings={['Player','Provider state','Document','Selfie','Last updated']} rows={data.kyc||[]} render={k=>[
    <span className="font-mono text-xs" title={k.user_id}>{k.user_id?.slice(0,8)}…</span>,
    <Status value={k.status}/>,<Status value={k.document_verified?'verified':'not verified'}/>,
    <Status value={k.selfie_verified?'verified':'not verified'}/>,dt(k.updated_at)
   ]}/>
  </div>
  <div><h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-white"><FileClock size={20} className="text-amber-200"/> Recent operator audit entries</h2>
   <DataTable headings={['Action','Reason','Occurred']} rows={data.audit||[]} render={a=>[
    <span className="font-semibold text-white">{a.action}</span>,a.reason||'—',dt(a.created_at)
   ]}/>
  </div>
 </div>}
 </CommandCenterDataView></div>;
}