import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function ResetPassword() {
  const { user, isAuthenticated, isLoadingAuth, authLinkError, clearAuthLinkError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  const account = useRef(user?.id);
  useEffect(() => {
    if (account.current !== user?.id) {
      account.current = user?.id;
      setPassword(''); setConfirm(''); setDone(false);
      setError('Your session changed. Check the account shown before continuing.');
    }
  }, [user?.id]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !user || authLinkError) return;
    if (password !== confirm) { setError('Passwords must match.'); return; }
    const owner = user.id;
    submitting.current = true; setBusy(true); setError('');
    try {
      const { data, error: identityError } = await supabase.auth.getUser();
      if (identityError || data.user?.id !== owner || account.current !== owner) {
        setPassword(''); setConfirm('');
        throw new Error('Your session changed or expired. Request a new reset link.');
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (account.current === owner) { setDone(true); setPassword(''); setConfirm(''); }
    } catch (err) { setError(err.message || 'Password update failed. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  const requestLink = <Link className="text-amber-300" to="/login?mode=recovery" onClick={clearAuthLinkError}>Request a new link</Link>;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white"><section className="w-full max-w-md space-y-5 rounded-xl border border-white/20 bg-slate-900 p-8"><h1 className="text-2xl font-bold">Choose a new password</h1>
    {isLoadingAuth ? <p>Checking reset link…</p> : authLinkError ? <p role="alert">{authLinkError} {requestLink}</p> : done ? <p role="status">Password updated. <Link className="text-amber-300" to="/">Continue to your account</Link></p> : !isAuthenticated ? <p>The reset link is missing or expired. {requestLink}</p> : <>
      <p className="break-all text-sm text-slate-300">Updating the password for {user.email}.</p>
      <form onSubmit={submit} aria-busy={busy} className="space-y-4"><fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">New account password</legend>
        <label className="block">New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded bg-slate-800 p-3" /></label>
        <label className="block">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full rounded bg-slate-800 p-3" /></label>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-amber-300 p-3 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Update password'}</button>
      </fieldset></form>
    </>}
  </section></main>;
}
