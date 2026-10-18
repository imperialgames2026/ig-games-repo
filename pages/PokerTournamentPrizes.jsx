import React,{useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const render=(x,c)=>{const n=Number(x);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(n)+' '+c:'—'};
export default function PokerTournamentPrizes(){
 const [params]=useSearchParams(),eventId=params.get('eventId');
 const [result,setResult]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  if(!eventId||!uuid.test(eventId)){setError('Enter a valid published tournament event ID');return}
  setError('');setResult(null);
  void supabase.functions.invoke('ig-poker-tournament-prizes',{body:{eventId}})
    .then(({data,error:e})=>{if(!active)return;if(e||data?.error)throw Error(data?.error||'Unable to fetch prize plan');setResult(data)})
    .catch(e=>{if(active)setError(e.message)});
  return ()=>{active=false};
 },[eventId]);
 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white">
  <div className="mx-auto max-w-3xl space-y-5">
   <Link className="text-amber-300 underline" to="/PlayPoker">← Back to poker</Link>
   <h1 className="text-3xl font-black">Tournament prize ladder</h1>
   <p className="rounded-lg border border-amber-300/30 p-4 text-sm text-amber-100">
    Staging demonstration only. These are configured nominal awards, not actual money, redeemable chips, guaranteed payouts, or balances credited to players.
   </p>
   {error&&<p className="text-red-300" role="alert">{error}</p>}
   {!error&&!result&&<p className="text-gray-300">Loading published tournament…</p>}
   {result&&<section className="space-y-4 rounded-xl border border-white/15 bg-[#1c1729] p-5">
    <h2 className="text-2xl font-bold">{result.name}</h2>
    <p className="text-gray-300">{result.status} · {result.paidPlaces} configured paid positions · denomination: {result.payoutAsset}</p>
    {result.quote?.available?<p className="text-sm text-emerald-200">Indicative rate: 1 {result.payoutAsset} ≈ {render(result.quote.unitPrice,result.displayAsset)} ({result.quote.source}; {result.quote.asOf?new Date(result.quote.asOf).toLocaleString():'time unavailable'})</p>
      :<p className="text-sm text-amber-200">Independent market equivalent not available: {result.quote?.reason||'No current verified quote'}</p>}
    <div className="max-h-[650px] overflow-y-auto">
     <table className="w-full text-left text-sm"><thead><tr className="border-b border-white/20"><th className="py-2">Finish</th><th>Award</th><th>Estimated market equivalent</th></tr></thead>
      <tbody>{result.awards.map(a=><tr key={a.position} className="border-b border-white/10"><th className="py-2">{a.position}</th><td>{render(a.amount,result.payoutAsset)}</td><td>{result.quote?.available?render(Number(a.amount)*result.quote.unitPrice,result.displayAsset):'—'}</td></tr>)}</tbody></table>
    </div>
    <p className="break-all text-xs text-gray-400">Prize plan SHA-256: {result.awardScheduleHash}</p>
   </section>}
  </div>
 </main>;
}
