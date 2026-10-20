import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/lib/AuthContext';
export default function ResetPassword(){
 const {isAuthenticated,isLoadingAuth}=useAuth();
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function submit(e){e.preventDefault();if(password!==confirm){setError('Passwords must match.');return;}setBusy(true);setError('');try{const{error:err}=await supabase.auth.updateUser({password});if(err)throw err;setDone(true);setPassword('');setConfirm('');}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white"><section className="w-full max-w-md space-y-5 rounded-xl border border-white/20 bg-slate-900 p-8"><h1 className="text-2xl font-bold">Choose a new password</h1>
 {isLoadingAuth?<p>Checking reset link…</p>:done?<p role="status">Password updated. <Link className="text-amber-300" to="/">Continue to your account</Link></p>:!isAuthenticated?<p>The reset link is missing or expired. <Link className="text-amber-300" to="/login">Request a new link</Link></p>:<form onSubmit={submit} className="space-y-4">
 <label className="block">New password<input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded bg-slate-800 p-3"/></label>
 <label className="block">Confirm new password<input aria-label="Confirm new password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 w-full rounded bg-slate-800 p-3"/></label>
 {error&&<p role="alert" className="text-red-300">{error}</p>}<button disabled={busy} className="w-full rounded bg-amber-300 p-3 font-bold text-slate-950 disabled:opacity-50">{busy?'Saving…':'Update password'}</button></form>}
 </section></main>;
}
