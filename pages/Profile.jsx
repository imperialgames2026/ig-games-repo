import PokerPlayerAnalytics from '@/components/poker/PokerPlayerAnalytics';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { readOwnWallet } from '@/lib/supabaseLegacyReads';
import { setOneTimeDisplayName } from '@/lib/supabaseIdentity';
import { ShieldCheck, UserRound, Wallet, BadgeCheck, AlertTriangle } from 'lucide-react';

/**
 * Original Imperial Games profile migrated from Base44.
 * The original profile photo, arbitrary user mutation and financial controls
 * stay disabled until safely implemented. Wallet values are staging-only.
 */
export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const wallets = useQuery({
    queryKey: ['staging-own-profile-wallet', user?.id],
    queryFn: async () => readOwnWallet({ user_email: user?.email }),
    enabled: !!user?.id,
    retry: 1,
  });
  const wallet = wallets.data?.[0];
  const currencyRows = [
    { name: 'CENT', amount: wallet?.cent_balance },
    { name: 'IGD', amount: wallet?.igd_balance },
    { name: 'IGT', amount: wallet?.igt_balance },
  ];
  const nicknameIsUnset = !user?.display_name && user?.role !== 'tester';

  async function setOneTimeNickname(event) {
    event.preventDefault();
    const candidate = nickname.trim();
    if (saving || !nicknameIsUnset || candidate.length < 2 || candidate.length > 40) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await setOneTimeDisplayName(candidate);
      await checkUserAuth();
      setNickname('');
      setNotice('Display name saved. Your account determines whether later changes are permitted.');
    } catch (err) {
      setError(err?.message || 'Could not update the display name');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <main className="min-h-screen bg-[#0A0612] text-white p-8" role="alert">
    A verified account is required to view this profile.
  <PokerPlayerAnalytics /></main>;
  return <main className="min-h-screen bg-[#0A0612] text-white px-4 py-10">
    <div className="mx-auto max-w-5xl">
      <p className="text-pink-300 uppercase tracking-widest text-sm">Imperial Games · Your Account</p>
      <h1 className="text-4xl font-black mt-1 mb-8">Player Profile</h1>
      <nav aria-label="Player self-service links" className="flex flex-wrap gap-3 mb-7">
        <Link className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200" to="/ProfileStats">Poker analytics</Link>
        <Link className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200" to="/KYCVerification">KYC status</Link>
        <Link className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200" to="/Leaderboard">Practice leaderboard</Link>
      </nav>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/50 p-4 text-red-200">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-green-500/40 p-4 text-green-200">{notice}</p>}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
        <section className="rounded-2xl border border-white/10 bg-[#1A1528] p-6">
          <div className="flex items-center gap-3 mb-6"><UserRound className="w-7 h-7 text-pink-300"/><h2 className="text-xl font-bold">Account identity</h2></div>
          <dl className="space-y-4">
            <div><dt className="text-sm text-gray-400">Verified sign-in email</dt><dd className="break-all">{user.email}</dd></div>
            <div><dt className="text-sm text-gray-400">Display name</dt><dd>{user.display_name || 'Not set'}</dd></div>
            <div><dt className="text-sm text-gray-400">Permission level</dt><dd className="capitalize">{user.role}</dd></div>
            <div><dt className="text-sm text-gray-400">Verification status</dt><dd className="capitalize">{user.kyc_status || 'Not completed'}</dd></div>
            <div><dt className="text-sm text-gray-400">Account restrictions</dt><dd>{user.is_excluded ? 'Self-excluded or restricted' : 'No account exclusion currently recorded'}</dd></div>
          </dl>
          {nicknameIsUnset && <form className="mt-7 space-y-3" onSubmit={setOneTimeNickname}>
            <label className="block text-sm font-semibold">Choose a display name
              <input aria-label="Display name" minLength={2} maxLength={40} required
                value={nickname} onChange={e => setNickname(e.target.value)}
                className="block mt-2 w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white"/>
            </label>
            <button type="submit" disabled={saving} className="rounded-lg bg-pink-600 disabled:opacity-50 px-5 py-3 font-bold">
              {saving ? 'Saving…' : 'Set display name'}
            </button>
          </form>}
          <div className="mt-6 flex items-start gap-3 text-sm text-gray-400">
            <ShieldCheck className="w-5 h-5 text-green-300 shrink-0"/>
            Sign-in, roles and exclusion status are verified by Supabase. Legacy photo uploads and unreviewed profile changes remain disabled.
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#1A1528] p-6">
          <div className="flex items-center gap-3 mb-5"><Wallet className="w-7 h-7 text-amber-300"/><h2 className="text-xl font-bold">Staging balances</h2></div>
          <p className="text-sm text-amber-200 mb-5">
            These are internal test-currency balances, not verified crypto deposits, redeemable tokens or available cash.
          </p>
          {wallets.isLoading && <p role="status">Loading staging balances…</p>}
          {wallets.error && <p role="alert">Staging wallet is unavailable. No balance is assumed.</p>}
          {!wallets.isLoading && !wallets.error && !wallet && <p>No staging wallet has been initialized.</p>}
          {wallet && <dl className="space-y-4">
            {currencyRows.map(entry => <div key={entry.name} className="flex justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <dt className="font-bold">{entry.name}</dt>
              <dd className="font-mono">{String(entry.amount ?? 0)}</dd>
            </div>)}
          </dl>}
          <div className="mt-6 flex items-start gap-2 text-sm text-gray-400">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300"/>
            Real crypto deposits, withdrawals, wallet transfers and external payouts are disabled.
          </div>
          <p className="mt-5 text-xs text-gray-500 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4"/> Player-only reads; server-controlled financial writes.
          </p>
        </section>
      </div>
    </div>
  <PokerPlayerAnalytics /></main>;
}
