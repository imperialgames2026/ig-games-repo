import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';

const defaults={name:'Imperial Poker Night',format:'scheduled_mtt',variant:'holdem',seatsPerTable:8,tableCount:4,currency:'PRACTICE',buyInUnits:100,rakeBps:0,rakeCapUnits:0,noFlopNoDrop:true,rakeFromForcedBets:false,bombPotsEnabled:false,bombPotEveryHands:0,anteEnabled:false,anteUnits:0,initialStack:5000,blindLevels:[{small:25,big:50,durationMinutes:10}],realMoneyEnabled:false,feeCollectionEnabled:false};
const currencies=['PRACTICE','IC','ID','IGD','IGN'];
const Field=({label,children})=><label className="flex flex-col gap-1.5 text-sm text-gray-200"><span className="font-semibold">{label}</span>{children}</label>;
const fieldStyle='w-full rounded-lg border border-white/25 bg-[#191427] px-3 py-2 text-white';
export default function SuperadminPokerTournaments(){
 const {user}=useAuth();
 const [form,setForm]=useState(defaults),[presets,setPresets]=useState([]),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const allowed=user?.role==='superadmin'&&!user?.is_excluded;
 const change=(key,value)=>setForm(old=>({...old,[key]:value}));
 const invoke=async body=>{const {data,error}=await supabase.functions.invoke('ig-poker-tournament-admin',{body});if(error||data?.error)throw Error(data?.error||'Staging service unavailable');return data;};
 const load=async()=>{if(!allowed)return;try{const r=await invoke({action:'list'});setPresets(r.presets||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();},[allowed]);
 const save=async e=>{
  e.preventDefault();if(!allowed||saving)return;
  setSaving(true);setNotice('');setError('');
  try{const r=await invoke({action:'save',config:form});setNotice('Draft saved. Capacity: '+r.preset.capacity+' seats. No real-money rake or buy-ins collected.');await load();}
  catch(e){setError(e.message);}finally{setSaving(false);}
 };
 const capacity=Number(form.seatsPerTable)*Number(form.tableCount);
 if(!allowed)return <main className="min-h-screen bg-[#0a0612] p-10 text-white"><h1 className="text-2xl font-black">Superadmin access required</h1><Link to="/Games" className="text-amber-300 underline">Return to Games</Link></main>;
 return <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white"><div className="mx-auto max-w-5xl space-y-6">
  <div><Link to="/Admin" className="text-amber-300">← Admin dashboard</Link><h1 className="mt-3 text-3xl font-black">Poker tournament control room</h1><p className="mt-2 text-gray-300">Superadmin-only draft presets. No currency transfers, prizes, rake collection or real-money registration is active.</p></div>
  <form onSubmit={save} className="space-y-6 rounded-2xl border border-white/15 bg-[#1c1729] p-5 sm:p-7">
   <div className="grid gap-4 md:grid-cols-3">
    <Field label="Tournament name"><input required minLength={3} maxLength={90} className={fieldStyle} value={form.name} onChange={e=>change('name',e.target.value)}/></Field>
    <Field label="Format"><select className={fieldStyle} value={form.format} onChange={e=>change('format',e.target.value)}><option value="scheduled_mtt">Multi-table tournament</option><option value="sit_and_go">Sit & Go</option><option value="ring">Ring game preset</option></select></Field>
    <Field label="Poker variant"><select className={fieldStyle} value={form.variant} onChange={e=>setForm(v=>({...v,variant:e.target.value,seatsPerTable:e.target.value==='omaha'?6:v.seatsPerTable}))}><option value="holdem">No-Limit Hold'em</option><option value="omaha">Omaha</option></select></Field>
    <Field label="Seats per table"><select className={fieldStyle} value={form.seatsPerTable} onChange={e=>change('seatsPerTable',Number(e.target.value))}>{(form.variant==='omaha'?[6]:[6,7,8]).map(n=><option key={n} value={n}>{n} players</option>)}</select></Field>
    <Field label="Number of tables (1–30)"><input type="number" min={1} max={30} required className={fieldStyle} value={form.tableCount} onChange={e=>change('tableCount',Number(e.target.value))}/></Field>
    <div className="flex items-center rounded-xl border border-amber-300/25 bg-amber-300/10 p-4"><span className="font-black text-amber-200">{capacity} maximum seats</span></div>
    <Field label="Currency (configuration only)"><select className={fieldStyle} value={form.currency} onChange={e=>change('currency',e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field>
    <Field label="Buy-in price points (currency units)"><input type="number" min={0} step={1} className={fieldStyle} value={form.buyInUnits} onChange={e=>change('buyInUnits',Number(e.target.value))}/></Field>
    <Field label="Starting tournament chips"><input type="number" min={100} max={10000000} className={fieldStyle} value={form.initialStack} onChange={e=>change('initialStack',Number(e.target.value))}/></Field>
    <Field label="Rake percentage per contested pot"><input type="number" min={0} max={10} step={0.01} className={fieldStyle} value={form.rakeBps/100} onChange={e=>change('rakeBps',Math.round(Number(e.target.value)*100))}/></Field>
    <Field label="Rake cap (same currency units)"><input type="number" min={0} step={1} className={fieldStyle} value={form.rakeCapUnits} onChange={e=>change('rakeCapUnits',Number(e.target.value))}/></Field>
    <Field label="Blind level duration (minutes)"><input type="number" min={1} max={120} className={fieldStyle} value={form.blindLevels[0].durationMinutes} onChange={e=>change('blindLevels',[{...form.blindLevels[0],durationMinutes:Number(e.target.value)}])}/></Field>
    <Field label="Small blind"><input type="number" min={1} className={fieldStyle} value={form.blindLevels[0].small} onChange={e=>change('blindLevels',[{...form.blindLevels[0],small:Number(e.target.value)}])}/></Field>
    <Field label="Big blind"><input type="number" min={2} className={fieldStyle} value={form.blindLevels[0].big} onChange={e=>change('blindLevels',[{...form.blindLevels[0],big:Number(e.target.value)}])}/></Field>
    <Field label="Ante per player"><input type="number" min={0} className={fieldStyle} value={form.anteUnits} onChange={e=>setForm(v=>({...v,anteUnits:Number(e.target.value),anteEnabled:Number(e.target.value)>0}))}/></Field>
   </div>
   <div className="space-y-3 border-t border-white/10 pt-5">
    <label className="flex items-center gap-3"><input type="checkbox" checked={form.noFlopNoDrop} onChange={e=>change('noFlopNoDrop',e.target.checked)}/><span>No flop, no drop (recommended for ring-game rake)</span></label>
    <label className="flex items-center gap-3 text-amber-200"><input type="checkbox" checked disabled/><span>Never rake forced small blinds, big blinds or antes before a played pot</span></label>
    <label className="flex items-center gap-3"><input type="checkbox" checked={form.bombPotsEnabled} onChange={e=>setForm(v=>({...v,bombPotsEnabled:e.target.checked,bombPotEveryHands:e.target.checked?5:0}))}/><span>Enable Bomb Pot specification (not yet playable)</span></label>
    {form.bombPotsEnabled&&<Field label="Bomb Pot every N hands"><input type="number" min={1} max={1000} className={fieldStyle} value={form.bombPotEveryHands} onChange={e=>change('bombPotEveryHands',Number(e.target.value))}/></Field>}
   </div>
   <button disabled={saving} type="submit" className="rounded-xl bg-amber-400 px-6 py-3 font-black text-gray-950 disabled:opacity-50">{saving?'Saving…':'Save staging tournament preset'}</button>
   {notice&&<p role="status" className="text-emerald-300">{notice}</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}
  </form>
  <section className="rounded-2xl border border-white/15 bg-[#1c1729] p-5"><h2 className="text-xl font-black">Saved draft tournament presets</h2>
   <div className="mt-4 space-y-2">{presets.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-3 text-sm"><span>{p.name} · {p.format} · {p.variant}</span><span>{p.seats_per_table} seats × {p.table_count} tables · {p.currency} {p.buy_in_units} · {p.rake_bps/100}% rake</span></div>)}
   {!presets.length&&<p className="text-gray-400">No saved staging presets.</p>}</div>
  </section>
 </div></main>;
}
