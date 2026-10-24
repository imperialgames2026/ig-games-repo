import React, { useEffect, useRef, useState } from 'react';
import { practicePoker } from '@/lib/practicePoker';
import { verifyReplay, rememberDealRoot } from '@/lib/pokerReplayProof';
const cardName = card => ({11:'J',12:'Q',13:'K',14:'A'}[card.rank] || card.rank) + ({c:'♣',d:'♦',h:'♥',s:'♠'}[card.suit] || '');
export default function HandReplay({ tableId, completedHand }) {
  const [hands, setHands] = useState([]), [older, setOlder] = useState(false);
  const [selected, setSelected] = useState(null), [replay, setReplay] = useState(null);
  const [frames, setFrames] = useState([]), [step, setStep] = useState(0), [playing, setPlaying] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [proofMessage, setProofMessage] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setReplay(null); setFrames([]); setSelected(null); setStep(0); setPlaying(false); setError(''); setHands([]); setBusy(false);
    return () => { generation.current++; };
  }, [tableId]);
  useEffect(() => {
    let active = true;
    if (tableId) practicePoker.history(tableId).then(data => {
      if (active) { setHands(data.hands.slice(0,20)); setOlder(data.hands.length > 20); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [tableId, completedHand]);
  useEffect(() => {
    if (!playing) return;
    if (step >= frames.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setStep(n => Math.min(n + 1, frames.length - 1)), 1400);
    return () => clearTimeout(timer);
  }, [playing, step, frames.length]);
  async function load(hand) {
    const request = ++generation.current;
    setBusy(true); setError(''); setPlaying(false); setReplay(null); setFrames([]); setSelected(hand.handNo); setStep(0);
    try {
      let data = await practicePoker.replay(tableId, hand.handNo);
      const steps = [...data.steps];
      while (steps.length <= data.lastStep) {
        const next = await practicePoker.replay(tableId, hand.handNo, steps.length);
        if (!next.steps.length || next.root !== data.root || next.lastStep !== data.lastStep) throw Error('Incomplete or changing hand ledger');
        steps.push(...next.steps);
        if (request !== generation.current) return;
      }
      data = { ...data, steps };
      if (data.root !== hand.root || data.tableId !== tableId || data.handNo !== hand.handNo) throw Error('Hand commitment changed');
      const verified = await verifyReplay(data);
      let message = 'Card commitments and complete hand sequence verified. First observed during this replay.';
      try {
        if (rememberDealRoot(data, window.localStorage)) message = 'Card commitments and complete hand sequence match the previously observed deck lock.';
      } catch (e) {
        if (e.message.includes('changed')) throw e;
        message = 'Card commitments and hand sequence verified. Browser storage unavailable for an earlier-commitment comparison.';
      }
      if (request !== generation.current) return;
      setReplay(data); setFrames(verified); setProofMessage(message);
    } catch (e) { if (request === generation.current) setError(e.message); }
    finally { if (request === generation.current) setBusy(false); }
  }
  async function loadOlder() {
    const request = generation.current;
    try {
      const data = await practicePoker.history(tableId, hands.at(-1)?.handNo);
      if (request !== generation.current) return;
      setHands(old => [...old, ...data.hands.slice(0,20)]); setOlder(data.hands.length > 20);
    } catch (e) { if (request === generation.current) setError(e.message); }
  }
  const frame = frames[step];
  const openingByPosition = new Map((replay?.openings || []).map(o => [o.position, o]));
  const ownCards = (replay?.myPositions || []).map(p => openingByPosition.get(p)?.card).filter(Boolean);
  return <section aria-label="Poker hand history and replay" className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
    <h2 className="text-2xl font-bold">Hand history &amp; replay</h2>
    <p className="text-sm text-slate-300">Completed hands at this table. Your cards stay visible; opponents’ folded cards stay private.</p>
    <div className="grid md:grid-cols-[180px_1fr] gap-5">
      <nav aria-label="Select a poker hand" className="space-y-2 max-h-96 overflow-y-auto">
        {!hands.length && <p className="text-sm text-slate-400">No recorded completed hands yet.</p>}
        {hands.map(hand => <button key={hand.handNo} type="button" aria-pressed={selected === hand.handNo}
          onClick={() => load(hand)} className={'block w-full text-left rounded-lg p-3 '+(selected===hand.handNo?'bg-indigo-700':'bg-slate-800')}>
          Hand #{hand.handNo}<span className="block text-xs text-slate-300">{new Date(hand.createdAt).toLocaleString()}</span>
        </button>)}
        {older && <button type="button" onClick={loadOlder} className="underline text-sm">Load older hands</button>}
      </nav>
      <div className="space-y-4 min-w-0">
        {busy && <p role="status">Loading and verifying hand…</p>}
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {frame && <>
          <p className="text-emerald-300 text-sm" role="status">{proofMessage}</p>
          <div className="rounded-xl bg-emerald-950 border border-emerald-700 p-5 space-y-3">
            <p className="font-bold">Hand #{selected} · {frame.street} · {frame.status}</p>
            <p>Your cards: {ownCards.map(cardName).join(' ')}</p>
            <p className="text-xl">Board: {frame.board.map(cardName).join(' ') || 'Not dealt'}</p>
            {frame.action && <p>Seat {frame.action.seatNo}: {frame.action.timeout ? 'timeout · ' : ''}{frame.action.move} · {frame.action.chipsCommitted} chips committed</p>}
            {!frame.action && <p>{({deal:'Deck locked; hole cards and blinds dealt',street:'Next community cards dealt',showdown:'Showdown and pot settlement',time_extension:'Turn time extended'})[frame.kind] || frame.kind}</p>}
            {(frame.payouts || []).map(payout => <p key={payout.seatNo}>Seat {payout.seatNo} awarded {payout.chips} practice chips</p>)}
            <div className="grid sm:grid-cols-2 gap-2">{frame.seats.map(seat => {
              // Opponent hole openings exist only when publicly exposed at showdown.
              const shown = frame.kind === 'showdown' && !seat.folded && seat.seatNo !== replay.mySeat;
              const cards = shown ? (replay.showdownPositions?.[seat.seatNo] || []).map(p => openingByPosition.get(p)?.card).filter(Boolean) : [];
              return <div key={seat.seatNo} className="bg-black/20 rounded-lg p-3 text-sm">Seat {seat.seatNo}{seat.seatNo===replay.mySeat?' · You':''}: {seat.stack} chips · {seat.committed} in pot{seat.folded?' · Folded':''}{seat.allIn?' · All in':''}{cards.length>0 && <p>Showdown: {cards.map(cardName).join(' ')}</p>}</div>;
            })}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={step===0} onClick={()=>{setPlaying(false);setStep(n=>n-1);}} className="rounded bg-slate-700 px-4 py-2 disabled:opacity-40">Previous step</button>
            <button type="button" onClick={()=>{if(step===frames.length-1)setStep(0);setPlaying(p=>!p);}} className="rounded bg-indigo-700 px-4 py-2">{playing?'Pause':'Play replay'}</button>
            <button type="button" disabled={step===frames.length-1} onClick={()=>{setPlaying(false);setStep(n=>n+1);}} className="rounded bg-slate-700 px-4 py-2 disabled:opacity-40">Next step</button>
            <span className="text-sm">Step {step+1} of {frames.length}</span>
          </div>
          <label className="block text-sm">Jump to step<input aria-label="Replay step" type="range" min="0" max={frames.length-1} value={step} onChange={e=>{setPlaying(false);setStep(Number(e.target.value));}} className="block w-full mt-2"/></label>
          <details className="text-xs text-slate-300"><summary>Verification records</summary>
            <p className="break-all mt-3">Locked deck: {replay.root}</p>
            <p className="mt-2">Each card below includes its position, hash designator and reveal secret. No unrevealed opponent-card secrets or full shuffle seed are supplied.</p>
            <pre className="overflow-auto max-h-64 p-3 bg-black/30 mt-2">{JSON.stringify(replay.openings,null,2)}</pre>
            <p>These proofs verify consistency with the commitment. They do not independently prove the operator did not select a deck before committing it.</p>
          </details>
        </>}
      </div>
    </div>
  </section>;
}
