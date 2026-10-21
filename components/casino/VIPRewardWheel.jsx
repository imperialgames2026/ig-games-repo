import React,{useCallback,useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Crown,Gift,LockKeyhole} from 'lucide-react';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {createVipLevelSpins,VIP_WHEEL_STAGES} from '@/lib/vipLevelSpins';
import {createVipWheelDraw,availableVipSpins,pendingWheelKey,readPendingWheel} from '@/lib/vipWheelDraw';
import {wheelOdds} from '@/lib/vipWheelSettings';
import RewardWheelPreview from './RewardWheelPreview';
const service=createVipLevelSpins(supabase),drawService=createVipWheelDraw(supabase);
function Wheel({user}){
 const cache=useQueryClient();
 const spins=useQuery({queryKey:['vip-level-spins',user?.id],queryFn:()=>service.list(user.id),enabled:!!user?.id&&!user.is_excluded,refetchInterval:30000,retry:1});
 const receipts=useQuery({queryKey:['vip-wheel-receipts',user?.id],queryFn:()=>drawService.receipts(user.id),enabled:!!user?.id&&!user.is_excluded,refetchInterval:30000,retry:1});
 const releases=useQuery({queryKey:['vip-wheel-releases'],queryFn:()=>drawService.releases(),refetchInterval:30000,retry:1});
 const [pending,setPending]=useState(()=>{try{return user?.id?readPendingWheel(window.localStorage,user.id):null;}catch{return null;}}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[rotation,setRotation]=useState({});
 const savePending=useCallback(value=>{setPending(value);try{if(value)window.localStorage.setItem(pendingWheelKey(user.id),JSON.stringify(value));else window.localStorage.removeItem(pendingWheelKey(user.id));}catch{/* The database still keys retries to this exact earned level. */}},[user?.id]);
 const finish=useCallback(receipt=>{
  setResult(receipt);savePending(null);setError('');
  cache.setQueryData(['vip-wheel-receipts',user.id],previous=>[...(previous??[]).filter(row=>row.level!==receipt.level),receipt].sort((a,b)=>a.level-b.level));
  window.dispatchEvent(new CustomEvent('ig:wallet-reward-credited',{detail:{userId:user.id}}));
 },[cache,savePending,user?.id]);
 useEffect(()=>{if(pending&&receipts.data){const known=receipts.data.find(row=>row.level===pending.level);if(known)finish(known);}},[pending,receipts.data,finish]);
 let available=[],reconciliationError='';
 try{available=availableVipSpins(spins.data?.rows??[],receipts.data??[]);}catch(e){reconciliationError=e.message;}
 const unavailable=spins.error||receipts.error||reconciliationError,loaded=!!spins.data&&!!receipts.data&&!unavailable;
 const canSpin=user&&!user.is_excluded&&['player','admin','superadmin'].includes(user.role);
 const draw=async request=>{
  if(busy)return;savePending(request);setBusy(true);setError('');
  try{
   const receipt=await drawService.spin(user.id,request.level,request.revision);
   const count=releases.data?.find(row=>row.stage===receipt.stage)?.segments.length??10;
   const target=(360-(receipt.reward.slot-0.5)*360/count)%360;
   setRotation(previous=>({...previous,[receipt.stage]:(previous[receipt.stage]??0)+2160+(target-(previous[receipt.stage]??0)%360+360)%360}));
   finish(receipt);
  }catch(e){
   // A lost response can follow a committed transaction. Read its exact receipt.
   let known;try{known=await drawService.receipt(user.id,request.level);}catch{/* Keep the same request for recovery. */}
   if(known)finish(known);
   else if(['22023','40001','42501'].includes(e.code)){savePending(null);setError(e.message);void releases.refetch();void spins.refetch();void receipts.refetch();}
   else setError('The result could not be confirmed yet. Check this spin again; it will never spend another level spin.');
  }finally{setBusy(false);}
 };
 const reload=()=>{void spins.refetch();void receipts.refetch();void releases.refetch();};
 if(user?.is_excluded)return <section id="vip-reward-wheel" className="rounded-xl border border-white/10 p-5 text-white">Reward wheels are unavailable for this account.</section>;
 return <section id="vip-reward-wheel" aria-labelledby="vip-wheel-title" className="space-y-5 rounded-2xl border border-white/10 bg-[#151022] p-5 sm:p-7 text-white">
  <header className="flex gap-3"><Crown className="mt-1 shrink-0 text-amber-300"/><div><h2 id="vip-wheel-title" className="text-2xl font-bold">VIP Reward Wheel</h2><p className="mt-2 text-sm text-slate-300">One spin for each VIP level reached, including your first spin at level 1. Each spin keeps the stage of the level that earned it. You can win and collect the same prize again on another spin.</p></div></header>
  {!user?<p>Sign in to view your saved spins.</p>:unavailable?<div role="alert" className="text-red-200">Your saved spins could not be loaded. <button className="underline" onClick={reload}>Retry saved spins</button></div>:!loaded?<p>Loading saved spins…</p>:<p role="status" className="font-semibold text-amber-200">{available.length} saved {available.length===1?'spin':'spins'}</p>}
  {error&&<p role="alert" className="text-red-200">{error}</p>}
  {pending&&<div className="space-y-2 rounded-xl border border-amber-300/30 p-4"><p>Checking the saved result for your level {pending.level} spin.</p><button disabled={busy} onClick={()=>void draw(pending)} className="rounded-lg bg-amber-300 px-4 py-3 font-bold text-black disabled:opacity-40">{busy?'Confirming spin…':'Check this spin result'}</button></div>}
  {result&&<div aria-live="polite" className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5" aria-label="Latest wheel reward"><h3 className="text-xl font-bold">Reward collected: {result.reward.amount} {result.reward.unit}</h3><p className="mt-2">{result.reward.reward} · Stage {result.stage} · Level {result.level}</p><p className="mt-2 text-sm text-emerald-200">Credited to your {result.reward.unit} wallet. Balance after this spin: {result.balance_after}.</p></div>}
  <div className="grid gap-4 md:grid-cols-3">
   {VIP_WHEEL_STAGES.map(stage=>{const release=releases.data?.find(row=>row.stage===stage.stage),saved=available.filter(row=>row.stage===stage.stage),next=saved[0],odds=wheelOdds(release?.segments??[]);return <article key={stage.stage} aria-label={stage.name+' reward wheel'} className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-center">
    {release?.segments.length>0?<RewardWheelPreview stage={stage.stage} segments={release.segments} rotation={rotation[stage.stage]??0}/>:<div aria-hidden="true" className={'mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20 bg-gradient-to-br '+stage.color}><Gift size={34}/></div>}
    <h3 className="text-lg font-bold">{stage.name}</h3><p className="text-sm text-slate-300">Levels {stage.minLevel}–{stage.maxLevel}</p>
    <p className="font-semibold">{loaded?`${saved.length} saved spins`:'Saved spins unavailable'}</p>
    <p className="text-xs text-slate-400">{stage.maxLevel-stage.minLevel+1} level rewards in this stage</p>
    <button disabled={!canSpin||!loaded||!next||!release?.active||!!releases.error||busy||!!pending} onClick={()=>void draw({level:next.level,revision:release.revision})} className="w-full rounded-lg bg-amber-300 px-4 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{release?.active?`Spin stage ${stage.stage}`:`Stage ${stage.stage} paused`}</button>
    {release?.active&&<p className="text-xs text-slate-300">Uses one saved spin. Wallet reward is credited automatically.</p>}
    {release?.segments.length>0&&<details className="text-left text-sm"><summary className="cursor-pointer font-semibold">Prizes and odds · revision {release.revision}</summary><ol className="mt-3 space-y-2">{release.segments.map((row,i)=><li key={row.slot} className="border-t border-white/10 pt-2"><strong>{row.slot}. {row.reward}</strong><br/>{row.amount} {row.unit} · {row.weight===0?'Excluded':`${odds[i].toFixed(2)}%`}{row.notes&&<p className="mt-1 text-xs text-slate-400">{row.notes}</p>}</li>)}</ol><p className="mt-3 text-xs text-slate-400">Odds use the published weights. Section sizes are a visual layout, not probability.</p></details>}
   </article>;})}
  </div>
  {releases.error&&<p role="alert">Published wheel settings are unavailable. <button className="underline" onClick={()=>void releases.refetch()}>Reload wheel prizes</button></p>}
  {!releases.data?.some(row=>row.active)&&<><div className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100"><LockKeyhole className="shrink-0" size={18}/><p>Wheel prizes are being finalized. Your earned spins stay saved until a wheel is published. Practice rounds do not earn wager-based XP.</p></div><button disabled className="rounded-lg border border-white/20 px-5 py-3 font-semibold text-slate-400">Spinning opens when prizes are ready</button></>}
  {receipts.data?.length>0&&!receipts.error&&<details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold">Collected rewards ({receipts.data.length})</summary><ul className="mt-3 space-y-3">{receipts.data.map(row=><li key={row.id} className="border-t border-white/10 pt-3"><strong>Level {row.level}: {row.reward.amount} {row.reward.unit}</strong> · {row.reward.reward}<p className="mt-1 text-xs text-slate-400">Stage {row.stage}, section {row.reward.slot}, published revision {row.release_revision} · {new Date(row.created_at).toLocaleString()}</p></li>)}</ul></details>}
  {spins.data?.rows.length>0&&!unavailable&&<details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-semibold">Earned spin history</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Level</th><th className="p-2">Rank</th><th className="p-2">Wheel stage</th><th className="p-2">Status</th><th className="p-2">Earned</th></tr></thead><tbody>{spins.data.rows.map(row=><tr key={row.level} className="border-t border-white/10"><td className="p-2">{row.level}</td><th scope="row" className="p-2 font-medium">{row.level_name}</th><td className="p-2">{row.stage}</td><td className="p-2">{available.some(spin=>spin.level===row.level)?'Saved':'Reward collected'}</td><td className="p-2">{new Date(row.earned_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
export default function VIPRewardWheel(){const {user}=useAuth();return <Wheel key={user?.id??'signed-out'} user={user}/>;}
