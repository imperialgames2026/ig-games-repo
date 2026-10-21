import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function ResetPassword() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !isAuthenticated || isLoadingAuth) return;
    if (password !== confirm) { setError('Passwords must match.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.auth.updateUser({ password });
      if (failure) throw failure;
      setDone(true); setPassword(''); setConfirm('');
    } catch (failure) { setError(failure.message || 'Your password could not be updated. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0d0a17] p-3 text-base text-white outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20';
  return <main className="flex min-h-screen items-center justify-center bg-[#0A0612] p-4 py-12 text-white"><section className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-[#21162f] to-[#130e20] p-6 shadow-2xl sm:p-8">
    <Link className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" /> Back to Imperial Games</Link>
    <div className="inline-flex rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3"><KeyRound className="h-6 w-6 text-amber-300" /></div>
    <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">Your Imperial Games account</p><h1 className="mt-3 text-3xl font-black">Choose a new password</h1></div>
    {isLoadingAuth ? <p role="status" className="flex items-center gap-2 text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Checking reset link…</p> : done ? <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-950/30 p-5 text-emerald-100"><CheckCircle2 className="mb-3 h-6 w-6" /><p>Password updated.</p><Link className="mt-3 inline-block font-semibold text-amber-300 underline underline-offset-4" to="/">Continue to your account</Link></div> : !isAuthenticated ? <div className="space-y-4"><p className="text-sm leading-6 text-gray-300">The reset link is missing or expired. Request a new link, then open the most recent email on this device.</p><Link className="inline-flex min-h-11 items-center rounded-xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 font-semibold text-pink-200 hover:bg-pink-500/20" to="/login?mode=recovery">Request a new link</Link></div> : <form onSubmit={submit} aria-busy={busy} className="space-y-5">
      <p className="text-sm leading-6 text-gray-400">Use at least 8 characters. Choose a password you don’t use for another account.</p>
      <fieldset disabled={busy} className="min-w-0 space-y-5"><legend className="sr-only">Update your password</legend>
        <div><label htmlFor="reset-password" className="text-sm font-semibold">New password</label><div className="relative"><input id="reset-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className={field + ' pr-14'} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center rounded-xl text-gray-400 hover:text-white">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
        <div><label htmlFor="reset-confirm" className="text-sm font-semibold">Confirm new password</label><input id="reset-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} className={field} /></div>
        {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 p-3.5 font-bold disabled:opacity-50">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Update password'}</button>
      </fieldset>
    </form>}
  </section></main>;
}
