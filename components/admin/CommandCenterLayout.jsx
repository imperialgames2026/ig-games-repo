import React,{useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '@/lib/AuthContext';
import {
 LayoutDashboard,UsersRound,WalletCards,LifeBuoy,ShieldCheck,Trophy,
 FileClock,Landmark,Layers3,Settings2,ExternalLink,Menu,X,LogOut,
 ChevronRight,Activity,LockKeyhole
} from 'lucide-react';

const groups=[
 {title:'OPERATIONS',items:[
  {title:'Overview',to:'/Admin',icon:LayoutDashboard,description:'Live operator snapshot'},
  {title:'Players',to:'/AdminUsers',icon:UsersRound,description:'Player directory'},
  {title:'Wallets & transfers',to:'/AdminWallets',icon:WalletCards,description:'Deposit and withdrawal review'},
  {title:'Customer support',to:'/AdminSupport',icon:LifeBuoy,description:'Support ticket queue'},
 ]},
 {title:'GAMES & RISK',items:[
  {title:'Poker tournaments',to:'/SuperadminPokerTournaments',icon:Trophy,superadmin:true,description:'Prizes, seats and events'},
  {title:'Compliance',to:'/AdminKYC',icon:ShieldCheck,description:'KYC review queue'},
  {title:'Audit activity',to:'/AdminSweepstakesAudit',icon:FileClock,description:'Legacy record viewer'},
 ]},
 {title:'PLATFORM',items:[
  {title:'Treasury status',to:'/AdminTreasury',icon:Landmark,description:'Sandbox custody health'},
  {title:'IGT operations',to:'/AdminIGTSupply',icon:Layers3,superadmin:true,description:'Token controls'},
  {title:'Account security',to:'/OwnerKeyring',icon:LockKeyhole,superadmin:true,description:'Superadmin security'},
 ]}
];

function NavLinks({close,role}){
 const path=useLocation().pathname;
 return <nav aria-label="Command Center navigation" className="space-y-6 px-3 pb-8">
  {groups.map(group=><div key={group.title} className="space-y-1">
   <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.2em] text-[#77778c]">{group.title}</div>
   {group.items.filter(i=>!i.superadmin||role==='superadmin').map(item=>{
    const Icon=item.icon,active=path===item.to;
    return <Link key={item.to} to={item.to} onClick={close} aria-current={active?'page':undefined}
     className={'group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors '+(active?'border border-amber-300/25 bg-amber-400/10 text-amber-200':'border border-transparent text-[#a3a3b8] hover:bg-white/5 hover:text-white')}>
      <Icon size={18} className={active?'text-amber-300':'text-[#7e8095] group-hover:text-amber-200'}/>
      <span className="min-w-0 flex-1 text-[13px] font-semibold">{item.title}</span>
      {active&&<ChevronRight size={14} className="text-amber-300"/>}
     </Link>;
   })}
  </div>)}
  <Link to="/Games" onClick={close} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/70 hover:border-amber-200/40 hover:text-white">
   <ExternalLink size={16}/> Player-facing website
  </Link>
 </nav>;
}
export default function CommandCenterLayout({children}){
 const {user,logout}=useAuth(),[open,setOpen]=useState(false),[signingOut,setSigningOut]=useState(false);
 const name=user?.display_name||user?.full_name||user?.email||'Operator';
 const role=user?.role==='superadmin'?'Superadmin':'Administrator';
 const doLogout=async()=>{setSigningOut(true);try{await logout()}catch{setSigningOut(false)}};
 return <div className="min-h-screen bg-[#080a10] text-[#e8e9f1]">
  {open&&<button aria-label="Close menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-black/75 lg:hidden"/>}
  <aside className={'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-[#252736] bg-[#10121b] transition-transform duration-200 lg:translate-x-0 '+(open?'translate-x-0':'-translate-x-full')}>
   <div className="flex h-[98px] items-center justify-between border-b border-white/[0.06] px-5">
    <Link to="/Admin" onClick={()=>setOpen(false)} className="flex items-center gap-3">
     <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/40 bg-gradient-to-br from-[#e4be72] to-[#956128] font-serif text-xl font-black text-[#150f09] shadow-[0_0_22px_rgba(236,185,91,0.14)]">IG</div>
     <div><div className="text-[14px] font-black uppercase tracking-[0.10em] text-white">Imperial Games</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.20em] text-[#d2a85f]">Command Center</div>
     </div>
    </Link>
    <button className="rounded-md p-2 text-white/60 lg:hidden" aria-label="Close navigation" onClick={()=>setOpen(false)}><X size={20}/></button>
   </div>
   <div className="scrollbar-thin mt-5 flex-1 overflow-y-auto"><NavLinks close={()=>setOpen(false)} role={user?.role}/></div>
   <div className="border-t border-white/[0.08] px-4 py-4">
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#405041] bg-[#18251d] px-3 py-2 text-xs font-semibold text-[#a2d8ac]"><Activity size={14}/> Staging financial controls</div>
    <button onClick={doLogout} disabled={signingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#a9aabe] hover:bg-white/5 hover:text-white"><LogOut size={16}/>{signingOut?'Signing out…':'Sign out'}</button>
   </div>
  </aside>
  <div className="min-h-screen lg:pl-[272px]">
   <header className="sticky top-0 z-30 flex h-[78px] items-center justify-between border-b border-[#262736] bg-[#0d0f17]/95 px-4 backdrop-blur-xl sm:px-8">
    <div className="flex items-center gap-4">
     <button aria-label="Open navigation" className="rounded-lg border border-white/10 p-2 text-white lg:hidden" onClick={()=>setOpen(true)}><Menu size={20}/></button>
     <div className="hidden h-9 w-9 items-center justify-center rounded-lg border border-amber-400/15 bg-amber-400/10 text-amber-200 sm:flex"><Settings2 size={18}/></div>
     <div><div className="text-sm font-semibold text-white">Operator workspace</div>
      <div className="text-xs text-[#9091a6]">Role-controlled • Audit-focused • Practice-only financial rails</div></div>
    </div>
    <div className="flex items-center gap-3">
     <div className="hidden text-right sm:block"><div className="max-w-48 truncate text-sm font-semibold text-[#edeef7]">{name}</div><div className="text-xs text-[#ba9554]">{role}</div></div>
     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300/25 bg-[#2a241b] text-sm font-bold text-amber-200">{String(name).slice(0,1).toUpperCase()}</div>
    </div>
   </header>
   <main id="main-content" className="mx-auto w-full max-w-[1660px] px-4 py-7 sm:px-8 sm:py-9">{children}</main>
   <footer className="mx-auto max-w-[1660px] border-t border-white/[0.06] px-4 py-4 text-[11px] text-[#77798c] sm:px-8">Imperial Games • Operator controls • Financial transactions are not enabled by this dashboard</footer>
  </div>
 </div>;
}
