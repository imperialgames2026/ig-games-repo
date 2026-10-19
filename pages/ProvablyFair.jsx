import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';
import { verifyFairRound } from '@/lib/fairness';

/**
 * The original Base44 SSRCR page asserted that every historical casino game
 * was verified. This migrated page only describes the ACTUALLY implemented
 * Supabase HMAC/SHA256 practice flow: dice, coin and number demonstrations.
 */
export default function ProvablyFair() {
  const { user } = useAuth();
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['imperial-practice-fairness-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: result, error: invokeError } = await requireSupabase().functions.invoke('provably-fair-v2', {
        body: { action: 'history' },
      });
      if (invokeError || !result?.practiceOnly || !Array.isArray(result?.rounds)) {
        throw new Error(result?.error || invokeError?.message || 'Practice history unavailable');
      }
      return result.rounds;
    },
    retry: 1,
  });
  const rounds = data || [];

  async function verify(round) {
    setChecking(round.id);
    try {
      const ok = await verifyFairRound({
        game: round.game,
        serverSeed: round.serverSeed,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        serverSeedHash: round.serverSeedHash,
        outcome: round.outcome,
      });
      setResults(prev => ({ ...prev, [round.id]: ok }));
    } catch {
      setResults(prev => ({ ...prev, [round.id]: false }));
    } finally {
      setChecking(null);
    }
  }

  return <main className="bg-[#0A0612] min-h-screen text-white px-4 py-10">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheck aria-hidden="true" className="h-10 w-10 text-green-400"/>
        <div>
          <p className="text-sm text-pink-300 uppercase tracking-widest">Imperial Games</p>
          <h1 className="text-3xl font-black">Provably Fair · Practice Verification</h1>
        </div>
      </div>
      <p className="mb-3 text-gray-300 leading-relaxed">
        This page verifies <strong>staging practice rounds only</strong> for dice, coin flip and number games.
        It does not verify the legacy slot machines, poker, wagers, payouts, or the full casino yet.
        Those systems remain disabled pending server-authoritative migration and security review.
      </p>
      <p className="text-sm text-gray-400 mb-8">
        For each already revealed round, the browser hashes the disclosed server seed using SHA-256,
        checks it against the original commitment, then recalculates the HMAC-SHA-256 outcome
        from the same client seed and nonce. A green result means this algorithm reproduces
        the stored outcome; it does not independently prove regulatory fairness or financial settlement.
      </p>
      <section className="rounded-2xl border border-white/10 bg-[#1A1528] p-5">
        <div className="flex justify-between items-center gap-3 flex-wrap mb-5">
          <h2 className="text-xl font-bold">Your revealed practice rounds</h2>
          <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-lg border border-white/20 p-3">
            <RefreshCw className="h-4 w-4"/> Refresh
          </button>
        </div>
        {isLoading && <p role="status" className="text-gray-300">Loading verified history…</p>}
        {error && <p role="alert" className="text-red-300">Cannot load practice rounds: {error.message}</p>}
        {!isLoading && !error && rounds.length === 0 &&
          <p className="text-gray-400">No revealed practice rounds for this account yet.</p>}
        <div className="space-y-4">
          {rounds.map(round => <article key={round.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between gap-3 items-center flex-wrap">
              <div>
                <h3 className="text-lg font-bold capitalize">{round.game} · practice round</h3>
                <p className="text-xs text-gray-400">{new Date(round.revealedAt).toLocaleString()}</p>
              </div>
              <button type="button" disabled={checking === round.id}
                onClick={() => void verify(round)}
                className="rounded-lg bg-green-700 hover:bg-green-600 px-4 py-2 disabled:opacity-50">
                {checking === round.id ? 'Checking…' : 'Verify round'}
              </button>
            </div>
            <dl className="grid gap-3 mt-4 text-sm">
              <div><dt className="text-gray-400">Original commitment (SHA-256)</dt>
                <dd className="font-mono break-all">{round.serverSeedHash}</dd></div>
              <div><dt className="text-gray-400">Revealed server seed</dt>
                <dd className="font-mono break-all">{round.serverSeed}</dd></div>
              <div><dt className="text-gray-400">Client seed / nonce</dt>
                <dd className="font-mono break-all">{round.clientSeed} / {round.nonce}</dd></div>
              <div><dt className="text-gray-400">Recorded practice outcome</dt>
                <dd className="font-mono break-all">{JSON.stringify(round.outcome)}</dd></div>
            </dl>
            {results[round.id] === true && <p role="status" className="mt-4 flex items-center gap-2 text-green-300">
              <CheckCircle className="w-5 h-5"/> Commitment and practice outcome verified
            </p>}
            {results[round.id] === false && <p role="alert" className="mt-4 flex items-center gap-2 text-red-300">
              <XCircle className="w-5 h-5"/> Verification failed — contact Imperial Games support
            </p>}
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
