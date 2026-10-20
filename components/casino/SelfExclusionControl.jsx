import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';

// This is an irreversible player-facing restriction. No instant reactivation,
// no client role changes and no test account mutation in automated E2E.
export default function SelfExclusionControl() {
  const { user, checkUserAuth } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const maySubmit = user && !user.is_excluded && user.role !== 'tester';
  const valid = confirmation === 'EXCLUDE' && agreed;

  async function activate(event) {
    event.preventDefault();
    if (!maySubmit || !valid || working) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const { data, error: requestError } = await requireSupabase().functions.invoke('ig-self-exclusion-v1', {
        body: { action: 'activate', requestId: crypto.randomUUID() },
      });
      if (requestError || data?.isExcluded !== true)
        throw new Error(data?.error || requestError?.message || 'Could not verify the account restriction');
      setNotice('Self-exclusion is active. Game access is restricted and the account must be reviewed before any reinstatement.');
      await checkUserAuth();
    } catch (err) {
      setError(err?.message || 'Self-exclusion could not be confirmed. Contact support.');
    } finally {
      setWorking(false);
      setConfirmation('');
      setAgreed(false);
    }
  }

  return <section aria-label="Self-exclusion controls"
    className="my-7 rounded-2xl border border-amber-400/40 bg-amber-950/20 p-5 text-white">
    <div className="flex items-center gap-3 mb-3">
      <ShieldAlert className="w-7 h-7 text-amber-300 shrink-0"/>
      <h2 className="font-black text-xl">Self-exclude from Imperial Games</h2>
    </div>
    <p className="text-sm text-amber-100 mb-4">
      Exclusion immediately restricts access to practice games. You cannot reactivate play
      from your account. Contact support if you need help with an account restriction.
    </p>
    {user?.is_excluded && <p role="status" className="mb-4 text-amber-200 font-semibold">
      Your account is already excluded from games. You can contact support for an appeal.
    </p>}
    {user?.role === 'tester' && <p role="status" className="mb-4 text-gray-300">
      Read-only Tester accounts cannot change account restrictions.
    </p>}
    {maySubmit && <form onSubmit={activate} className="space-y-4">
      <label className="block text-sm font-semibold">
        Type <strong>EXCLUDE</strong> to confirm your request
        <input aria-label="Type EXCLUDE" value={confirmation} onChange={e => setConfirmation(e.target.value)}
          autoComplete="off" required className="mt-2 block w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-white"/>
      </label>
      <label className="flex items-start gap-3 text-sm text-gray-200">
        <input aria-label="Confirm self-exclusion" type="checkbox" checked={agreed}
          onChange={e => setAgreed(e.target.checked)} className="mt-1"/>
        I understand that the exclusion takes effect immediately and cannot be reversed from my player account.
      </label>
      <button type="submit" disabled={!valid || working}
        className="rounded-lg bg-amber-600 px-5 py-3 font-bold text-black disabled:opacity-40">
        {working ? 'Activating…' : 'Activate self-exclusion'}
      </button>
    </form>}
    {error && <p role="alert" className="mt-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-4 text-green-200">{notice}</p>}
    <Link to="/Support" className="mt-4 inline-block text-amber-200 underline hover:text-white">
      Contact support about an account restriction
    </Link>
  </section>;
}
