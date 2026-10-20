import React,{useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/lib/supabaseClient';
import {createAnnouncements} from '@/lib/announcements';
const service=createAnnouncements(supabase);
const blank=()=>({title:'',message:'',type:'special',link_url:'',priority:0,is_active:false,expires_at:''});
export default function AdminAnnouncements(){
 const cache=useQueryClient(),[form,setForm]=useState(blank),[id,setId]=useState(()=>crypto.randomUUID()),[revision,setRevision]=useState(),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const list=useQuery({queryKey:['announcements-admin'],queryFn:()=>service.list({admin:true}),retry:false});
 const reset=()=>{setForm(blank());setId(crypto.randomUUID());setRevision(undefined);setError('');};
 const refresh=async()=>{await Promise.all([cache.invalidateQueries({queryKey:['announcements']}),cache.invalidateQueries({queryKey:['announcements-admin']})]);};
 const save=async(e)=>{
  e.preventDefault();setSaving(true);setError('');setNotice('');
  try{await service.save(form,{id,revision});reset();setNotice('Announcement saved.');void refresh();}
  catch(e){setError(e.message||'Save unavailable. Retry without changing the draft.');}finally{setSaving(false);}
 };
 const archive=async(row)=>{setSaving(true);setError('');setNotice('');try{await service.save({...row,is_active:false},{id:row.id,revision:row.revision});setNotice('Announcement archived.');void refresh();}catch(e){setError(e.message||'Archive unavailable.');}finally{setSaving(false);}};
 const change=(key,value)=>setForm(v=>({...v,[key]:value}));
 return <main className="mx-auto max-w-6xl space-y-6 text-white">
  <header><h1 className="text-3xl font-bold">Manage Announcements</h1><p className="mt-2 text-slate-400">Create and publish banners for the site. New drafts start inactive.</p></header>
  {(error||list.error)&&<p role="alert" className="rounded-xl border border-red-400/40 p-4 text-red-200">{error||list.error.message}</p>}
  {notice&&<p role="status" className="text-emerald-200">{notice}</p>}
  <div className="grid gap-6 lg:grid-cols-2">
   <form onSubmit={save} className="space-y-4 rounded-2xl border border-white/10 bg-[#171827] p-6">
    <h2 className="text-xl font-bold">{revision?'Edit Announcement':'Create New Announcement'}</h2>
    <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
     <label className="block">Title<input className="mt-1 w-full rounded bg-white/10 p-3" value={form.title} onChange={e=>change('title',e.target.value)} maxLength={160} required/></label>
     <label className="block">Message<textarea className="mt-1 w-full rounded bg-white/10 p-3" value={form.message} onChange={e=>change('message',e.target.value)} maxLength={3000} required/></label>
     <label className="block">Type<select className="mt-1 w-full rounded bg-[#252638] p-3" value={form.type} onChange={e=>change('type',e.target.value)}><option value="special">Special</option><option value="challenge">Challenge</option><option value="tournament">Tournament</option></select></label>
     <label className="block">Link URL (optional)<input className="mt-1 w-full rounded bg-white/10 p-3" value={form.link_url} onChange={e=>change('link_url',e.target.value)} placeholder="https://... or /Games"/></label>
     <label className="block">Priority<input className="mt-1 w-full rounded bg-white/10 p-3" type="number" min={-1000} max={1000} step={1} value={form.priority} onChange={e=>change('priority',e.target.value)}/></label>
     <label className="block">Expires At (optional)<input className="mt-1 w-full rounded bg-white/10 p-3" type="datetime-local" value={form.expires_at} onChange={e=>change('expires_at',e.target.value)}/></label>
     <label className="flex items-center gap-3"><input type="checkbox" checked={form.is_active} onChange={e=>change('is_active',e.target.checked)}/>Active</label>
     <div className="flex gap-3"><button className="rounded-lg bg-amber-300 px-5 py-3 font-bold text-black" type="submit">{saving?'Saving…':revision?'Update':'Create'}</button><button className="rounded-lg border border-white/20 px-5 py-3" type="button" onClick={reset}>New draft</button></div>
    </fieldset>
   </form>
   <section className="space-y-4"><h2 className="text-xl font-bold">Current Announcements</h2>
    {list.isPending?<p>Loading announcements…</p>:!list.error&&!list.data?.length?<p>No announcements yet.</p>:null}
    {list.data?.map(row=><article key={row.id} className="space-y-3 rounded-xl border border-white/10 bg-[#171827] p-5"><h3 className="font-bold">{row.title}</h3><p className="whitespace-pre-wrap text-slate-300">{row.message}</p><p className="text-sm text-slate-400">{row.is_active?'Active':'Inactive'} · Priority {row.priority}{row.expires_at?' · Expires '+new Date(row.expires_at).toLocaleString():''}</p><div className="flex gap-4"><button disabled={saving} className="text-amber-200" onClick={()=>{setId(row.id);setRevision(row.revision);setForm({...row,link_url:row.link_url||'',expires_at:row.expires_at?new Date(new Date(row.expires_at).getTime()-new Date(row.expires_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''});setError('');setNotice('');}}>Edit {row.title}</button><button disabled={saving||!row.is_active} className="text-slate-300 disabled:opacity-40" onClick={()=>archive(row)}>Archive {row.title}</button></div></article>)}
   </section>
  </div>
 </main>;
}
