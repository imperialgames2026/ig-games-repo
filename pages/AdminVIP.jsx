import React,{useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/lib/AuthContext';
import {useVipCatalog,vipCatalog} from '@/hooks/useVipCatalog';
import {validateVipLevels} from '@/lib/vipCatalog';

function VipEditor({user}){
 const catalog=useVipCatalog(),cache=useQueryClient();
 const [draft,setDraft]=useState(null),[revision,setRevision]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const editable=user?.role==='superadmin'&&!user?.is_excluded;
 const begin=()=>{setDraft(catalog.data.levels.map(row=>({...row,xp_required:String(row.xp_required)})));setRevision(catalog.data.revision);setError('');setNotice('');};
 const save=async event=>{
  event.preventDefault();setSaving(true);setError('');setNotice('');
  try{
   if(draft.some(row=>!/^\d+$/.test(row.xp_required)))throw Error('XP thresholds must be whole numbers.');
   const levels=validateVipLevels(draft.map(row=>({...row,xp_required:Number(row.xp_required)})));
   const result=await vipCatalog.save(levels,revision);
   cache.setQueryData(['vip-catalog'],result);setDraft(null);setNotice('VIP schedule published.');
  }catch(e){setError(e.message||'Save could not be confirmed. Retry the unchanged draft.');}
  finally{setSaving(false);}
 };
 const rows=draft??catalog.data?.levels??[];
 return <section className="mx-auto max-w-5xl space-y-6 text-white">
  <header><h1 className="text-3xl font-bold">VIP Level Settings</h1><p className="mt-2 text-slate-400">The published XP thresholds are shared by every player VIP display.</p></header>
  <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Changing thresholds changes displayed ranks. It does not award XP or bonuses. Practice rounds do not earn wager-based XP. Bonus payouts await the approved reward rules.</p>
  {(error||catalog.error)&&<p role="alert" className="text-red-200">{error||'The VIP schedule could not be loaded.'}</p>}
  {notice&&<p role="status" className="text-emerald-200">{notice}</p>}
  {catalog.isPending&&<p>Loading VIP schedule…</p>}
  <div className="flex flex-wrap gap-4 text-sm text-slate-300">
   {catalog.data&&<span>Published revision {catalog.data.revision}</span>}
   {!draft&&<button className="underline" disabled={catalog.isFetching} onClick={()=>void catalog.refetch()}>Reload schedule</button>}
   {editable&&catalog.data&&!draft&&!catalog.error&&<button className="font-bold text-amber-200" onClick={begin}>Edit XP thresholds</button>}
   {!editable&&<span>Only a superadmin can publish changes.</span>}
  </div>
  {draft&&catalog.data?.revision!==revision&&<p role="alert" className="text-amber-200">A newer schedule has been published. Your draft is preserved; discard it and reload before editing again.</p>}
  <form onSubmit={save} className="space-y-4">
   <fieldset disabled={!editable||saving}>
    <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">All 34 VIP levels and required XP</caption><thead className="bg-white/5"><tr><th className="p-3">Level</th><th className="p-3">Rank</th><th className="p-3">Tier</th><th className="p-3">Required XP</th></tr></thead><tbody>
     {rows.map((row,i)=><tr key={row.level} className="border-t border-white/10"><td className="p-3">{row.level}</td><th scope="row" className="p-3 font-medium">{row.name}</th><td className="p-3 text-slate-400">{row.tier}</td><td className="p-3">{draft?<input aria-label={row.name+' required XP'} type="text" inputMode="numeric" pattern="[0-9]+" required readOnly={i===0} className="w-40 rounded bg-white/10 p-2 read-only:opacity-60" value={row.xp_required} onChange={e=>setDraft(previous=>previous.map((item,index)=>index===i?{...item,xp_required:e.target.value}:item))}/>:Number(row.xp_required).toLocaleString()}</td></tr>)}
    </tbody></table></div>
    {draft&&<div className="mt-4 flex gap-4"><button disabled={catalog.data?.revision!==revision} type="submit" className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-black disabled:opacity-50">{saving?'Publishing…':'Publish VIP schedule'}</button><button type="button" onClick={()=>{setDraft(null);setError('');void catalog.refetch();}}>Discard draft and reload</button></div>}
   </fieldset>
  </form>
 </section>;
}
export default function AdminVIP(){const {user}=useAuth();return <VipEditor key={user?.id??'signed-out'} user={user}/>;}
