import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import './slot-practice.css';

export default function StandaloneSlotPracticePage({SlotComponent,title}){
 return <main className="ig-slot-screen bg-[#0A0612] text-white">
  <div className="ig-slot-shell mx-auto flex h-full max-w-6xl flex-col px-3 py-3">
   <header className="ig-slot-topbar mb-2 flex items-center justify-between gap-3">
    <Link to="/Games" className="flex items-center gap-2 text-sm font-semibold text-amber-300"><ArrowLeft className="h-4 w-4"/>Games</Link>
    <div className="flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-950/50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sky-200">
     <ShieldCheck className="h-3.5 w-3.5"/> {title} · Supabase practice only
    </div>
   </header>
   <div className="ig-slot-cabinet-wrap min-h-0 flex-1">
    <SlotComponent currency="PRACTICE"/>
   </div>
  </div>
 </main>;
}
