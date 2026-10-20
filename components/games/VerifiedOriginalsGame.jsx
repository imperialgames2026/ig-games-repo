import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { verifyOriginalsRound } from '@/lib/originalsFairness';

const CONFIG = {
  coin: { title: 'CoinFlip', icon: '🪙', action: 'Flip coin', description: 'Choose heads or tails, then flip a fair coin.', choices: ['heads','tails'] },
  hashdice: { title: 'Hash Dice', icon: '🎲', action: 'Roll hash dice', description: 'Predict a number below 50,000 or at least 50,000. Every integer from 0 to 99,999 is equally likely.', choices: ['low','high'] },
  limbo: { title: 'Limbo', icon: '🚀', action: 'Launch', description: 'Choose a target multiplier and see whether the launch reaches it. A round can stop immediately at 1.00×.' },
  plinko: { title: 'Plinko', icon: '🔮', action: 'Drop ball', description: 'Predict the landing zone. Twelve independent left/right bounces determine the final bin.', choices: ['left','middle','right'] },
  wheel: { title: 'Wheel', icon: '🎡', action: 'Spin wheel', description: 'Predict a color on the 20-segment wheel. Each of the four colors occupies five segments.', choices: ['gold','blue','pink','purple'] },
};
const COLORS = { gold: '#fbbf24', blue: '#60a5fa', pink: '#f472b6', purple: '#c084fc' };
function resultLabel(game, outcome) {
  if (game === 'coin') return outcome.coin;
  if (game === 'hashdice') return String(outcome.roll).padStart(5, '0');
  if (game === 'limbo') return `${outcome.multiplier.toFixed(2)}×`;
  if (game === 'plinko') return `Bin ${outcome.bin + 1} of 13`;
  return `${outcome.color} · segment ${outcome.segment + 1}`;
}
function correct(game, outcome, choice) {
  if (game === 'coin') return outcome.coin === choice;
  if (game === 'hashdice') return (outcome.roll < 50000 ? 'low' : 'high') === choice;
  if (game === 'limbo') return outcome.multiplier >= Number(choice);
  if (game === 'wheel') return outcome.color === choice;
  return (outcome.bin < 5 ? 'left' : outcome.bin > 7 ? 'right' : 'middle') === choice;
}

