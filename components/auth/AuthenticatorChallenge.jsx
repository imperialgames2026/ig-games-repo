import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { authenticatorError, verifiedAuthenticators, verifyAuthenticator } from '@/lib/mfa';

export default function AuthenticatorChallenge() {
  const { checkAppState, logout } = useAuth();
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    verifiedAuthenticators(supabase).then(items => {
      if (!active) return;
      setFactors(items); setFactorId(items[0]?.id || '');
      if (!items.length) setError('No verified authenticator was found. Retry account verification.');
    }).catch(() => { if (active) setError('Could not load your authenticators. Retry account verification.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await verifyAuthenticator(supabase, factorId, code); setCode(''); await checkAppState(); }
    catch (err) { setCode(''); setError(authenticatorError(err)); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function signOut() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    try { await logout(); }
    catch { setError('Sign-out failed. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-slate-900 p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Imperial Games</p>
      <h1 className="text-2xl font-bold">Two-step verification</h1>
      <p className="text-sm text-slate-300">Open your authenticator app and enter the current six-digit code.</p>
      {loading ? <p role="status">Loading authenticators…</p> : <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        <fieldset disabled={busy || !factorId} className="space-y-4">
          <legend className="sr-only">Verify your authenticator</legend>
          {factors.length > 1 && <label className="block text-sm">Authenticator<select value={factorId} onChange={e => { setFactorId(e.target.value); setCode(''); }} className="mt-2 w-full rounded bg-slate-800 p-3">{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select></label>}
          <label className="block text-sm">Authenticator code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded border border-white/20 bg-slate-950 p-3 text-lg tracking-widest" /></label>
          <button className="w-full rounded bg-amber-400 p-3 font-semibold text-slate-950 disabled:opacity-50" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
        </fieldset>
      </form>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!loading && !factors.length && <button onClick={() => checkAppState()} disabled={busy} className="text-amber-300">Retry account verification</button>}
      <p className="text-sm text-slate-400">Lost your device? Use your backup authenticator. Resetting your password does not remove two-step verification.</p>
      <button onClick={signOut} disabled={busy} className="text-sm text-amber-300">Sign out</button>
    </section>
  </main>;
}
