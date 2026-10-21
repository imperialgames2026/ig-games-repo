import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { safeReturnPath } from '@/lib/authFlow';

const modes = {
  signin: ['Welcome back', 'Sign in to continue to your account.', 'Sign in'],
  signup: ['Create your account', 'Join Imperial Games with a verified email address.', 'Create account'],
  recovery: ['Reset your password', 'Enter your account email to request a password reset link.', 'Send reset link'],
  confirmation: ['Confirm your email', 'Request a new confirmation link for your account email.', 'Resend confirmation email'],
};

export default function Login() {
  const { isAuthenticated, isLoadingAuth, authLinkError, clearAuthLinkError, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => {
    const requested = new URLSearchParams(location.search).get('mode');
    return Object.hasOwn(modes, requested) ? requested : 'signin';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const submitting = useRef(false);
  const heading = useRef(null);
  const returnTo = safeReturnPath(location.state?.from);
  const emailOnly = mode === 'recovery' || mode === 'confirmation';

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!isLoadingAuth && isAuthenticated && mode === 'signin' && !authLinkError) return <Navigate to={returnTo} replace />;

  function changeMode(next) {
    if (submitting.current) return;
    setMode(next); setError(''); setMessage(''); setPassword(''); setConfirm('');
    clearAuthLinkError();
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current || isLoadingAuth || (emailOnly && cooldown)) return;
    setError(''); setMessage('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords must match.'); return; }
    submitting.current = true; setBusy(true);
    try {
      if (mode === 'recovery') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/ResetPassword' });
        if (resetError) throw resetError;
        setMessage('If an account exists for this address, a password reset link will arrive by email.');
        setCooldown(60);
      } else if (mode === 'confirmation') {
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } });
        if (resendError) throw resendError;
        setMessage('If this address has an account awaiting confirmation, a new link will arrive by email. Check your spam folder too.');
        setCooldown(60);
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        setPassword(''); setConfirm('');
        if (data.session) navigate(returnTo, { replace: true });
        else {
          setMode('confirmation'); setCooldown(60);
          setMessage('Check your email to confirm your address. If you already have an account, sign in or reset your password.');
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setPassword('');
        navigate(returnTo, { replace: true });
      }
      clearAuthLinkError();
    } catch (err) {
      if (err.code === 'email_not_confirmed') { setMode('confirmation'); setPassword(''); }
      if (err.status === 429) setCooldown(60);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      submitting.current = false; setBusy(false);
    }
  }

  async function useAnotherAccount() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { await logout(false); setPassword(''); setConfirm(''); }
    catch (err) { setError(err.message || 'Sign-out failed. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <Link to="/" onClick={clearAuthLinkError} className="text-sm text-slate-300 hover:text-white">← Back to Imperial Games</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">Imperial Games</p>
        <h1 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-bold">{modes[mode][0]}</h1>
        <p className="mt-2 text-sm text-slate-400">{modes[mode][1]}</p>
        {authLinkError && <p role="alert" className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{authLinkError}</p>}
        {isAuthenticated && <div className="mt-4 text-sm"><Link to={returnTo} onClick={clearAuthLinkError} className="text-amber-300">Continue to your account</Link><button type="button" disabled={busy} onClick={useAnotherAccount} className="mt-2 block text-amber-300">Use a different account</button></div>}
        <form onSubmit={handleSubmit} aria-busy={busy} className="mt-7 space-y-4">
          <fieldset disabled={busy || isLoadingAuth} className="min-w-0 space-y-4">
            <legend className="sr-only">{modes[mode][0]}</legend>
            {mode === 'signup' && <label className="block text-sm">Full name<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={100} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>}
            <label className="block text-sm">Email<input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>
            {!emailOnly && <label className="block text-sm">Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>}
            {mode === 'signup' && <label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>}
            {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{message}</p>}
            <button type="submit" disabled={busy || (emailOnly && cooldown > 0)} className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Please wait…' : modes[mode][2]}</button>
            {emailOnly && cooldown > 0 && <p role="status" className="text-sm text-slate-300">You can request another email in {cooldown} seconds.</p>}
          </fieldset>
        </form>
        {mode !== 'recovery' && <button type="button" disabled={busy} className="mt-4 block text-sm text-amber-300" onClick={() => changeMode('recovery')}>Forgot password?</button>}
        {mode === 'signin' && <button type="button" disabled={busy} className="mt-3 block text-sm text-amber-300" onClick={() => changeMode('confirmation')}>Resend confirmation email</button>}
        <p className="mt-6 text-center text-sm text-slate-400">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}<button type="button" disabled={busy} onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} className="font-semibold text-amber-400 hover:text-amber-300">{mode === 'signin' ? 'Create one' : 'Sign in'}</button></p>
      </section>
    </main>
  );
}
