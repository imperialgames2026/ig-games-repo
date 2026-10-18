import React,{useEffect,useMemo,useState} from 'react';
const ASSETS=['PRACTICE','USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','ADA','XRP','LTC','BNB','USDC','USDT','XMR','ARB','OP','POL','DOGE','ZEPH','IC','ID','IGD','IGN'];
const DISPLAYS=['USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','USDC','USDT'];
const css='w-full rounded-lg border border-white/20 bg-[#120e1d] p-2 text-white';
const readCount=p=>Math.min(100,Number(p.seats_per_table)*Number(p.table_count));
const fmt=(amount,asset)=>{
 const n=Number(amount);
 return Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(n)+' '+asset:'—';
};
export default function TournamentPayoutEditor({preset,invoke,onSaved}){
 const [asset,setAsset]=useState(preset.payout_asset||'PRACTICE');
 const [displayAsset,setDisplayAsset]=useState(preset.payout_display_asset||'USD');
 const [count,setCount]=useState(Number(preset.paid_places||0));
 const [revision,setRevision]=useState(Number(preset.payout_revision||0));
 const [amounts,setAmounts]=useState([]);
 const [quote,setQuote]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const maximum=readCount(preset);
 const total=useMemo(()=>amounts.slice(0,count).reduce((a,x)=>a+(Number(x)||0),0),[amounts,count]);
 useEffect(()=>{
  let active=true;setBusy(true);setError('');setNotice('');setQuote(null);
  void invoke({action:'awardsList',presetId:preset.id}).then(x=>{
   if(!active)return;
   const list=x.awards||[];
   const values=Array.from({length:maximum},(_,i)=>String(list.find(a=>a.place===i+1)?.amount??''));
   setAmounts(values);setCount(list.length);setRevision(Number(preset.payout_revision||0));
   setAsset(preset.payout_asset||'PRACTICE');setDisplayAsset(preset.payout_display_asset||'USD');
  }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});
  return ()=>{active=false};
 },[preset.id,invoke]);
 const update=(index,value)=>setAmounts(old=>{const next=[...old];next[index]=value;return next});
 const refreshQuote=async()=>{
  setQuote(null);setError('');
  try{const result=await invoke({action:'quote',asset,displayAsset});setQuote(result.quote)}
  catch(e){setError(e.message)}
 };
 const save=async()=>{
  setError('');setNotice('');
  const awards=Array.from({length:count},(_,i)=>({position:i+1,amount:amounts[i]?.trim()||''}));
  if(awards.some(a=>!/^\d+(?:\.\d{1,12})?$/.test(a.amount)||!(Number(a.amount)>0)
    ||Number(a.amount)>1000000000)){
   setError('Every paid position must have a positive amount, up to 12 decimals. Reduce paid places to omit positions.');return;
  }
  setBusy(true);
  try{
   const result=await invoke({action:'saveAwards',presetId:preset.id,asset,displayAsset,
    awards,expectedRevision:revision});
   setRevision(result.awardPlan.revision);
   setNotice('Saved '+result.awardPlan.paidPlaces+' prize positions. Revision '+result.awardPlan.revision+' recorded; no funds transferred.');
   await onSaved?.();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 return <section className="space-y-4 rounded-xl border border-amber-300/30 bg-[#181124] p-4" aria-label={'Prize ladder for '+preset.name}>
  <div><h3 className="text-lg font-bold text-amber-200">{preset.name} — finishing-position awards</h3>
   <p className="text-xs text-gray-300">Draft only. Select a denomination, then configure a separate prize amount for each place. No wallet credit or automatic disbursement.</p></div>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
   <label className="text-sm">Number of paid spots (0–{maximum})
    <input type="number" min="0" max={maximum} step="1" className={css} value={count} onChange={e=>setCount(Math.max(0,Math.min(maximum,Math.trunc(Number(e.target.value)||0))))}/>
   </label>
   <label className="text-sm">Payout currency
    <select className={css} value={asset} onChange={e=>{setAsset(e.target.value);setQuote(null)}}>{ASSETS.map(c=><option key={c}>{c}</option>)}</select>
   </label>
   <label className="text-sm">Display equivalent in
    <select className={css} value={displayAsset} onChange={e=>{setDisplayAsset(e.target.value);setQuote(null)}}>{DISPLAYS.map(c=><option key={c}>{c}</option>)}</select>
   </label>
  </div>
  <div className="flex flex-wrap items-center gap-3">
   <button type="button" disabled={busy} onClick={()=>void refreshQuote()} className="rounded-lg border border-white/40 px-3 py-2 text-sm">Refresh indicative exchange quote</button>
   {quote?.available?<span className="text-sm text-emerald-200">1 {asset} ≈ {fmt(quote.unitPrice,displayAsset)} · {quote.source} · {quote.asOf?new Date(quote.asOf).toLocaleString():'date unavailable'}</span>
    :quote?<span className="text-sm text-amber-200">Market value unavailable: {quote.reason||'No verified quote'}</span>:null}
  </div>
  {count>0&&<div className="max-h-[480px] overflow-y-auto rounded-xl border border-white/15">
   <div className="grid grid-cols-[64px_1fr_1fr] gap-3 border-b border-white/15 bg-[#2c233b] px-3 py-2 text-xs font-bold"><span>Finish</span><span>Award in {asset}</span><span>Est. {displayAsset}</span></div>
   {Array.from({length:count},(_,i)=><div key={i} className="grid grid-cols-[64px_1fr_1fr] items-center gap-3 border-b border-white/10 px-3 py-2 text-sm">
    <strong>#{i+1}</strong>
    <input aria-label={'Prize for finishing position '+(i+1)} className={css} type="text" inputMode="decimal" placeholder="0.00" value={amounts[i]||''} onChange={e=>update(i,e.target.value)}/>
    <span className="text-gray-300">{quote?.available&&amounts[i]&&Number(amounts[i])>0?fmt(Number(amounts[i])*quote.unitPrice,displayAsset):'—'}</span>
   </div>)}
  </div>}
  <p className="text-sm font-semibold">Configured prize total: {fmt(total,asset)}
   {quote?.available?' (indicative ≈ '+fmt(total*quote.unitPrice,displayAsset)+')':''}
  </p>
  <p className="text-xs text-amber-200">Exchange quotes are reference estimates, not guaranteed settlement values. Imperial Games practice tokens and assets without independently verified pricing show no market conversion.</p>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {notice&&<p role="status" className="text-emerald-300">{notice}</p>}
  <button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-50">Save all {count} payout positions</button>
 </section>;
}
