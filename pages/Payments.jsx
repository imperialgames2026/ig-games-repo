import React, {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
const routes={BTC:['bitcoin'],ETH:['ethereum'],SOL:['solana'],USDC:['ethereum','solana'],USDT:['ethereum','solana']};
export default function Payments({initialKind='deposit'}){
 const [kind,setKind]=useState(initialKind),[asset,setAsset]=useState('BTC'),[network,setNetwork]=useState('bitcoin');
 const [amount,setAmount]=useState(''),[destination,setDestination]=useState(''),[rows,setRows]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef(null);
 const call=useCallback(async body=>{
  const {data,error:err}=await supabase.functions.invoke('ig-payment-requests',{body});
  if(err||data?.error)throw Error(data?.error||'Payment preparation is unavailable. No funds were moved.');
  return data;
 },[]);
 const refresh=useCallback(async()=>{const data=await call({action:'list'});setRows(data.requests||[]);},[call]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
 async function submit(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  const input={action:'prepare',kind,asset,network,amount,...(kind==='withdrawal'?{destination:destination.trim()}:{})};
  const fingerprint=JSON.stringify(input);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,id:crypto.randomUUID()};
  try{const data=await call({...input,requestId:pending.current.id});pending.current=null;setNotice(data.message);setAmount('');setDestination('');await refresh();}
  catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function cancel(id){setBusy(true);setError('');try{await call({action:'cancel',id});await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-4xl space-y-6">
  <Link to="/Games" className="text-amber-300">← Games</Link><h1 className="text-3xl font-bold">Deposits & withdrawals</h1>
  <Link to="/DepositNetworks" className="inline-block text-sm text-amber-300 underline">View deposit network readiness</Link>
  <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">Practice games use fictional chips. Payment processing is not connected. You can prepare a request, view its status or cancel it. A request does not reserve funds, create a deposit address or send a payment.</p>
  {error&&<p role="alert" className="rounded-lg bg-red-950 p-4">{error}</p>}{notice&&<p role="status" className="rounded-lg bg-emerald-950 p-4">{notice}</p>}
  <form onSubmit={submit} className="grid gap-4 rounded-xl border border-white/15 p-6 sm:grid-cols-2">
   <label>Request type<select aria-label="Request type" className="mt-2 block w-full rounded bg-slate-800 p-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="deposit">Deposit preparation</option><option value="withdrawal">Withdrawal preparation</option></select></label>
   <label>Asset<select aria-label="Asset" className="mt-2 block w-full rounded bg-slate-800 p-3" value={asset} onChange={e=>{setAsset(e.target.value);setNetwork(routes[e.target.value][0]);}}>{Object.keys(routes).map(code=><option key={code}>{code}</option>)}</select></label>
   <label>Network<select aria-label="Network" className="mt-2 block w-full rounded bg-slate-800 p-3" value={network} onChange={e=>setNetwork(e.target.value)}>{routes[asset].map(name=><option key={name}>{name}</option>)}</select></label>
   <label>Amount<input aria-label="Amount" inputMode="decimal" required pattern="[0-9]+(\.[0-9]{1,8})?" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 block w-full rounded bg-slate-800 p-3"/></label>
   {kind==='withdrawal'&&<label className="sm:col-span-2">Destination address<input aria-label="Destination address" required minLength={8} maxLength={256} value={destination} onChange={e=>setDestination(e.target.value)} className="mt-2 block w-full rounded bg-slate-800 p-3"/><span className="text-sm text-slate-400">Address validation occurs when a provider is connected. Do not send funds based on this preparation.</span></label>}
   <button disabled={busy} className="rounded bg-amber-300 p-3 font-bold text-slate-950 disabled:opacity-50 sm:col-span-2">{busy?'Saving…':'Save preparation request'}</button>
  </form>
  <section><h2 className="mb-3 text-xl font-bold">Your requests</h2>{rows.length===0?<p className="text-slate-400">No preparation requests.</p>:<div className="space-y-3">{rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/15 p-4"><div><p>{row.kind} · {row.amount} {row.asset} · {row.network}</p><p className="text-sm text-slate-400">{row.status==='cancelled'?'Cancelled':'Awaiting provider connection'} · {new Date(row.created_at).toLocaleString()}</p></div>{row.status==='awaiting_provider'&&<button disabled={busy} onClick={()=>void cancel(row.id)} className="rounded border border-white/20 px-4 py-2">Cancel request</button>}</article>)}</div>}</section>
 </div></main>;
}
