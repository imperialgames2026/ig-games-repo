import React,{useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {supabase} from '@/lib/supabaseClient';
import {VIP_WHEEL_STAGES} from '@/lib/vipLevelSpins';
import {createVipWheelSettings,validateWheelSegments,wheelOdds} from '@/lib/vipWheelSettings';
const service=createVipWheelSettings(supabase);

function WheelPreview({segments,stage}){
 const palettes={1:['#047857','#10b981'],2:['#b45309','#f59e0b'],3:['#6d28d9','#a78bfa']};
 const point=angle=>[120+105*Math.cos(angle),120+105*Math.sin(angle)];
 return <svg viewBox="0 0 240 240" role="img" aria-label={'Stage '+stage+' wheel section preview'} className="mx-auto w-60 max-w-full">
  {segments.map((row,i)=>{const start=i*2*Math.PI/segments.length-Math.PI/2,end=(i+1)*2*Math.PI/segments.length-Math.PI/2,a=point(start),b=point(end),middle=(start+end)/2;return <g key={row.slot}><path d={`M120 120 L${a[0]} ${a[1]} A105 105 0 0 1 ${b[0]} ${b[1]} Z`} fill={Number(row.weight)===0?'#374151':palettes[stage][i%2]} stroke="#14121e" strokeWidth="2"><title>{`Section ${row.slot}: ${row.reward}, ${row.amount} ${row.unit}`}</title></path><text x={120+80*Math.cos(middle)} y={125+80*Math.sin(middle)} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{row.slot}</text></g>;})}
  <circle cx="120" cy="120" r="43" fill="#11121d" stroke="#ffffff33" strokeWidth="2"/><text x="120" y="117" textAnchor="middle" fill="white" fontSize="12">STAGE</text><text x="120" y="141" textAnchor="middle" fill="#fde68a" fontSize="23" fontWeight="bold">{stage}</text>
 </svg>;
}
function WheelEditor({user}){
 const cache=useQueryClient(),key=['vip-wheel-settings',user?.id];
 const settings=useQuery({queryKey:key,queryFn:()=>service.list(),enabled:!!user?.id,retry:1});
 const [stage,setStage]=useState(1),[drafts,setDrafts]=useState({}),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const editable=user?.role==='superadmin'&&!user?.is_excluded;
 const config=settings.data?.find(row=>row.stage===stage),draft=drafts[stage],rows=draft?.segments??config?.segments??[],info=VIP_WHEEL_STAGES[stage-1];
 const odds=wheelOdds(rows),stale=!!draft&&draft.revision!==config?.revision;
 const change=(index,field,value)=>setDrafts(previous=>({...previous,[stage]:{...previous[stage],segments:previous[stage].segments.map((row,i)=>i===index?{...row,[field]:value}:row)}}));
 const edit=()=>{setDrafts(previous=>({...previous,[stage]:{revision:config.revision,segments:config.segments.map(row=>({...row,weight:String(row.weight)}))}}));setError('');setNotice('');};
 const save=async event=>{
  event.preventDefault();setSaving(true);setError('');setNotice('');
  try{
   if(draft.segments.some(row=>!/^\d+$/.test(row.weight)))throw Error('Section weights must be whole numbers from 0 to 10,000.');
   const segments=validateWheelSegments(draft.segments.map(row=>({...row,weight:Number(row.weight)})));
   const result=await service.save(stage,segments,draft.revision);
   cache.setQueryData(key,previous=>previous.map(row=>row.stage===stage?result:row));
   setDrafts(previous=>{const next={...previous};delete next[stage];return next;});setNotice(`Stage ${stage} settings saved.`);
  }catch(e){setError(e.message||'Save could not be confirmed. Retry the unchanged draft.');}finally{setSaving(false);}
 };
 return <section className="mx-auto max-w-6xl space-y-6 text-white">
  <header><h1 className="text-3xl font-bold">Reward Wheel Settings</h1><p className="mt-2 text-slate-400">Set each section’s reward, amount, unit and odds for all three VIP wheels.</p></header>
  <div className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm text-amber-100">Draft prize settings. Saving changes does not enable spinning or pay rewards. Earned level spins stay saved while reward fulfillment is completed.</div>
  <div aria-label="Choose reward wheel" className="grid gap-3 sm:grid-cols-3">{VIP_WHEEL_STAGES.map(wheel=><button key={wheel.stage} disabled={saving} aria-pressed={stage===wheel.stage} className={'rounded-xl border p-4 text-left '+(stage===wheel.stage?'border-amber-300 bg-amber-300/10':'border-white/10 bg-white/5')} onClick={()=>{setStage(wheel.stage);setError('');setNotice('');}}><span className="block font-bold">{wheel.name}{drafts[wheel.stage]?' · Unsaved':''}</span><span className="text-sm text-slate-400">Levels {wheel.minLevel}–{wheel.maxLevel}</span></button>)}</div>
  {(error||settings.error)&&<p role="alert" className="text-red-200">{error||'Wheel settings could not be loaded.'}</p>}{notice&&<p role="status" className="text-emerald-200">{notice}</p>}
  {settings.isPending&&<p>Loading wheel settings…</p>}
  {config&&<>
   <div className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[240px_1fr]">
    <WheelPreview segments={rows} stage={stage}/><div className="space-y-3 self-center"><h2 className="text-2xl font-bold">{info.name} · Levels {info.minLevel}–{info.maxLevel}</h2><p className="text-sm text-slate-300">One spin per level reached. Saved revision {config.revision}.</p><p className="text-sm text-slate-400">Section numbers match the preview. Odds come from each section’s weight divided by the total. Weight 0 excludes a section; slice size is only a layout preview.</p><p className="text-sm text-slate-400">Keep units explicit, such as ID, IGT, BTC, spins or multiplier. Add game, stake, eligibility or duration rules in Notes. Amounts retain up to 8 decimal places.</p>
     {!editable&&<p>Only a superadmin can change wheel rewards.</p>}
     {editable&&!draft&&!settings.error&&<button className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-black" onClick={edit}>Edit stage {stage} rewards</button>}
    </div>
   </div>
   {stale&&<p role="alert" className="text-amber-200">A newer version exists. Your draft is preserved; discard it and reload before editing again.</p>}
   <form onSubmit={save} className="space-y-4"><fieldset disabled={!editable||!draft||saving} className="space-y-4">
    {rows.map((row,index)=><section key={row.slot} aria-label={'Section '+row.slot} className="rounded-xl border border-white/10 bg-[#161724] p-4">
     <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-bold">Section {row.slot}</h3><span className="text-sm text-amber-200">Odds: {odds[index].toFixed(2)}%</span></div>
     <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Reward<input aria-label={'Section '+row.slot+' reward'} value={row.reward} required className="mt-1 w-full rounded bg-white/10 p-3" onChange={e=>change(index,'reward',e.target.value)}/></label>
      <label className="text-sm">Amount<input aria-label={'Section '+row.slot+' amount'} value={row.amount} required inputMode="decimal" className="mt-1 w-full rounded bg-white/10 p-3" onChange={e=>change(index,'amount',e.target.value)}/></label>
      <label className="text-sm">Unit<input aria-label={'Section '+row.slot+' unit'} value={row.unit} required className="mt-1 w-full rounded bg-white/10 p-3" onChange={e=>change(index,'unit',e.target.value)}/></label>
      <label className="text-sm">Weight<input aria-label={'Section '+row.slot+' weight'} type="number" min="0" max="10000" step="1" value={row.weight} required className="mt-1 w-full rounded bg-white/10 p-3" onChange={e=>change(index,'weight',e.target.value)}/></label>
     </div>
     <label className="mt-4 block text-sm">Notes<input aria-label={'Section '+row.slot+' notes'} value={row.notes} className="mt-1 w-full rounded bg-white/10 p-3" onChange={e=>change(index,'notes',e.target.value)}/></label>
     {draft&&<button type="button" disabled={rows.length<=2} className="mt-3 text-sm text-red-200 disabled:opacity-40" onClick={()=>setDrafts(previous=>({...previous,[stage]:{...previous[stage],segments:previous[stage].segments.filter((_,i)=>i!==index).map((item,i)=>({...item,slot:i+1}))}}))}>Remove section {row.slot}</button>}
    </section>)}
    {draft&&<div className="flex flex-wrap gap-4"><button type="button" disabled={rows.length>=24} className="rounded-lg border border-white/20 px-4 py-3" onClick={()=>setDrafts(previous=>({...previous,[stage]:{...previous[stage],segments:[...previous[stage].segments,{slot:rows.length+1,reward:'',amount:'0',unit:'ID',weight:'0',notes:''}]}}))}>Add section</button><button type="submit" disabled={stale} className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-black disabled:opacity-40">{saving?'Saving…':`Save stage ${stage} rewards`}</button><button type="button" onClick={()=>{setDrafts(previous=>{const next={...previous};delete next[stage];return next;});setError('');void settings.refetch();}}>Discard stage {stage} draft and reload</button></div>}
   </fieldset></form>
  </>}
  {!draft&&<button disabled={settings.isFetching} className="text-sm underline" onClick={()=>void settings.refetch()}>Reload wheel settings</button>}
 </section>;
}
export default function AdminRewardWheels(){const {user}=useAuth();return <WheelEditor key={user?.id??'signed-out'} user={user}/>;}
