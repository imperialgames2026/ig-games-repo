import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Coins, ShieldCheck, History, RefreshCw } from 'lucide-react';
const fmt = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
const card = 'rounded-2xl border border-emerald-500/20 bg-slate-900 p-5';
export default function IGNToken() {
 const {user}=useAuth();
 const readOnly=!user||user.role==='tester'||user.is_excluded;
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[amount,setAmount]=useState('');
 const load=useCallback(async()=>{
  try {const {data:result,error:e}=await supabase.functions.invoke('ign-staking-v1',{body:{action:'overview'}});if(e)throw e;setData(result);setError('');}
  catch(e){setError(e.message||'Unable to load IGN');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load();},[load]);
 const act=async(action,params={})=>{
  if(busy||readOnly)return;setBusy(true);setError('');setMessage('');
  try {const {data:result,error:e}=await supabase.functions.invoke('ign-staking-v1',{body:{action,operation_id:crypto.randomUUID(),...params}});if(e)throw e;
   if(result?.error)throw Error(result.error);setMessage(result.status==='duplicate'?'Request already processed.': 'Simulation updated successfully.');await load();setAmount('');
  }catch(e){setError(e.message||'Request failed');}finally{setBusy(false);}
 };
 const account=data?.account;const entries=data?.entries||[];
 const numeric=Number(amount);
 const amountValid=amount.trim()!==''&&Number.isFinite(numeric)&&numeric>0&&numeric<=1e9&&/^\d+(\.\d{1,8})?$/.test(amount);
 return <main className="min-h-screen bg-slate-950 text-white px-4 py-10">
  <div className="mx-auto max-w-5xl space-y-6">
   <div className="flex items-start justify-between gap-3">
    <div><div className="flex items-center gap-2 text-emerald-400"><Coins size={24}/><span className="font-semibold tracking-wider">IMPERIAL GAMES</span></div><h1 className="text-3xl font-extrabold mt-2">IGN Token Engine</h1><p className="text-slate-400 mt-1">Stake, track rewards, and manage your test IGN.</p></div>
    <button onClick={load} className="p-3 rounded-xl bg-slate-800" aria-label="Refresh staking data"><RefreshCw size={18}/></button>
   </div>
   <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"><ShieldCheck className="inline mr-2" size={18}/> STAGING SIMULATION — IGN has no cash value, cannot be withdrawn or traded, and is separate from gaming wallet currencies. Hourly rewards, token minting and buybacks are disabled.</div>
   {readOnly&&<p role="status">This account has read-only access to the simulation.</p>}
   {error&&<p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">{error}</p>}
   {message&&<p role="status" className="rounded-xl bg-emerald-950 p-3 text-emerald-200">{message}</p>}
   {loading?<p>Loading IGN dashboard…</p>:<><div className="grid gap-4 md:grid-cols-3">
    <div className={card}><p className="text-slate-400 text-sm">Available IGN</p><p className="text-3xl font-bold mt-3 text-emerald-400">{fmt(account?.available)}</p></div>
    <div className={card}><p className="text-slate-400 text-sm">Your stake</p><p className="text-3xl font-bold mt-3">{fmt(account?.staked)}</p></div>
    <div className={card}><p className="text-slate-400 text-sm">Unclaimed rewards</p><p className="text-3xl font-bold mt-3 text-emerald-400">{fmt(account?.claimable)}</p><button disabled={readOnly||busy||Number(account?.claimable||0)<=0} onClick={()=>act('claim')} className="mt-4 px-5 py-2 rounded-xl bg-emerald-400 text-slate-950 font-bold disabled:opacity-40">Claim rewards</button></div>
   </div>
   <section className={card}><h2 className="text-xl font-bold">Staking controls</h2><p className="text-slate-400 text-sm mt-2">Flexible simulated staking. Locked tiers and funded distribution cycles are not active.</p>
    {!account?.demo_granted&&<button onClick={()=>act('demo_grant')} disabled={readOnly||busy} className="mt-4 rounded-xl bg-amber-400 px-5 py-3 text-slate-950 font-bold disabled:opacity-40">Receive 1,000 practice IGN (once)</button>}
    <label className="block mt-5 text-sm text-slate-300" htmlFor="ign-amount">IGN amount</label>
    <input id="ign-amount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="e.g. 100" className="w-full mt-2 rounded-xl border border-slate-700 bg-slate-800 p-3"/>
    <div className="flex flex-wrap gap-3 mt-4"><button disabled={readOnly||busy||!amountValid||numeric>Number(account?.available||0)} onClick={()=>act('stake',{amount:numeric})} className="rounded-xl bg-emerald-400 px-6 py-3 text-slate-950 font-bold disabled:opacity-40">Stake</button><button disabled={readOnly||busy||!amountValid||numeric>Number(account?.staked||0)} onClick={()=>act('unstake',{amount:numeric})} className="rounded-xl border border-slate-600 px-6 py-3 font-bold disabled:opacity-40">Unstake</button></div>
    <label className="flex items-center gap-3 mt-6"><input type="checkbox" disabled={readOnly||busy} checked={!!account?.auto_stake} onChange={e=>act('auto_stake',{auto_stake:e.target.checked})} className="h-5 w-5 accent-emerald-400"/><span>Automatically stake claimed rewards (opt-in)</span></label>
   </section>
   <div className="grid gap-4 md:grid-cols-2"><section className={card}><h2 className="font-bold text-lg">Distribution</h2><p className="text-slate-400 mt-3">Next payout: Not scheduled</p><p className="text-slate-400 mt-2">Hourly rewards: {data?.settings?.hourly_rewards_enabled?'Configured':'Disabled'}</p><p className="text-slate-400 mt-2">Lifetime claimed: {fmt(account?.total_claimed)} IGN</p></section><section className={card}><h2 className="font-bold text-lg">Supply</h2><p className="text-slate-400 mt-3">Proposed maximum: {fmt(data?.settings?.max_supply)} IGN</p><p className="text-slate-400 mt-2">On-chain mint: Disabled</p><p className="text-slate-400 mt-2">Buyback and burn: Not active</p></section></div>
   <section className={card} aria-label="IGN tokenomics simulation"><h2 className="text-xl font-bold">IGN reward economics — simulated</h2><p className="text-slate-400 text-sm mt-2">Target edge for future verified original-game payouts; current practice games and third-party odds are not changed by this configuration.</p><div className="grid gap-3 mt-5 md:grid-cols-3"><div><p className="text-sm text-slate-400">Target house edge</p><p className="text-2xl font-bold">{((data?.settings?.target_house_edge_bps ?? 700)/100).toFixed(2)}%</p></div><div><p className="text-sm text-slate-400">Wagering rewards</p><p className="text-2xl font-bold">{((data?.settings?.wagering_reward_bps_of_edge ?? 1000)/100).toFixed(2)}% <span className="text-sm font-normal text-slate-400">of theoretical edge</span></p></div><div><p className="text-sm text-slate-400">Staking rewards</p><p className="text-2xl font-bold">{((data?.settings?.staking_reward_bps_of_edge ?? 1000)/100).toFixed(2)}% <span className="text-sm font-normal text-slate-400">of theoretical edge</span></p></div></div><p className="text-slate-400 text-sm mt-5">Hourly schedule: {data?.settings?.hourly_cycle_minutes ?? 60} minutes. Proposed early unstake burn: {((data?.settings?.early_unstake_penalty_bps ?? 100)/100).toFixed(2)}% within {(data?.settings?.penalty_free_after_hours ?? 168)/24} days. All rewards and penalties currently inactive.</p><p className="text-amber-300 text-sm mt-2">10% × 7% = 0.7% of eligible wager volume to each reward pool. Actual payments require separately funded and verified settlement.</p></section>
   <section className={card}><h2 className="flex items-center gap-2 font-bold text-xl"><History size={20}/> Ledger history</h2><div className="mt-4 space-y-2">{entries.length?entries.map(e=><div key={e.operation_id} className="flex items-center justify-between gap-3 border-t border-slate-800 py-3"><div><p className="capitalize font-medium">{e.kind.replace('_',' ')}</p><time className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</time></div><span className="font-mono">{fmt(e.amount)} IGN</span></div>):<p className="text-slate-400">No transactions yet.</p>}</div></section>
   </>}
  </div></main>;
}
