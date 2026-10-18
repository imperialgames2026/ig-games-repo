import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';
import {UsersRound,WalletCards,Trophy,LifeBuoy,ArrowUpRight,RefreshCcw,
 ShieldAlert,Clock3,Activity,Landmark,ArrowRight,ShieldCheck,CheckCircle2} from 'lucide-react';

const number=v=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US').format(v);
const date=v=>v?new Date(v).toLocaleString():'—';
const styles={
 amber:'from-[#2c2418] to-[#19181a] border-[#5e4829] text-[#f6cb80]',
 blue:'from-[#1a2532] to-[#141923] border-[#334866] text-[#9bc9ff]',
 green:'from-[#1c2d24] to-[#141c1b] border-[#30513e] text-[#9ee5ba]',
 rose:'from-[#2c1b25] to-[#191721] border-[#593444] text-[#ffadbc]'
};
function SummaryTile({label,value,icon:Icon,tone='amber',to,sub}){
 return <Link to={to} className={'group block rounded-2xl border bg-gradient-to-br p-5 shadow-[0_14px_32px_rgba(0,0,0,.14)] transition hover:-translate-y-0.5 hover:border-[#d4aa64] '+styles[tone]}>
  <div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-current/15 bg-black/20"><Icon size={20}/></span><ArrowUpRight size={17} className="opacity-50 group-hover:opacity-100"/></div>
  <div className="mt-6 text-[31px] font-black leading-none tracking-tight text-white">{number(value)}</div>
  <div className="mt-2 text-sm font-semibold text-white/85">{label}</div>
  <div className="mt-2 text-xs text-[#9fa0af]">{sub}</div>
 </Link>;
}
function Panel({title,description,icon:Icon,to,children}){
 return <section className="overflow-hidden rounded-2xl border border-[#2a2c39] bg-[#12151f]">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-5">
   <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[#e4b76c]"><Icon size={19}/></span><div><h2 className="text-[15px] font-bold text-white">{title}</h2><p className="mt-1 text-xs text-[#9396a8]">{description}</p></div></div>
   <Link to={to} className="flex items-center gap-2 text-xs font-semibold text-amber-200 hover:text-amber-100">Open module <ArrowUpRight size={15}/></Link>
  </div>
  {children}
 </section>;
}
export default function Admin(){
 const {user}=useAuth(),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:result,error:e}=await supabase.functions.invoke('ig-admin-command-center',{body:{action:'overview'}});
   if(e||result?.error)throw Error(result?.error||'Operator summary could not be loaded');
   setData(result);
  }catch(e){setError(e?.message||'Unable to load');setData(null)}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 const m=data?.metrics||{};
 return <div className="space-y-7">
  <section className="relative overflow-hidden rounded-[26px] border border-[#544024] bg-[radial-gradient(circle_at_88%_5%,rgba(227,166,75,.24),transparent_38%),linear-gradient(125deg,#24202a,#141720_60%,#17161b)] px-6 py-8 sm:px-9 sm:py-10">
   <div className="pointer-events-none absolute -right-5 -top-16 hidden select-none font-serif text-[240px] font-black leading-none text-amber-200/[.04] md:block" aria-hidden="true">IG</div>
   <div className="relative">
    <div className="mb-5 flex flex-wrap items-center gap-3"><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">Imperial Operations</span><span className="flex items-center gap-2 text-xs text-[#bac0c9]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> Supabase staging / practice</span></div>
    <h1 className="max-w-3xl font-serif text-3xl font-bold tracking-tight text-[#faf6ed] sm:text-5xl">Welcome to your<br/><span className="text-[#e5b66b]">Command Center.</span></h1>
    <p className="mt-4 max-w-xl text-sm leading-7 text-[#b9bac9]">One place to review players, support, poker operations and treasury readiness. Actions involving real funds remain gated and unavailable.</p>
    <div className="mt-7 flex flex-wrap gap-3">
     <Link to="/SuperadminPokerTournaments" className={'inline-flex items-center gap-2 rounded-xl bg-[#e7bd77] px-5 py-3 text-xs font-black text-[#20160c] transition hover:bg-[#f9d99d] '+(user?.role==='superadmin'?'':'hidden')}>Manage poker tournaments <ArrowUpRight size={16}/></Link>
     <Link to="/AdminWallets" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-xs font-bold text-white hover:border-amber-200/50">View transaction queues <ArrowRight size={16}/></Link>
    </div>
   </div>
  </section>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[10px] font-bold tracking-[0.18em] text-[#bb9659]">OPERATIONS SNAPSHOT</p>
    <h2 className="mt-1 text-xl font-bold text-white">Today's control room</h2></div>
   <div className="flex flex-wrap items-center gap-3">
    <span className="text-xs text-[#818596]">{loading?'Loading secure data…':data?.asOf?'Refreshed '+date(data.asOf):'No fresh metrics loaded'}</span>
    <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#444654] bg-[#1a1d28] px-4 py-2.5 text-xs font-bold text-white hover:border-amber-200/60 disabled:opacity-50"><RefreshCcw size={14} className={loading?'animate-spin':''}/> Refresh</button>
   </div>
  </div>
  {error&&<div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200">Secure metrics are unavailable: {error}. No numbers have been estimated.</div>}
  {data?.incomplete?.length>0&&<div role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-5 py-4 text-xs text-amber-100">Some counters could not be loaded: {data.incomplete.join(', ')}. Those values are displayed as —, not zero.</div>}
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   <SummaryTile label="Registered players" value={m.players} sub="Actual profile records" icon={UsersRound} to="/AdminUsers" tone="blue"/>
   <SummaryTile label="Open support tickets" value={m.openTickets} sub="Cases requiring attention" icon={LifeBuoy} to="/AdminSupport" tone="amber"/>
   <SummaryTile label="Pending withdrawal requests" value={m.pendingWithdrawals} sub="Review only • no auto-payouts" icon={WalletCards} to="/AdminWallets" tone="rose"/>
   <SummaryTile label="Running poker events" value={m.activePokerEvents} sub="Existing event-engine records" icon={Trophy} to="/SuperadminPokerTournaments" tone="green"/>
  </div>
  <div className="grid gap-4 md:grid-cols-3">
   <Link to="/AdminWallets" className="group flex items-center justify-between rounded-2xl border border-[#2c2c3a] bg-[#151822] p-5 hover:border-amber-300/50"><div><p className="text-xs font-semibold text-[#9b9eaf]">Uncredited deposit observations</p><p className="mt-1 text-2xl font-black text-white">{number(m.uncreditedObservations)}</p></div><ShieldAlert size={23} className="text-[#e4b76c]"/></Link>
   <Link to="/AdminKYC" className="group flex items-center justify-between rounded-2xl border border-[#2c2c3a] bg-[#151822] p-5 hover:border-amber-300/50"><div><p className="text-xs font-semibold text-[#9b9eaf]">Submitted KYC profiles</p><p className="mt-1 text-2xl font-black text-white">{number(m.pendingKyc)}</p></div><ShieldCheck size={23} className="text-[#87b9cc]"/></Link>
   <Link to="/AdminTreasury" className="group flex items-center justify-between rounded-2xl border border-[#2c2c3a] bg-[#151822] p-5 hover:border-amber-300/50"><div><p className="text-xs font-semibold text-[#9b9eaf]">Fireblocks sandbox vault records</p><p className="mt-1 text-2xl font-black text-white">{number(m.sandboxVaults)}</p></div><Landmark size={23} className="text-[#a9a4db]"/></Link>
  </div>
  <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
   <Panel title="Recent poker events" description="Recorded tournament lifecycle • not simulated" icon={Trophy} to="/SuperadminPokerTournaments">
    {data?.events?.length?<div>{data.events.map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] px-5 py-4 last:border-0"><div><p className="text-sm font-semibold text-white">{e.name}</p><p className="mt-1 text-xs text-[#9598ac]">{e.format} · {date(e.created_at)}</p></div><span className="rounded-lg border border-white/15 px-3 py-1 text-xs capitalize text-[#d7c09a]">{e.status}</span></div>)}</div>
    :<div className="px-5 py-10 text-center text-sm text-[#9699ac]">{loading?'Loading events…':'No event records to display.'}</div>}
   </Panel>
   <Panel title="Customer service inbox" description="Newest support requests" icon={LifeBuoy} to="/AdminSupport">
    {data?.tickets?.length?<div>{data.tickets.map(t=><div key={t.id} className="flex items-center justify-between gap-3 border-b border-white/[.06] px-5 py-4 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{t.subject}</p><p className="mt-1 text-xs text-[#9598ac]">{date(t.created_at)}</p></div><span className="text-xs capitalize text-amber-200">{t.status}</span></div>)}</div>
    :<div className="px-5 py-10 text-center text-sm text-[#9699ac]">{loading?'Loading tickets…':'No ticket records to display.'}</div>}
   </Panel>
  </div>
  <div className="grid gap-4 md:grid-cols-2">
   <div className="rounded-2xl border border-[#34433c] bg-[#131d1b] px-6 py-5"><div className="flex items-center gap-2 text-[#a7d5b9]"><CheckCircle2 size={18}/><h3 className="text-sm font-bold">Role-protected workspace</h3></div><p className="mt-3 text-sm leading-6 text-[#a5b9b0]">Summary data is returned by a signed-in, server-authorized Supabase endpoint. Roles are independently checked on every request.</p></div>
   <div className="rounded-2xl border border-[#55422c] bg-[#211d19] px-6 py-5"><div className="flex items-center gap-2 text-[#f3cc91]"><Clock3 size={18}/><h3 className="text-sm font-bold">Financial enablement: off</h3></div><p className="mt-3 text-sm leading-6 text-[#c2b3a1]">Crypto custody, transfers and prize settlement are not activated by this dashboard. Fireblocks is a sandbox integration, not a live treasury.</p></div>
  </div>
 </div>;
}
