import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';
import {createKyc,KYC_CONSENT_VERSION} from '@/lib/kyc';
import {ShieldCheck,LockKeyhole} from 'lucide-react';
const api=createKyc(supabase),input='mt-2 w-full rounded-xl border border-white/20 bg-[#151422] px-4 py-3 text-white';
export default function KycSubmission(){
 const {user}=useAuth();const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [form,setForm]=useState({full_name:'',birth_date:'',country:'',document_type:'passport',consent:false,face_consent:false});
 const [files,setFiles]=useState({}),[uploaded,setUploaded]=useState({});
 const load=useCallback(async()=>{setLoading(true);try{setRows(await api.action('mine'));setError('');}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const active=rows.find(r=>['draft','submitted','escalated'].includes(r.status));
 const kinds=(active?.document_type||form.document_type)==='passport'?['id_front','selfie']:['id_front','id_back','selfie'];
 const labels={id_front:'ID front or passport photo page',id_back:'ID back',selfie:'Your selfie'};
 const change=e=>setForm({...form,[e.target.name]:e.target.type==='checkbox'?e.target.checked:e.target.name==='country'?e.target.value.toUpperCase():e.target.value});
 async function run(work){setBusy(true);setError('');setMessage('');try{await work();await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function begin(e){e.preventDefault();await run(async()=>{const row=await api.action('begin',{...form,consent_version:KYC_CONSENT_VERSION});setRows([row,...rows]);setForm({...form,full_name:'',birth_date:''});setMessage('Draft created. Add your images below.');});}
 async function submit(e){e.preventDefault();await run(async()=>{
  for(const kind of kinds){if(uploaded[kind])continue;if(!files[kind])continue;await api.upload(active.id,kind,files[kind]);setUploaded(old=>({...old,[kind]:true}));}
  await api.action('submit',{id:active.id});setFiles({});setUploaded({});setMessage('Your identity documents were submitted for human review.');
 });}
 return <main className="min-h-screen bg-[#0A0612] px-4 py-10 text-white"><div className="mx-auto max-w-3xl space-y-6">
  <Link className="text-sm text-amber-300 underline" to="/Profile">← Back to profile</Link>
  <header><h1 className="mt-5 flex items-center gap-3 text-3xl font-black"><ShieldCheck className="text-amber-300"/>Identity verification</h1><p className="mt-3 text-gray-300">Submit identity evidence privately and follow your review here.</p></header>
  <section className="rounded-2xl border border-white/10 bg-[#18162b] p-6"><h2 className="font-bold">Account status</h2><p className="mt-2 capitalize text-amber-200">{String(user?.kyc_status||'not_started').replaceAll('_',' ')}</p><p className="mt-2 text-sm text-gray-400">Identity approval is separate from location checks, eligibility and transaction approval.</p></section>
  <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm leading-6"><h2 className="flex items-center gap-2 font-bold text-amber-200"><LockKeyhole size={18}/>How your information is handled</h2>
   <p className="mt-3">Images are stored privately in Imperial Games’ Supabase service. Authorized reviewers can open temporary access links. Identity details and images expire after 30 days and are queued for deletion; a minimal review audit is retained. Cancelling an open submission queues its evidence for deletion.</p>
   <p className="mt-3">Optional face comparison processes your ID portrait and selfie on Imperial Games’ private comparison computer. Temporary images are removed after processing. It does not retain face templates. Its similarity index is advisory, not a probability of identity, a liveness test, or proof that a document is authentic. A human makes the review decision.</p>
   <Link to="/Support" className="mt-3 inline-block text-amber-300 underline">Questions, corrections or review appeals</Link>
  </section>
  {loading&&<p role="status">Loading your submissions…</p>}{error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</p>}{message&&<p role="status" className="rounded-xl bg-emerald-400/10 p-4 text-emerald-200">{message}</p>}
  {!loading&&!active&&!error&&<form onSubmit={begin} className="space-y-5 rounded-2xl border border-white/10 bg-[#18162b] p-6">
   <h2 className="text-xl font-bold">Start a submission</h2>
   <label className="block">Full legal name<input name="full_name" autoComplete="name" maxLength={120} minLength={2} required value={form.full_name} onChange={change} className={input}/></label>
   <div className="grid gap-5 sm:grid-cols-2"><label>Date of birth<input name="birth_date" type="date" autoComplete="bday" required value={form.birth_date} onChange={change} className={input}/></label><label>Issuing country code<input name="country" placeholder="US, CA, BR…" pattern="[A-Z]{2}" maxLength={2} required value={form.country} onChange={change} className={input}/></label></div>
   <div><label htmlFor="kyc-document-type" className="block">Document type</label><select id="kyc-document-type" name="document_type" value={form.document_type} onChange={change} className={input}><option value="passport">Passport</option><option value="driver_license">Driver’s license</option><option value="national_id">National ID card</option></select></div>
   <label className="flex items-start gap-3 text-sm"><input name="consent" type="checkbox" checked={form.consent} onChange={change} required className="mt-1"/><span>I consent to Imperial Games processing my identity details, document images and selfie for human identity verification as described above.</span></label>
   <label className="flex items-start gap-3 text-sm"><input name="face_consent" type="checkbox" checked={form.face_consent} onChange={change} className="mt-1"/><span>I also consent to the optional advisory facial comparison. I can leave this unchecked and request human review.</span></label>
   <button disabled={busy||!form.consent} className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-black disabled:opacity-50">{busy?'Preparing…':'Create private submission'}</button>
  </form>}
  {active?.status==='draft'&&<form onSubmit={submit} className="space-y-5 rounded-2xl border border-white/10 bg-[#18162b] p-6"><h2 className="text-xl font-bold">Add identity images</h2><p className="text-sm text-gray-400">Use clear JPEG, PNG or WebP images, 120–6000 pixels, up to 24 megapixels and 8 MiB each. Uploaded images cannot be replaced; cancel the draft to start again.</p>
   {kinds.map(kind=><label key={kind} className="block">{labels[kind]}<input type="file" accept="image/jpeg,image/png,image/webp" capture={kind==='selfie'?'user':undefined} disabled={busy||uploaded[kind]} onChange={e=>setFiles({...files,[kind]:e.target.files?.[0]})} className={input}/>{uploaded[kind]&&<span className="mt-2 block text-sm text-emerald-200">Uploaded</span>}</label>)}
   <button disabled={busy} className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-black disabled:opacity-50">{busy?'Uploading securely…':'Submit for human review'}</button>
  </form>}
  {active&&<section className="rounded-2xl border border-white/10 p-6"><p>Current submission: <strong className="capitalize text-amber-200">{active.status.replaceAll('_',' ')}</strong></p><button type="button" disabled={busy} onClick={()=>void run(async()=>{await api.action('cancel',{id:active.id});setFiles({});setUploaded({});setMessage('Submission cancelled. Its evidence is queued for deletion.');})} className="mt-4 text-sm text-red-200 underline">Cancel this submission</button></section>}
  <section><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Submission history</h2><button onClick={()=>void load()} disabled={busy||loading} className="text-sm text-amber-300 underline">Refresh status</button></div>
   <div className="mt-4 space-y-3">{rows.map(row=><article key={row.id} className="rounded-xl border border-white/10 p-4"><p className="capitalize font-semibold">{row.document_type.replaceAll('_',' ')} · {row.status.replaceAll('_',' ')}</p><p className="mt-1 text-sm text-gray-400">{row.created_at?new Date(row.created_at).toLocaleString():'New submission'} · {row.evidence_deleted_at?'Evidence deleted':'Evidence expires '+new Date(row.expires_at).toLocaleDateString()}</p>{row.customer_message&&<p className="mt-3 text-sm text-amber-100">Reviewer message: {row.customer_message}</p>}</article>)}</div>
  </section>
 </div></main>;
}