export default function VerifiedOriginalsGame({ game }) {
  const config = CONFIG[game];
  const { user } = useAuth();
  const storageKey = `imperial-originals:${user?.id}:${game}`;
  const [clientSeed, setClientSeed] = useState(() => crypto.randomUUID());
  const [choice, setChoice] = useState(config.choices?.[0] || '2');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); return saved?.id && saved?.clientSeed && saved?.choice !== undefined ? saved : null; }
    catch { return null; }
  });
  const requestLock = useRef(false);
  const activeChoice = pending?.choice ?? choice;
  const readonly = !user || user.role === 'tester' || user.is_excluded;
  const invalidTarget = game === 'limbo' && (!Number.isFinite(Number(choice)) || Number(choice) < 1.01 || Number(choice) > 1000);
  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke('ig-originals-practice', { body: { ...body, game } });
    if (error) {
      let message = 'The round could not be completed. Retry the same round.';
      try { const detail = await error.context?.json(); if (detail?.error) message = detail.error; } catch { /* Keep retry guidance. */ }
      throw new Error(message);
    }
    if (!data || data.error) throw new Error(data?.error || 'Round service unavailable');
    return data;
  }
  async function play() {
    if (requestLock.current || readonly || invalidTarget) return;
    const selected = pending || { id: crypto.randomUUID(), clientSeed: clientSeed.trim(), choice };
    if (!selected.clientSeed || selected.clientSeed.length > 128) { setError('Enter a client seed of 1 to 128 characters.'); return; }
    requestLock.current = true;
    setBusy(true); setError(''); setResult(null);
    setPending(selected);
    try {
      localStorage.setItem(storageKey, JSON.stringify(selected));
      const commit = await invoke({ action: 'commit', requestId: selected.id });
      const reveal = await invoke({ action: 'reveal', roundId: selected.id, clientSeed: selected.clientSeed });
      if (!await verifyOriginalsRound(commit, reveal, { game, clientSeed: selected.clientSeed })) throw new Error('The fairness proof did not match. This result was not accepted.');
      const record = { ...reveal, correct: correct(game, reveal.outcome, selected.choice), choice: selected.choice };
      setResult(record);
      setHistory(previous => [record, ...previous.filter(r => r.roundId !== record.roundId)].slice(0, 12));
      localStorage.removeItem(storageKey);
      setPending(null);
    } catch (error) { setError(error.message); }
    finally { requestLock.current = false; setBusy(false); }
  }
  return (
    <main className="min-h-screen bg-[#0a0612] px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to="/Games" className="text-sm text-amber-300 hover:underline">← Back to games</Link>
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-pink-300">Imperial Originals · Practice</p>
          <h1 className="mt-2 text-4xl font-black">{config.icon} {config.title}</h1>
          <p className="mt-3 max-w-2xl text-gray-300">{config.description}</p>
          <p className="mt-3 rounded-xl border border-sky-400/20 bg-sky-950/30 p-3 text-sm text-sky-100">Free practice. Predictions do not charge or award coins, tokens, money or prizes.</p>
        </header>
        <div className="grid gap-5 md:grid-cols-[1fr_1.25fr]">
          <section className="rounded-2xl border border-white/10 bg-[#191529] p-5">
            <fieldset disabled={busy || readonly || !!pending} className="space-y-5 disabled:opacity-60">
              <legend className="mb-4 text-lg font-bold">Your prediction</legend>
              {config.choices ? <div className="grid grid-cols-2 gap-2">
                {config.choices.map(option => <button key={option} type="button" aria-pressed={activeChoice === option} onClick={() => setChoice(option)}
                  className={`rounded-xl border px-3 py-4 font-bold capitalize ${activeChoice === option ? 'border-pink-400 bg-pink-500/20 text-pink-100' : 'border-white/15 text-gray-300'}`}>{option}</button>)}
              </div> : <label className="block text-sm text-gray-300">Target multiplier
                <input type="number" min="1.01" max="1000" step="0.01" value={activeChoice} onChange={e => setChoice(e.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 p-3 text-xl text-white" />
              </label>}
              <label className="block text-sm text-gray-300">Client seed
                <input value={pending?.clientSeed ?? clientSeed} maxLength={128} onChange={e => setClientSeed(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" />
              </label>
              <button type="button" onClick={() => setClientSeed(crypto.randomUUID())} className="text-sm text-pink-300 hover:underline">Generate a new client seed</button>
            </fieldset>
            <button type="button" disabled={busy || readonly || (!pending && invalidTarget)} onClick={play}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 px-5 py-4 font-extrabold disabled:opacity-50">
              {busy ? 'Verifying round…' : pending ? 'Retry pending round' : config.action}
            </button>
            {user?.role === 'tester' && <p className="mt-3 text-sm text-amber-200">This account has read-only access.</p>}
            {pending && !busy && <p className="mt-3 text-xs text-gray-300">Your prediction and seed are saved for this round. Retrying uses the same round.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-950/60 p-3 text-red-200">{error}</p>}
          </section>
          <section aria-label={`${config.title} result`} className="flex min-h-80 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#211634] to-[#100c1b] p-6">
            {game === 'wheel' ? <div className="relative mb-6">
              <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 text-2xl text-white">▼</span>
              <motion.div key={result?.roundId || 'idle'} animate={{ rotate: result ? 1080 - result.outcome.segment * 18 - 9 : 0 }} transition={{ duration: 1.4, ease: 'easeOut' }}
                className="h-44 w-44 rounded-full border-4 border-white/30 shadow-xl" style={{ background: `conic-gradient(${Array.from({ length: 20 }, (_, i) => `${COLORS[['gold','blue','pink','purple'][i % 4]]} ${i * 18}deg ${(i + 1) * 18}deg`).join(',')})` }} />
            </div> : game === 'plinko' ? <div className="relative mb-5 w-64" aria-label="Twelve-row Plinko board">
              {Array.from({ length: 12 }, (_, row) => <div key={row} className="flex justify-center gap-3 py-1">{Array.from({ length: row + 2 }, (_, col) => <span key={col} className="h-1.5 w-1.5 rounded-full bg-violet-300/50" />)}</div>)}
              {result && <motion.div key={result.roundId} initial={{ x: 0, y: 0 }} animate={{ x: result.outcome.path.map((_, i, a) => (a.slice(0, i + 1).reduce((s, n) => s + (n ? 1 : -1), 0)) * 9), y: result.outcome.path.map((_, i) => i * 14) }}
                transition={{ duration: 1.2 }} className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-pink-400 shadow-[0_0_15px_#f472b6]" />}
            </div> : <motion.div animate={busy ? { rotateY: [0,360], scale: [1,1.07,1] } : { rotateY: 0, scale: 1 }} transition={busy ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
              className={`mb-6 flex items-center justify-center ${game === 'coin' ? 'h-40 w-40 rounded-full border-4 border-yellow-300 bg-gradient-to-br from-yellow-300 to-amber-700 text-7xl shadow-[0_0_35px_#f59e0b55]' : 'text-7xl'}`}>
              {game === 'coin' && result ? result.outcome.coin === 'heads' ? '👑' : '🔱' : config.icon}
            </motion.div>}
            <p aria-live="polite" className="text-center font-mono text-3xl font-black capitalize text-amber-200">{busy ? '…' : result ? resultLabel(game, result.outcome) : 'Make your prediction'}</p>
            {result && <><p className={`mt-3 text-lg font-bold ${result.correct ? 'text-emerald-300' : 'text-gray-300'}`}>{result.correct ? 'Prediction correct!' : 'Prediction missed'}</p><p className="mt-2 text-xs text-emerald-200">✓ Fairness proof verified on your device</p></>}
          </section>
        </div>
        {result && <details className="break-all rounded-xl border border-white/10 bg-[#191529] p-4 text-sm text-gray-300">
          <summary className="cursor-pointer font-bold text-white">Round fairness proof</summary>
          <p className="mt-3">Round: {result.roundId}</p><p className="mt-2">SHA-256 commitment: {result.serverSeedHash}</p>
          <p className="mt-2">Revealed server seed: {result.serverSeed}</p><p className="mt-2">Client seed: {result.clientSeed}</p>
          <p className="mt-2">Algorithm: HMAC-SHA256-v3 · Nonce: 0</p>
        </details>}
        {!!history.length && <section className="rounded-xl border border-white/10 bg-[#191529] p-5"><h2 className="font-bold">Recent rounds</h2>
          <ul className="mt-3 space-y-2">{history.map(round => <li key={round.roundId} className="flex justify-between gap-3 border-b border-white/5 pb-2 text-sm"><span className="capitalize">{resultLabel(game, round.outcome)}</span><span className={round.correct ? 'text-emerald-300' : 'text-gray-400'}>{round.correct ? 'Correct' : 'Missed'} · Verified</span></li>)}</ul>
        </section>}
      </div>
    </main>
  );
}
