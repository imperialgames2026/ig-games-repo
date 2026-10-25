import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { verifyPracticeDice } from '@/lib/practiceFairDice';
import '@/components/games/originals-cockpit.css';

const DECISIONS = [
  { id: 'under', label: 'Under 7', test: sum => sum < 7 },
  { id: 'seven', label: 'Exactly 7', test: sum => sum === 7 },
  { id: 'over', label: 'Over 7', test: sum => sum > 7 },
];

export default function PlayDice() {
  const { isAuthenticated, user } = useAuth();
  const [clientSeed, setClientSeed] = useState(() => crypto.randomUUID());
  const [guess, setGuess] = useState('under');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  async function invoke(body) {
    const { data, error: invocationError } = await supabase.functions.invoke('provably-fair-v2', { body });
    if (invocationError) throw new Error('Practice game service unavailable. No round was completed.');
    if (!data || data.error) throw new Error(data?.error || 'Invalid game service response');
    return data;
  }

  async function roll() {
    if (busy || !isAuthenticated || user?.is_excluded) return;
    const seed = clientSeed.trim();
    if (!seed || seed.length > 128) {
      setError('Enter a client seed between 1 and 128 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const commitment = await invoke({ action: 'commit', game: 'dice' });
      if (commitment.phase !== 'committed' || !commitment.id) throw new Error('Commitment was not issued');
      const revealed = await invoke({ action: 'reveal', roundId: commitment.id, clientSeed: seed });
      const verified = await verifyPracticeDice(commitment, revealed, seed);
      if (!verified) throw new Error('Fairness proof failed. Round not accepted.');
      const decision = DECISIONS.find(d => d.id === guess);
      const record = {
        id: commitment.id, dice: revealed.outcome.dice, sum: revealed.outcome.sum,
        correct: decision.test(revealed.outcome.sum), guess: decision.label,
        serverHash: revealed.serverSeedHash, serverSeed: revealed.serverSeed,
        clientSeed: seed, nonce: revealed.nonce, verified,
      };
      setResult(record);
      setHistory(previous => [record, ...previous].slice(0, 8));
    } catch (e) {
      setError(e.message || 'Could not verify round.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ig-original-screen ig-original-dice min-h-screen bg-[#0A0612] text-white px-4 py-8">
      <div className="ig-original-shell mx-auto max-w-3xl space-y-6">
        <Link className="text-sm text-amber-300 hover:underline" to="/Games">← Back to games</Link>
        <div className="ig-original-header rounded-2xl border border-amber-500/25 bg-[#191529] p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Imperial Games · Verified staging</p>
          <h1 className="mt-2 text-4xl font-black">Practice Dice</h1>
          <p className="ig-original-description mt-3 text-gray-300">Roll two six-sided dice. Predict whether their total is under, equal to, or over seven. Each result comes from a server commitment and can be independently verified.</p>
          <p className="ig-original-notice mt-3 rounded-lg border border-sky-500/30 bg-sky-950/40 p-3 text-sm text-sky-200">Practice only. No wager, purchase, crypto transfer, balance change, or cash prize is possible here.</p>
        </div>

        <div className="ig-original-grid grid gap-5 md:grid-cols-[1fr_1.15fr]">
        <section aria-label="Play practice dice" className="ig-original-controls rounded-2xl border border-white/10 bg-[#191529] p-6 space-y-5">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Prediction">
            {DECISIONS.map(option => (
              <button key={option.id} type="button" disabled={busy}
                onClick={() => setGuess(option.id)}
                aria-pressed={guess === option.id}
                className={'rounded-xl border p-4 font-bold transition ' +
                  (guess === option.id ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/15 text-gray-300 hover:bg-white/10')}>
                {option.label}
              </button>
            ))}
          </div>
          <label className="block text-sm text-gray-300">
            Client seed (choose your own before rolling)
            <input value={clientSeed} maxLength={128} disabled={busy}
              onChange={e => setClientSeed(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/20 bg-[#100c1c] px-4 py-3 text-white" />
          </label>
          <button type="button" onClick={() => setClientSeed(crypto.randomUUID())} disabled={busy}
            className="text-sm text-amber-300 hover:underline">Generate new client seed</button>
          <button type="button" disabled={busy || !isAuthenticated || user?.is_excluded} onClick={roll}
            className="block w-full rounded-xl bg-amber-400 px-6 py-4 font-extrabold text-gray-950 disabled:opacity-50">
            {busy ? 'Verifying round…' : 'Roll practice dice'}
          </button>
          {!isAuthenticated && <p className="text-amber-200 text-sm">Sign in to play. <Link to="/login" className="underline">Sign in</Link></p>}
          {user?.is_excluded && <p className="text-red-300 text-sm">Account exclusion prevents gameplay.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        </section>

        {result ? (
          <section aria-label="Verified result" className="ig-original-stage rounded-2xl border border-white/10 bg-[#191529] p-6 space-y-4">
            <div className="text-center">
              <p className="text-lg text-gray-300">Dice</p>
              <p className="text-6xl font-black text-amber-300">{result.dice.join(' + ')} = {result.sum}</p>
              <p className="mt-3 text-xl">{result.correct ? 'Prediction correct!' : 'Prediction missed'}</p>
              <p className="mt-1 text-emerald-300">✓ Server commitment and dice outcome verified locally</p>
            </div>
            <details className="break-all rounded-lg bg-black/20 p-4 text-sm text-gray-300">
              <summary className="cursor-pointer font-semibold">Fairness proof for this round</summary>
              <p className="mt-3">SHA-256 commitment: {result.serverHash}</p>
              <p className="mt-2">Revealed server seed: {result.serverSeed}</p>
              <p className="mt-2">Client seed: {result.clientSeed}</p>
              <p className="mt-2">Nonce: {result.nonce}</p>
              <p className="mt-2">Algorithm: HMAC-SHA256-v2, rejection-sampled dice</p>
            </details>
          </section>
        ) : <section aria-label="Verified result" className="ig-original-stage rounded-2xl border border-white/10 bg-[#191529] p-6">
          <div className="text-center"><p className="text-6xl">🎲</p><p className="mt-4 text-xl font-black text-amber-200">Choose a prediction and roll</p></div>
        </section>}
        </div>
        {!!history.length && (
          <section className="ig-original-history rounded-2xl bg-[#191529] p-6">
            <h2 className="text-xl font-bold">Recent practice rounds</h2>
            <ul className="mt-4 space-y-2">
              {history.map(round => <li key={round.id} className="flex justify-between border-b border-white/10 pb-2 text-sm">
                <span>{round.dice.join(' + ')} = {round.sum} · {round.guess}</span>
                <span className={round.correct ? 'text-green-300' : 'text-gray-400'}>{round.correct ? 'Correct' : 'Missed'} · Verified</span>
              </li>)}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
