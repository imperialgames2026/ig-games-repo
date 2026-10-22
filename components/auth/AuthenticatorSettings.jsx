import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { authenticatorError, verifiedAuthenticators, verifyAuthenticator } from '@/lib/mfa';

export default function AuthenticatorSettings() {
  const { checkAppState } = useAuth();
  const [factors, setFactors] = useState([]);
  const [pending, setPending] = useState(null);
  const [removeId, setRemoveId] = useState('');
  const [verifyId, setVerifyId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    verifiedAuthenticators(supabase).then(items => { if (active.current) setFactors(items); })
      .catch(() => { if (active.current) setError('Could not load security settings. Reload this page to retry.'); })
      .finally(() => { if (active.current) setLoading(false); });
    return () => { active.current = false; };
  }, []);
  async function run(operation) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await operation(); }
    catch (err) { if (active.current) { setCode(''); setError(authenticatorError(err)); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  }
  async function refresh() {
    const items = await verifiedAuthenticators(supabase);
    if (active.current) setFactors(items);
    await checkAppState({ background: true });
  }
  function enroll() {
    return run(async () => {
      const { data, error: enrollmentError } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Imperial Games', friendlyName: name.trim() || `Authenticator ${factors.length + 1}` });
      if (enrollmentError) throw enrollmentError;
      if (active.current) { setPending(data); setCode(''); }
      else await supabase.auth.mfa.unenroll({ factorId: data.id }); // Abandoned, unverified setup only.
    });
  }
  function cancel() {
    return run(async () => {
      if (pending) {
        const { error: cancelError } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
        if (cancelError) throw cancelError;
      }
      setPending(null); setRemoveId(''); setCode('');
    });
  }
  function submit(event) {
    event.preventDefault();
    return run(async () => {
      await verifyAuthenticator(supabase, pending?.id || verifyId, code);
      if (removeId) {
        const { error: removalError } = await supabase.auth.mfa.unenroll({ factorId: removeId });
        if (removalError) throw removalError;
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
      }
      if (!active.current) return;
      setMessage(removeId ? 'Authenticator removed.' : 'Two-step verification is enabled. Add a backup authenticator before you lose access to this device.');
      setPending(null); setRemoveId(''); setCode(''); setName('');
      await refresh();
    });
  }
  const inputClass = 'mt-2 w-full rounded border border-white/20 bg-slate-950 p-3 text-white';
  return <section aria-labelledby="authenticator-heading" className="mb-6 space-y-4 rounded-xl border border-white/10 bg-[#151023] p-6 text-white">
    <h2 id="authenticator-heading" className="text-xl font-semibold">Two-step verification</h2>
    <p className="text-sm text-gray-300">Use an authenticator app to protect your account with a code after your password. No phone number or text messages needed.</p>
    {loading ? <p role="status">Loading security settings…</p> : <>
      <p className="text-sm font-medium">{factors.length ? `Enabled · ${factors.length} verified authenticator${factors.length === 1 ? '' : 's'}` : 'Not enabled'}</p>
      {factors.length > 0 && <ul className="space-y-2">{factors.map((factor, index) => <li key={factor.id} className="flex items-center justify-between gap-3 rounded bg-white/5 p-3">
        <span className="break-words">{factor.friendly_name || `Authenticator ${index + 1}`}</span>
        <button disabled={busy || !!pending || !!removeId} onClick={() => { setRemoveId(factor.id); setVerifyId(factor.id); setCode(''); setError(''); setMessage(''); }} className="shrink-0 text-sm text-pink-300 disabled:opacity-50">Remove<span className="sr-only"> {factor.friendly_name || `Authenticator ${index + 1}`}</span></button>
      </li>)}</ul>}
      {pending || removeId ? <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        {pending && <>
          <p className="text-sm text-gray-300">Scan this QR code with your authenticator app, or enter the setup key manually. Keep the setup key private.</p>
          <img src={pending.totp.qr_code.startsWith('data:image/svg+xml') ? pending.totp.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pending.totp.qr_code)}`} alt="Authenticator setup QR code" width={220} height={220} className="rounded bg-white p-3" />
          <details><summary className="cursor-pointer text-sm text-pink-300">Show manual setup key</summary><code className="mt-2 block break-all rounded bg-slate-950 p-3">{pending.totp.secret}</code></details>
        </>}
        {removeId && <>
          <p className="text-sm text-amber-200">{factors.length === 1 ? 'Removing your last authenticator turns off two-step verification. Enter a current code to confirm.' : 'Enter a current code from any of your verified authenticators to confirm removal.'}</p>
          <label className="block text-sm">Verify with<select value={verifyId} disabled={busy} onChange={e => { setVerifyId(e.target.value); setCode(''); }} className={inputClass}>{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select></label>
        </>}
        <label className="block text-sm">Authenticator code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={inputClass} /></label>
        <div className="flex flex-wrap gap-3"><button disabled={busy || code.length !== 6} className="rounded bg-pink-600 px-4 py-3 font-medium disabled:opacity-50">{busy ? 'Verifying…' : removeId ? 'Confirm removal' : 'Enable authenticator'}</button><button type="button" disabled={busy} onClick={cancel} className="rounded border border-white/20 px-4 py-3">Cancel</button></div>
      </form> : <div className="space-y-3">
        <label className="block text-sm">Authenticator name<input value={name} disabled={busy} onChange={e => setName(e.target.value)} maxLength={40} placeholder="My phone or backup device" className={inputClass} /></label>
        <button onClick={enroll} disabled={busy} className="rounded bg-pink-600 px-4 py-3 font-medium disabled:opacity-50">{busy ? 'Preparing…' : factors.length ? 'Add backup authenticator' : 'Set up authenticator'}</button>
      </div>}
      <p className="text-sm text-gray-400">Keep a backup authenticator on a separate device or in a secure password manager. A password reset does not remove this protection.</p>
    </>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
  </section>;
}
