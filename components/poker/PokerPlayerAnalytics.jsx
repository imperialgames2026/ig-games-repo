import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Link } from 'react-router-dom';

const STATS = [
 ['VPIP','vpip','Voluntarily put money in pot preflop (excludes blinds and forced antes)'],
 ['PFR','pfr','Raised before the flop'],
 ['3-Bet','threebet','Three-bets divided by available opportunities','threebet_opps'],
 ['Fold to 3-Bet','fold_to_threebet','Folds when facing a three-bet','fold_to_threebet_opps'],
 ['Flop C-Bet','flop_cbet','Flop continuation bets per opportunity','cbet_opps'],
 ['Fold to Flop C-Bet','fold_to_flop_cbet','Folds facing flop continuation bets','fold_to_flop_cbet_opps'],
 ['Steal Attempt','steal','Opening raises from steal positions per opportunity','steal_opps'],
 ['Blind Defense','blind_defense','Defended blind when facing a steal','defense_opps'],
 ['Showdown Win','wtsd_win','Showdowns won divided by showdowns seen','showdowns'],
 ['Hands Won','hands_won','Hands won divided by hands played'],
];
const pct=(v)=>v===null||v===undefined?'N/A':Number(v).toFixed(1)+'%';
export default function PokerPlayerAnalytics(){
 const [metrics,setMetrics]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user)throw Error('Sign in to see poker analytics.');
    const {data,error:e}=await supabase.from('ig_poker_player_metrics')
      .select('user_id,hands,vpip,pfr,threebet,threebet_opps,fold_to_threebet,fold_to_threebet_opps,flop_cbet,cbet_opps,fold_to_flop_cbet,fold_to_flop_cbet_opps,steal,steal_opps,blind_defense,defense_opps,wtsd_win,showdowns,hands_won,aggression_factor,graded_decisions,graded_hands,skill_score,skill_status')
      .eq('user_id',user.id).maybeSingle();
    if(e)throw e;
    if(active)setMetrics(data);
   }catch(e){if(active)setError(e.message||'Stats unavailable');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 return <section className="rounded-2xl border border-amber-500/20 bg-[#191529] p-5 text-white" aria-label="Verified poker analytics">
   <header className="flex flex-wrap justify-between gap-2">
    <div><h2 className="text-xl font-black">Poker Analytics & Skill</h2><p className="text-sm text-slate-300 mt-1">Server-verified completed hands only. Practice data is never treated as cash results.</p></div>
    <Link to="/PastPlayedHands" className="text-amber-300 text-sm underline">Past Played Hands</Link>
   </header>
   {loading?<p className="mt-4">Loading poker metrics…</p>:error?<p role="alert" className="mt-4 text-red-200">{error}</p>:!metrics?
    <div className="mt-4 rounded-xl bg-black/20 p-4"><p className="text-2xl font-bold">Skill: N/A</p><p className="text-sm text-slate-300 mt-2">No server-verified hand analytics available yet. Automatic hand archiving and grading are still being connected.</p></div>:
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-black/20 p-4"><p className="text-slate-300 text-sm">Skill Score</p><p className="text-3xl font-extrabold text-amber-300">{metrics.skill_score??'N/A'}<span className="text-sm text-slate-400 font-normal">{metrics.skill_score===null?'':' / 1000'}</span></p><p className="text-xs text-slate-400 mt-2">Post-hand decision quality, not winnings</p></div>
        <div className="rounded-xl bg-black/20 p-4"><p className="text-slate-300 text-sm">Verified hands</p><p className="text-3xl font-bold">{metrics.hands??0}</p><p className="text-xs text-slate-400 mt-2">200 required to score</p></div>
        <div className="rounded-xl bg-black/20 p-4"><p className="text-slate-300 text-sm">Graded decisions</p><p className="text-3xl font-bold">{metrics.graded_decisions??0}</p><p className="text-xs text-slate-400 mt-2">100 decisions across 50 hands required</p></div>
      </div>
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
       {STATS.map(([name,key,hint,opps])=><div key={key} className="rounded-xl border border-white/10 p-3" title={hint}><p className="text-slate-400 text-sm">{name}</p><p className="font-bold text-xl">{pct(metrics[key])}</p>{opps&&<p className="text-xs text-slate-400">{metrics[opps]??0} opportunities</p>}</div>)}
      </div>
      <p className="text-slate-400 text-xs mt-4">Aggression factor: {metrics.aggression_factor??'N/A'}. Rates with no opportunities show N/A. Skill scoring requires a calibrated, versioned review system.</p>
    </>}
 </section>;
}
