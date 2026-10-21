import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Crown,Gift,LockKeyhole} from 'lucide-react';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {createVipLevelSpins,VIP_WHEEL_STAGES} from '@/lib/vipLevelSpins';
const service=createVipLevelSpins(supabase);

export default function VIPRewardWheel(){
 const {user}=useAuth();
 const spins=useQuery({queryKey:['vip-level-spins',user?.id],queryFn:()=>service.list(user.id),enabled:!!user?.id&&!user.is_excluded,refetchInterval:30000,retry:1});
 return <section id="vip-reward-wheel" aria-labelledby="vip-wheel-title" className="space-y-5 rounded-2xl border border-white/10 bg-[#151022] p-5 sm:p-7 text-white">
  <header className="flex gap-3"><Crown className="mt-1 shrink-0 text-amber-300"/><div><h2 id="vip-wheel-title" className="text-2xl font-bold">VIP Reward Wheel</h2><p className="mt-2 text-sm text-slate-300">One spin for each VIP level reached, including your first spin at level 1. Each spin keeps the stage of the level that earned it.</p></div></header>
  {!user?<p>Sign in to view your saved spins.</p>:spins.error?<div role="alert" className="text-red-200">Your saved spins could not be loaded. <button className="underline" onClick={()=>void spins.refetch()}>Retry saved spins</button></div>:spins.isPending?<p>Loading saved spins…</p>:<p role="status" className="font-semibold text-amber-200">{spins.data.total} saved {spins.data.total===1?'spin':'spins'}</p>}
  <div className="grid gap-4 md:grid-cols-3">
   {VIP_WHEEL_STAGES.map(stage=><article key={stage.stage} aria-label={stage.name+' reward wheel'} className="rounded-xl border border-white/10 bg-black/20 p-5 text-center">
    <div aria-hidden="true" className={'mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20 bg-gradient-to-br '+stage.color}><Gift size={34}/></div>
    <h3 className="text-lg font-bold">{stage.name}</h3><p className="mt-1 text-sm text-slate-300">Levels {stage.minLevel}–{stage.maxLevel}</p>
    <p className="mt-3 font-semibold">{!spins.error&&spins.data?`${spins.data.stages[stage.stage]} saved spins`:'Saved spins unavailable'}</p>
    <p className="mt-2 text-xs text-slate-400">{stage.maxLevel-stage.minLevel+1} level rewards in this stage</p>
   </article>)}
  </div>
  <div className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"><LockKeyhole className="shrink-0" size={18}/><p>Wheel prizes are being finalized. Your earned spins are saved and will not be used until spinning is available. Practice rounds do not earn wager-based XP.</p></div>
  <button disabled className="rounded-lg border border-white/20 px-5 py-3 font-semibold text-slate-400">Spinning opens when prizes are ready</button>
  {spins.data?.rows.length>0&&!spins.error&&<details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold">Earned spin history</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Level</th><th className="p-2">Rank</th><th className="p-2">Wheel stage</th><th className="p-2">Earned</th></tr></thead><tbody>{spins.data.rows.map(row=><tr key={row.level} className="border-t border-white/10"><td className="p-2">{row.level}</td><th scope="row" className="p-2 font-medium">{row.level_name}</th><td className="p-2">{row.stage}</td><td className="p-2">{new Date(row.earned_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
