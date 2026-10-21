import React, { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Crown, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const fieldClass = 'mt-2 w-full rounded-xl border border-white/15 bg-[#0d0a17] px-4 py-3 text-base text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 disabled:opacity-60';
const returnPath = destination => {
  if (typeof destination?.pathname !== 'string' || !/^\/(?!\/)/.test(destination.pathname) || destination.pathname.includes('\\')) return '/';
  return `${destination.pathname}${destination.search || ''}${destination.hash || ''}`;
};

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const heading = useRef(null);
  const submitting = useRef(false);
  const [mode, setMode] = useState(() => ['recovery', 'signup'].includes(new URLSearchParams(location.search).get('mode')) ? new URLSearchParams(location.search).get('mode') : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const returnTo = returnPath(location.state?.from);

  if (!isLoadingAuth && isAuthenticated) return <Navigate to={returnTo} replace />;

  function changeMode(next) {
    if (submitting.current) return;
    setMode(next); setError(''); setMessage(''); setPassword(''); setConfirm(''); setShowPassword(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current || isLoadingAuth) return;
    setError(''); setMessage('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords must match.'); return; }
    submitting.current = true; setBusy(true);
    try {
      if (mode === 'recovery') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/ResetPassword' });
        if (resetError) throw resetError;
        setMessage('If an account exists for this address, a password reset link will arrive by email.');
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        if (data.session) navigate(returnTo, { replace: true });
        else { setMessage('Check your email to confirm your address, then sign in. If you already have an account, sign in or reset your password.'); setPassword(''); setConfirm(''); }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        navigate(returnTo, { replace: true });
      }
    } catch (err) { setError(err.message || 'Authentication failed. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0612] px-4 py-10 text-white sm:py-14">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(192,38,211,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(217,179,91,0.08),transparent_50%)]" />
    <div className="relative grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
      <aside className="hidden lg:block">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Imperial Games</Link>
        <img src="/imperial-gaming.png" alt="Imperial Games" className="mt-12 h-28 w-auto max-w-full object-contain object-left" />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Your next seat is waiting</p>
        <h2 className="mt-4 text-4xl font-black leading-tight">Good company.<br /><span className="text-pink-300">Great practice.</span></h2>
        <p className="mt-5 max-w-sm text-base leading-7 text-gray-400">Join your testing group for Hold’em, Omaha and Imperial Originals. One account keeps your profile and support conversations together.</p>
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /> Fictional tester chips only. They have no cash value and cannot be purchased or redeemed.</div>
      </aside>
      <section aria-labelledby="account-heading" className="min-w-0 rounded-3xl border border-white/10 bg-gradient-to-b from-[#21162f] to-[#130e20] p-6 shadow-2xl sm:p-8">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white lg:hidden"><ArrowLeft className="h-4 w-4" /> Back to Imperial Games</Link>
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10"><Crown className="h-6 w-6 text-amber-300" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">Imperial Games · Tester-chip preview</p>
        <h1 ref={heading} tabIndex={-1} id="account-heading" className="mt-3 text-3xl font-black outline-none">{mode === 'recovery' ? 'Reset your password' : mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">{mode === 'recovery' ? 'Enter your account email and we’ll send instructions to choose a new password.' : mode === 'signin' ? 'Sign in to return to your tables and account.' : 'Create a practice account with your email. Confirm your address when prompted to finish joining.'}</p>
        {isLoadingAuth && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Checking your session…</p>}
        <form onSubmit={handleSubmit} aria-busy={busy} className="mt-7 space-y-5">
          <fieldset disabled={busy || isLoadingAuth} className="min-w-0 space-y-5">
            <legend className="sr-only">{mode === 'signup' ? 'Create an account' : mode === 'recovery' ? 'Request password recovery' : 'Account sign-in'}</legend>
            {mode === 'signup' && <div><label htmlFor="account-full-name" className="text-sm font-semibold text-gray-200">Full name</label><input id="account-full-name" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} maxLength={100} className={fieldClass} /></div>}
            <div><label htmlFor="account-email" className="text-sm font-semibold text-gray-200">Email</label><input id="account-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} className={fieldClass} placeholder="you@example.com" /></div>
            {mode !== 'recovery' && <div><label htmlFor="account-password" className="text-sm font-semibold text-gray-200">Password</label><div className="relative"><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required className={fieldClass + ' pr-14'} aria-describedby={mode === 'signup' ? 'password-help' : undefined} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)} className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center rounded-xl text-gray-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>{mode === 'signup' && <p id="password-help" className="mt-2 text-xs text-gray-400">Use at least 8 characters. Your password stays private.</p>}</div>}
            {mode === 'signup' && <div><label htmlFor="account-confirm" className="text-sm font-semibold text-gray-200">Confirm password</label><input id="account-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} className={fieldClass} /></div>}
            {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-950/50 p-4 text-sm leading-6 text-red-200">{error}</p>}
            {message && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-950/30 p-4 text-sm leading-6 text-emerald-100"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><p>{message}</p></div>}
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-pink-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Please wait…</> : <>{mode === 'recovery' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight className="h-4 w-4" /></>}</button>
          </fieldset>
        </form>
        {mode === 'signin' && <button type="button" disabled={busy} className="mt-5 text-sm font-semibold text-amber-300 hover:underline disabled:opacity-50" onClick={() => changeMode('recovery')}>Forgot password?</button>}
        <p className="mt-6 border-t border-white/10 pt-6 text-center text-sm text-gray-400">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}<button type="button" disabled={busy} onClick={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} className="font-bold text-pink-300 hover:underline disabled:opacity-50">{mode === 'signin' ? 'Create one' : 'Sign in'}</button></p>
        <p className="mt-5 text-center text-xs leading-5 text-gray-500">Practice play only. <Link to="/TermsOfService" className="text-gray-400 underline hover:text-white">Terms</Link> · <Link to="/PrivacyPolicy" className="text-gray-400 underline hover:text-white">Privacy</Link></p>
      </section>
    </div>
  </main>;
}
