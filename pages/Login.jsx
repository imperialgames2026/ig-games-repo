import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const destination = location.state?.from;
  const returnTo = destination ? `${destination.pathname ?? '/'}${destination.search ?? ''}${destination.hash ?? ''}` : '/';

  if (!isLoadingAuth && isAuthenticated) return <Navigate to={returnTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      // Native email callbacks require verified Android App Links and separate approval.
      // Until then, allow only password sign-in with existing practice accounts.
      if (window.Capacitor?.isNativePlatform?.() && mode !== 'signin') {
        throw new Error('Mobile email confirmation and password recovery are not enabled yet. Use an existing practice test account.');
      }
      if (mode === 'recovery') {
        const {error: resetError}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/ResetPassword'});
        if(resetError)throw resetError;
        setMessage('If an account exists for this address, a password reset link will arrive by email.');
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session) navigate(returnTo, { replace: true });
        else setMessage('Account created. Check your email to confirm your address, then sign in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <Link to="/" className="text-sm text-slate-300 hover:text-white">← Back to Imperial Games</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">Imperial Games</p>
        <h1 className="mt-3 text-3xl font-bold">{mode === 'recovery' ? 'Reset your password' : mode === 'signin' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-sm text-slate-400">{mode === 'signin' ? 'Sign in to continue to your account.' : 'Join Imperial Games with a verified email address.'}</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {mode === 'signup' && <label className="block text-sm">Full name<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>}
          <label className="block text-sm">Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>
          {mode !== 'recovery' && <label className="block text-sm">Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-3 text-white outline-none focus:border-amber-400" /></label>}
          {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-200">{message}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Please wait…' : mode === 'recovery' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'signin' && <button type="button" className="mt-4 text-sm text-amber-300" onClick={()=>{setMode('recovery');setError('');setMessage('');}}>Forgot password?</button>}
        <p className="mt-6 text-center text-sm text-slate-400">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}<button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }} className="font-semibold text-amber-400 hover:text-amber-300">{mode === 'signin' ? 'Create one' : 'Sign in'}</button></p>
      </section>
    </main>
  );
}
