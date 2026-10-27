import React,{useCallback,useEffect,useState} from 'react';
import TournamentPayoutEditor from '@/components/admin/TournamentPayoutEditor';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';

const defaults={name:'Imperial Poker Night',format:'scheduled_mtt',variant:'holdem',seatsPerTable:8,tableCount:4,currency:'PRACTICE',buyInUnits:100,rakePercent:0,rakeCapUnits:0,noFlopNoDrop:true,rakeFromForcedBets:false,bombPotsEnabled:false,bombPotEveryHands:0,anteEnabled:false,anteUnits:0,initialStack:5000,blindLevels:[{small:25,big:50,durationMinutes:10}],realMoneyEnabled:false,feeCollectionEnabled:false};
const currencies=['PRACTICE','IC','ID','IGD','IGN'];
const Field=({label,children})=><label className="flex flex-col gap-1.5 text-sm text-gray-200"><span className="font-semibold">{label}</span>{children}</label>;
const fieldStyle='w-full rounded-lg border border-white/25 bg-[#191427] px-3 py-2 text-white';
const numberValue=value=>value===''?0:Number(value);
const numberConfig=form=>{
 const {rakePercent,...config}=form;
 return {
 ...config,
 tableCount:numberValue(form.tableCount),
 buyInUnits:numberValue(form.buyInUnits),
 initialStack:numberValue(form.initialStack),
 rakeBps:Math.round(numberValue(rakePercent)*100),
 rakeCapUnits:numberValue(form.rakeCapUnits),
 bombPotEveryHands:numberValue(form.bombPotEveryHands),
 anteUnits:numberValue(form.anteUnits),
 blindLevels:form.blindLevels.map(level=>({
  ...level,
  small:numberValue(level.small),
  big:numberValue(level.big),
  durationMinutes:numberValue(level.durationMinutes),
 })),
 };
};
export default function SuperadminPokerTournaments(){
 const {user}=useAuth();
 const [form,setForm]=useState(defaults),[presets,setPresets]=useState([]),[events,setEvents]=useState([]),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[selectedPreset,setSelectedPreset]=useState(null);
 const allowed=user?.role==='superadmin'&&!user?.is_excluded;
 const change=(key,value)=>setForm(old=>({...old,[key]:value}));
 const invoke=useCallback(async body=>{const {data,error}=await supabase.functions.invoke('ig-poker-tournament-admin',{body});if(error||data?.error)throw Error(data?.error||'Staging service unavailable');return data;},[]);
 const invokeEvents=useCallback(async body=>{const {data,error}=await supabase.functions.invoke('admin-poker-events',{body});if(error||data?.error)throw Error(data?.error||'Tournament event service unavailable');return data;},[]);
 const load=async()=>{if(!allowed)return;try{const r=await invoke({action:'list'});setPresets(r.presets||[]);}catch(e){setError(e.message);}};
 const loadEvents=async()=>{if(!allowed)return;try{const r=await invokeEvents({action:'list'});setEvents(r.events||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void load();void loadEvents();},[allowed]);
 const updateEvent=async(event,action)=>{
  if(saving)return;
  setSaving(true);setError('');setNotice('');
  try{
   const result=await invokeEvents({action,eventId:event.id,version:event.version,requestId:crypto.randomUUID()});
   setNotice(action==='publish'?'Tournament published to the practice tournament list.':'Tournament started. Registered players are being seated.');
   await loadEvents();
   return result;
  }catch(e){setError(e.message);}finally{setSaving(false);}
 };
 const createEvent=async preset=>{
  if(preset.currency!=='PRACTICE'||Number(preset.buy_in_units)!==0){
    setError('Only zero-buy-in PRACTICE presets can create staging events.');return;
  }
  setSaving(true);setError('');setNotice('');
  try{
    const result=await invoke({action:'createPracticeEvent',presetId:preset.id,requestId:crypto.randomUUID()});
    setNotice('Practice tournament draft created: '+result.event.eventId+'. Publish it below to list it for players.');
    await loadEvents();
  }catch(e){setError(e.message)}finally{setSaving(false)}
 };
 const save=async e=>{
  e.preventDefault();if(!allowed||saving)return;
  setSaving(true);setNotice('');setError('');
  try{const r=await invoke({action:'save',config:numberConfig(form)});setNotice('Draft saved. Capacity: '+r.preset.capacity+' seats. No real-money rake or buy-ins collected.');await load();}
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
    <Field label="Seats per table"><select className={fieldStyle} value={form.seatsPerTable} onChange={e=>change('seatsPerTable',Number(e.target.value))}>{(form.variant==='omaha'?[6]:[2,4,6,8,9]).map(n=><option key={n} value={n}>{n} players</option>)}</select></Field>
    <Field label="Number of tables (1–30)"><input type="number" min={1} max={30} required className={fieldStyle} value={form.tableCount} onChange={e=>change('tableCount',e.target.value)}/></Field>
    <div className="flex items-center rounded-xl border border-amber-300/25 bg-amber-300/10 p-4"><span className="font-black text-amber-200">{capacity} maximum seats</span></div>
    <Field label="Currency (configuration only)"><select className={fieldStyle} value={form.currency} onChange={e=>change('currency',e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field>
    <Field label="Buy-in price points (currency units)"><input type="number" min={0} step={1} className={fieldStyle} value={form.buyInUnits} onChange={e=>change('buyInUnits',e.target.value)}/></Field>
    <Field label="Starting tournament chips"><input type="number" min={100} max={10000000} required className={fieldStyle} value={form.initialStack} onChange={e=>change('initialStack',e.target.value)}/></Field>
    <Field label="Rake percentage per contested pot"><input type="number" min={0} max={10} step={0.01} className={fieldStyle} value={form.rakePercent} onChange={e=>change('rakePercent',e.target.value)}/></Field>
    <Field label="Rake cap (same currency units)"><input type="number" min={0} step={1} className={fieldStyle} value={form.rakeCapUnits} onChange={e=>change('rakeCapUnits',e.target.value)}/></Field>
    <Field label="Blind level duration (minutes)"><input type="number" min={1} max={120} required className={fieldStyle} value={form.blindLevels[0].durationMinutes} onChange={e=>change('blindLevels',[{...form.blindLevels[0],durationMinutes:e.target.value}])}/></Field>
    <Field label="Small blind"><input type="number" min={1} required className={fieldStyle} value={form.blindLevels[0].small} onChange={e=>change('blindLevels',[{...form.blindLevels[0],small:e.target.value}])}/></Field>
    <Field label="Big blind"><input type="number" min={2} required className={fieldStyle} value={form.blindLevels[0].big} onChange={e=>change('blindLevels',[{...form.blindLevels[0],big:e.target.value}])}/></Field>
    <Field label="Ante per player"><input type="number" min={0} className={fieldStyle} value={form.anteUnits} onChange={e=>setForm(v=>({...v,anteUnits:e.target.value,anteEnabled:numberValue(e.target.value)>0}))}/></Field>
   </div>
   <div className="space-y-3 border-t border-white/10 pt-5">
    <label className="flex items-center gap-3"><input type="checkbox" checked={form.noFlopNoDrop} onChange={e=>change('noFlopNoDrop',e.target.checked)}/><span>No flop, no drop (recommended for ring-game rake)</span></label>
    <label className="flex items-center gap-3 text-amber-200"><input type="checkbox" checked disabled/><span>Never rake forced small blinds, big blinds or antes before a played pot</span></label>
    <label className="flex items-center gap-3"><input type="checkbox" checked={form.bombPotsEnabled} onChange={e=>setForm(v=>({...v,bombPotsEnabled:e.target.checked,bombPotEveryHands:e.target.checked?5:0}))}/><span>Enable Bomb Pot specification (not yet playable)</span></label>
    {form.bombPotsEnabled&&<Field label="Bomb Pot every N hands"><input type="number" min={1} max={1000} required className={fieldStyle} value={form.bombPotEveryHands} onChange={e=>change('bombPotEveryHands',e.target.value)}/></Field>}
   </div>
   <button disabled={saving} type="submit" className="rounded-xl bg-amber-400 px-6 py-3 font-black text-gray-950 disabled:opacity-50">{saving?'Saving…':'Save staging tournament preset'}</button>
   {notice&&<p role="status" className="text-emerald-300">{notice}</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}
  </form>
  <section className="rounded-2xl border border-white/15 bg-[#1c1729] p-5"><h2 className="text-xl font-black">Saved draft tournament presets</h2>
   <div className="mt-4 space-y-2">{presets.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-3 text-sm"><span>{p.name} · {p.format} · {p.variant}</span><span>{p.seats_per_table} seats × {p.table_count} tables · {p.currency} {p.buy_in_units} · {p.rake_bps/100}% rake</span>
    <button type="button" onClick={()=>setSelectedPreset(selectedPreset===p.id?null:p.id)} className="rounded-lg border border-amber-300 px-3 py-1 font-bold text-amber-200">{selectedPreset===p.id?'Close prizes':'Configure prize positions (up to 100)'}</button>
    {p.currency==='PRACTICE'&&Number(p.buy_in_units)===0&&<button type="button" disabled={saving} onClick={()=>void createEvent(p)} className="rounded-lg border border-amber-300 px-3 py-1 font-bold text-amber-200 disabled:opacity-50">Create draft event</button>}</div>)}
   {!presets.length&&<p className="text-gray-400">No saved staging presets.</p>}</div>
   {presets.some(p=>p.id===selectedPreset)&&<div className="mt-5">
    <TournamentPayoutEditor preset={presets.find(p=>p.id===selectedPreset)} invoke={invoke} onSaved={load}/>
   </div>}
  </section>
  <section className="rounded-2xl border border-white/15 bg-[#1c1729] p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Tournament events</h2><p className="mt-1 text-sm text-gray-300">Publish makes a free PRACTICE event visible in the player tournament list. Starting seats registered players; no payment is collected.</p></div><button type="button" onClick={()=>void loadEvents()} disabled={saving} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold disabled:opacity-50">Refresh</button></div>
   <div className="mt-4 space-y-3">
    {events.map(event=><div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
     <div><p className="font-bold">{event.name}</p><p className="mt-1 text-sm text-gray-300">{event.format.replaceAll('_',' ')} · {event.status} · {event.config?.practiceOnly===true?'PRACTICE ONLY':'review config'} · {event.version} registered version</p><p className="mt-1 break-all text-xs text-gray-500">{event.id}</p></div>
     <div className="flex gap-2">
      {event.status==='draft'&&<button type="button" onClick={()=>void updateEvent(event,'publish')} disabled={saving} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-50">Publish to tournaments</button>}
      {event.status==='registration'&&<button type="button" onClick={()=>void updateEvent(event,'start')} disabled={saving} className="rounded-lg bg-emerald-300 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-50">Start and seat players</button>}
     </div>
    </div>)}
    {!events.length&&<p className="text-sm text-gray-400">No tournament events have been created yet.</p>}
   </div>
  </section>
 </div></main>;
}
