import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { verifyMinesRound } from '@/lib/minesFairness';
import { observeRound } from '@/lib/observedRound';
import { saveDeviceProof } from '@/lib/deviceProofStorage';
import './originals-cockpit.css';

export default function VerifiedMinesGame() {
 const { user } = useAuth();
 const key = `imperial-mines:${user?.id}`;
 const [round,setRound] = useState(null), [mineCount,setMineCount] = useState(3);
 const [clientSeed,setClientSeed] = useState(() => crypto.randomUUID());
 const [busy,setBusy] = useState(true), [error,setError] = useState('');
 const [pending,setPending] = useState(() => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } });
 const locked = useRef(false);
 const commitmentKey = roundId => `imperial-mines-proof:${user?.id}:${roundId}`;
 const readonly = !user || user.role === 'tester' || user.is_excluded;
 async function invoke(body) {
  const { data,error } = await supabase.functions.invoke('ig-mines-practice',{ body });
  if (error) {
   let message = 'Round unavailable. Retry the same request or refresh the round.';
   try { const body = await error.context?.json(); if (body?.error) message = body.error; } catch { /* Keep recovery guidance. */ }
   throw new Error(message);
  }
  if (!data || data.error || !Object.hasOwn(data,'state')) throw new Error(data?.error || 'Invalid round response');
  return data.state;
 }
 function savedCommitment(roundId) {
  const raw = localStorage.getItem(commitmentKey(roundId));
  return raw ? JSON.parse(raw) : null;
 }
 function persistCommitment(commitment) {
  saveDeviceProof(localStorage,commitmentKey(commitment.roundId),commitment,`imperial-mines-proof:${user?.id}`);
 }
 async function accept(state,request) {
  if (!state) { setRound(null); return; }
  let known = savedCommitment(state.roundId);
  if (!known) {
   if (state.phase !== 'committed') throw new Error('The original commitment is unavailable on this device. This round cannot be verified.');
   known = { roundId: state.roundId,mineCount: state.mineCount,serverSeedHash: state.serverSeedHash,algorithm: state.algorithm,practiceOnly: state.practiceOnly };
  }
  if (known.roundId !== state.roundId || known.serverSeedHash !== state.serverSeedHash || known.mineCount !== state.mineCount ||
      known.algorithm !== 'hmac-sha256-mines-v1' || state.algorithm !== known.algorithm || known.practiceOnly !== true || state.practiceOnly !== true) {
   throw new Error('The saved commitment changed. This round was not accepted.');
  }
  if (!['committed','active','ended'].includes(state.phase)) throw new Error('Invalid round phase');
  if (state.phase !== 'committed' && (!known.clientSeed || known.clientSeed !== state.clientSeed)) {
   throw new Error('The submitted client seed changed or is unavailable. This round was not accepted.');
  }
  if (state.phase === 'ended' && !await verifyMinesRound(known,state)) throw new Error('Board proof did not match. This result was not accepted.');
  if (state.phase !== 'ended' && (Object.hasOwn(state,'serverSeed') || Object.hasOwn(state,'mines'))) throw new Error('Active board privacy check failed.');
  known = await observeRound(known,state,'mines',request);
  persistCommitment(known);
  setRound(state);
 }
 useEffect(() => {
  let mounted = true;
  (async () => {
   try { const state = await invoke({ action: 'current' }); if (mounted) await accept(state); }
   catch (error) { if (mounted) setError(error.message); }
   finally { if (mounted) setBusy(false); }
  })();
  return () => { mounted = false; };
 }, [user?.id]);
 async function mutate(body) {
  if (locked.current || readonly) return;
  locked.current = true; setBusy(true); setError('');
  try {
   if (body.action === 'start') {
    const known = savedCommitment(body.roundId);
    if (!known || (known.clientSeed && known.clientSeed !== body.clientSeed)) throw new Error('The saved commitment or submitted seed is unavailable or changed.');
    // Persist before the request: even a lost response must retain both inputs.
    persistCommitment({ ...known,clientSeed: body.clientSeed });
   }
   localStorage.setItem(key,JSON.stringify(body)); setPending(body);
   const state = await invoke(body);
   if (body.action==='commit' && (state.roundId!==body.roundId || state.mineCount!==body.mineCount)) throw Error('Submitted round or mine count changed');
   await accept(state,body);
   const latest = await invoke({ action: 'state', roundId: state.roundId });
   await accept(latest);
   localStorage.removeItem(key); setPending(null);
  } catch (error) { setRound(null); setError(error.message); }
  finally { locked.current = false; setBusy(false); }
 }
 async function refresh() {
  if (locked.current) return;
  locked.current = true; setBusy(true); setError('');
  try {
   await accept(await invoke({ action: 'current' }));
  } catch (error) { setRound(null); setError(error.message); }
  finally { locked.current = false; setBusy(false); }
 }
 const active = round?.phase === 'active', committed = round?.phase === 'committed', ended = round?.phase === 'ended';
 const picks = round?.picks || [];
 const safe = picks.length - (round?.endReason === 'mine' ? 1 : 0);
 const blocked = busy || readonly || !!pending;
 const request = (action,extra = {}) => ({ action,roundId: round.roundId,requestId: crypto.randomUUID(),version: round.version,...extra });
 return <main className="ig-original-screen ig-original-mines min-h-screen bg-[#0a0612] px-4 py-8 text-white">
  <div className="ig-original-shell mx-auto max-w-4xl space-y-5">
   <Link to="/Games" className="text-sm text-amber-300 hover:underline">← Back to games</Link>
   <header className="ig-original-header"><p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Imperial Originals · Practice</p>
    <h1 className="mt-2 text-4xl font-black">💎 Mines</h1>
    <p className="ig-original-description mt-3 text-gray-300">Find gems on the 25-tile board. Choose 1 to 24 hidden mines and stop whenever you want. The board stays on the server until your round ends.</p>
    <p className="ig-original-notice mt-3 rounded-xl border border-sky-400/20 bg-sky-950/30 p-3 text-sm text-sky-100">Free practice. No coins, tokens, money or prizes are charged or awarded.</p>
   </header>
   <div className="ig-original-grid grid gap-5 md:grid-cols-[1fr_1.5fr]">
    <section className="ig-original-controls space-y-4 rounded-2xl border border-white/10 bg-[#191529] p-5">
     <label className="block text-sm text-gray-300">Number of mines
      <input type="number" min="1" max="24" value={round && !ended ? round.mineCount : mineCount} disabled={blocked || active || committed}
       onChange={e => setMineCount(Number(e.target.value))} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" />
     </label>
     <label className="block text-sm text-gray-300">Client seed
      <input value={pending?.clientSeed ?? (active ? round?.clientSeed : clientSeed)} disabled={blocked || active} maxLength={128}
       onChange={e => setClientSeed(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/25 p-3 text-white" />
     </label>
     {pending ? <button type="button" disabled={busy || readonly} onClick={() => mutate(pending)} className="w-full rounded-xl bg-violet-500 p-4 font-bold disabled:opacity-50">Retry pending request</button>
      : active ? <button type="button" disabled={blocked} onClick={() => mutate(request('finish'))} className="w-full rounded-xl bg-emerald-500 p-4 font-bold text-gray-950 disabled:opacity-50">Stop and reveal board</button>
      : committed ? <button type="button" disabled={blocked || !clientSeed.trim()} onClick={() => mutate(request('start',{ clientSeed: clientSeed.trim() }))} className="w-full rounded-xl bg-violet-500 p-4 font-bold disabled:opacity-50">Start committed round</button>
      : <button type="button" disabled={blocked || !Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24}
       onClick={() => mutate({ action: 'commit',roundId: crypto.randomUUID(),mineCount })} className="w-full rounded-xl bg-violet-500 p-4 font-bold disabled:opacity-50">{ended ? 'Commit a new round' : 'Commit round'}</button>}
     <button type="button" disabled={busy} onClick={refresh} className="text-sm text-violet-200 underline disabled:opacity-50">Refresh round</button>
     <p className="text-sm text-gray-300" aria-live="polite">Gems found: {safe}</p>
     {committed && <p className="text-xs text-gray-400">The server commitment is saved. Choose your client seed, then start.</p>}
     {user?.role === 'tester' && <p className="text-sm text-amber-200">This account has read-only access.</p>}
     {busy && <p role="status" className="text-sm text-violet-200">Loading round…</p>}
     {error && <p role="alert" className="rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
    </section>
    <section aria-label="Mines board" className="ig-original-stage rounded-2xl border border-white/10 bg-[#191529] p-5">
     <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: 25 },(_,cell) => {
       const picked = picks.includes(cell), mine = ended && round.mines.includes(cell);
       const icon = mine ? '💣' : picked || ended ? '💎' : '◆';
       return <button key={cell} type="button" aria-label={`Tile ${cell+1}${mine ? ' mine' : picked ? ' gem' : ''}`}
        disabled={!active || blocked || picked} onClick={() => mutate(request('pick',{ cell }))}
        className={`aspect-square rounded-xl border text-2xl font-black transition sm:text-3xl ${mine ? 'border-red-400/40 bg-red-950/60' : picked ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-violet-300/15 bg-violet-400/10 text-violet-300 hover:bg-violet-400/25'} disabled:cursor-default`}>{icon}</button>;
      })}
     </div>
     {ended && <div className="mt-5 text-center"><p className="text-xl font-bold">{round.endReason === 'mine' ? 'Mine found' : round.endReason === 'cleared' ? 'All gems cleared!' : 'Round stopped'}</p><p className="mt-2 text-sm text-emerald-300">✓ Board proof verified on your device</p></div>}
    </section>
   </div>
   {round && <details className="ig-original-extra break-all rounded-xl border border-white/10 bg-[#191529] p-4 text-sm text-gray-300">
    <summary className="cursor-pointer font-bold text-white">Round commitment and proof</summary>
    <p className="mt-3">Round: {round.roundId}</p><p className="mt-2">SHA-256 commitment: {round.serverSeedHash}</p>
    {ended && <><p className="mt-2">Server seed: {round.serverSeed}</p><p className="mt-2">Client seed: {round.clientSeed}</p><p className="mt-2">Mine tiles (zero-based): {round.mines.join(', ')}</p></>}
    <p className="mt-2">Algorithm: HMAC-SHA256-Mines-v1</p>
   </details>}
  </div>
 </main>;
}
