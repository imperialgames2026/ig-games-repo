import React, {useEffect,useState} from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Crown, BookOpen, Zap, Coins, ShieldCheck } from 'lucide-react';

export default function ImperialMembership() {
 const [plan,setPlan]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  (async()=>{
   try {
    const {data,error:e}=await supabase.from('ig_membership_plans_draft')
      .select('name,monthly_price_usd,ign_monthly_usd_target,hand_review_credits_per_month,boosters_per_month,boost_duration_hours,base_fee_rebate_bps,tier1_fee_rebate_bps,tier2_fee_rebate_bps,pricing_enabled,subscription_activation_enabled,reward_issuance_enabled')
      .eq('plan_code','imperial_3bet').single();
    if(e)throw e;
    if(active)setPlan(data);
   }catch(e){if(active)setError(e.message||'Unable to load membership details');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 return <main className="min-h-screen bg-[#0a0612] px-4 py-10 text-white">
  <div className="mx-auto max-w-4xl space-y-6">
   <Link to="/PokerLobby" className="text-amber-300 hover:underline">← Poker lobby</Link>
   <header className="space-y-2"><p className="flex items-center gap-2 text-amber-300 font-semibold tracking-wider uppercase"><Crown size={21}/> Imperial Poker Academy</p><h1 className="text-4xl font-black">Imperial 3-Bet Membership</h1><p className="text-slate-300">Member rewards, post-hand study credits and limited-duration boosters.</p></header>
   <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><ShieldCheck className="inline mr-2" size={18}/> Proposed membership — not for sale. IGN value and reward quantities are not guaranteed. Purchase, renewal, token allocation and rebate claims are disabled.</div>
   {loading?<p>Loading membership…</p>:error?<p role="alert">{error}</p>:plan&&<>
    <section className="rounded-2xl border border-amber-400/30 bg-[#191529] p-6 space-y-4">
      <div className="flex flex-wrap justify-between items-baseline gap-2"><h2 className="text-2xl font-extrabold">{plan.name}</h2><p className="text-3xl font-extrabold text-amber-300">${Number(plan.monthly_price_usd).toFixed(2)} <span className="text-base text-slate-300 font-normal">/ month (proposed)</span></p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
       <div className="rounded-xl bg-black/30 p-4"><Coins className="text-amber-300"/><p className="text-2xl font-bold mt-2">${Number(plan.ign_monthly_usd_target).toFixed(2)}</p><p className="text-sm text-slate-300">IGN target benefit value; number of tokens not yet determined</p></div>
       <div className="rounded-xl bg-black/30 p-4"><BookOpen className="text-amber-300"/><p className="text-2xl font-bold mt-2">{plan.hand_review_credits_per_month}</p><p className="text-sm text-slate-300">Post-hand study credits / month</p></div>
       <div className="rounded-xl bg-black/30 p-4"><Zap className="text-amber-300"/><p className="text-2xl font-bold mt-2">{plan.boosters_per_month}</p><p className="text-sm text-slate-300">{plan.boost_duration_hours}-hour boosters / month, conditions pending</p></div>
      </div>
      <h3 className="text-xl font-bold">Rakeback tiers — on fees actually paid</h3>
      <div className="grid grid-cols-3 gap-2 text-center">{[['Base',plan.base_fee_rebate_bps],['Step-up',plan.tier1_fee_rebate_bps],['Top',plan.tier2_fee_rebate_bps]].map(([label,bps])=><div key={label} className="rounded-lg border border-white/10 p-3"><p className="text-xs text-slate-400">{label}</p><p className="font-bold text-lg">{(Number(bps)/100).toFixed(1)}%</p></div>)}</div>
      <p className="text-sm text-slate-400">Higher tiers require verified eligibility; boosted rates, caps, discounts and earning conditions remain under review. No benefit is active.</p>
      <button disabled className="w-full rounded-xl bg-slate-700 p-4 text-slate-300 cursor-not-allowed">Membership coming soon — purchase unavailable</button>
    </section>
    <p className="text-sm text-slate-400">Hand analysis is available only by selecting a completed hand from <Link className="text-amber-300 underline" to="/PastPlayedHands">Past Played Hands</Link>. Live table coaching is not supported.</p>
   </>}
  </div>
 </main>;
}
