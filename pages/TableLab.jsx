import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import TableScene from '../components/practice/TableScene';
import UnityTable from '../components/practice/UnityTable';
import { createOutcome } from '../components/practice/outcomes.mjs';
import { settlePractice, tableReducer, initialTableState } from '../components/practice/practice-rules.mjs';
import { ACTION_DURATION_MS, betName, validAmount, validSelection } from '../components/practice/bet-layout.mjs';
import { PracticeAudio } from '../components/practice/practice-audio.mjs';
import '../components/practice/table-lab.css';
export default function TableLab() {
  const [table, dispatch] = useReducer(tableReducer, initialTableState),
    {
      game,
      chips,
      bets,
      point
    } = table;
  const [amount, setAmount] = useState('10'),
    [outcome, setOutcome] = useState(null),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState([]),
    [message, setMessage] = useState('Enter a wager, then tap the felt to place your chips.');
  const [reduced, setReduced] = useState(false),
    [sound, setSound] = useState(false),
    [camera, setCamera] = useState('table'),
    [zoom, setZoom] = useState(1.12),
    [renderer, setRenderer] = useState('unity'),
    [unityStatus, setUnityStatus] = useState('Unity not loaded'),
    [attempt, setAttempt] = useState(0),
    [auto, setAuto] = useState(false);
  const audio = useRef(null),
    lock = useRef(false),
    timer = useRef(null),
    scene = useRef(null),
    settled = useRef(new Set()),
    latest = useRef(null),
    autoTimer = useRef(null),
    playRef = useRef(null),
    clearQueued = useRef(false),
    pendingPresentation = useRef(null);
  latest.current = {
    table,
    amount
  };
  const total = Object.values(bets).reduce((a, b) => a + b, 0),
    unityReady = unityStatus === 'Unity ready';
  const onStatus = useCallback(s => setUnityStatus(s), []);
  const onComplete = useCallback(id => {
    if (pendingPresentation.current?.id === id) {
      clearTimeout(timer.current);
      pendingPresentation.current.finish();
      pendingPresentation.current = null;
    }
  }, []);
  const onTableBet = useCallback(selection => {
    const {
        table: t,
        amount: a
      } = latest.current,
      n = Number(a);
    if (lock.current || t.point) return;
    if (!validSelection(t.game, selection)) return;
    if (!validAmount(n)) {
      setMessage('Enter a whole-chip wager from 1 or more.');
      return;
    }
    const action = {
        type: 'place',
        selection,
        amount: n
      },
      next = tableReducer(t, action);
    if (next === t) {
      setMessage('Not enough practice chips for that wager.');
      return;
    }
    latest.current = {
      ...latest.current,
      table: next
    };
    dispatch(action);
    setMessage(`${n} chips placed on ${betName(selection)}. Tap another spot to add a bet.`);
    audio.current?.tone(1200, 0, .08, .035, 'triangle');
  }, []);
  useEffect(() => {
    audio.current = new PracticeAudio();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const update = () => setReduced(media.matches),
      hidden = () => {
        if (document.hidden) audio.current?.stop();
      };
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', hidden);
      clearTimeout(timer.current);
      clearTimeout(autoTimer.current);
      audio.current?.close();
    };
  }, []);
  async function toggleSound() {
    try {
      await audio.current.enable(!sound);
      setSound(!sound);
    } catch {
      setMessage('Tap sound again to enable audio.');
    }
  }
  function play() {
    if (lock.current || !total || !table.funded || renderer === 'unity' && !unityReady) return;
    scene.current?.scrollIntoView({
      behavior: 'instant',
      block: 'center'
    });
    lock.current = true;
    setBusy(true);
    const next = createOutcome(game);
    setOutcome(next);
    setMessage(game === 'roulette' ? 'Bets closed · wheel spinning…' : 'Pass line locked · dice rolling…');
    if (!reduced) audio.current.play(game);
    const finish = () => {
      if (settled.current.has(next.roundId)) return;
      settled.current.add(next.roundId);
      if (settled.current.size > 256) {
        settled.current.clear();
        settled.current.add(next.roundId);
      }
      const results = Object.entries(bets).map(([s, stake]) => settlePractice({
        outcome: next,
        selected: /^\d+$/.test(s) ? Number(s) : s,
        point,
        stake
      }));
      const credit = results.reduce((a, r) => a + r.credit, 0),
        label = game === 'craps' ? results[0].label : `${next.values[0]} · ${credit ? `${credit} chips returned` : 'No winning bets'}`;
      dispatch({
        type: 'settle',
        outcome: next
      });
      if (clearQueued.current && (game === 'roulette' || results[0].point === 0)) {
        dispatch({
          type: 'clear'
        });
        clearQueued.current = false;
      }
      setMessage(label);
      setHistory(h => [{
        id: next.roundId,
        text: label
      }, ...h].slice(0, 6));
      audio.current.result(credit > 0);
      lock.current = false;
      setBusy(false);
    };
    pendingPresentation.current = {
      id: next.roundId,
      finish
    };
    timer.current = setTimeout(finish, renderer === 'unity' && !reduced ? 30000 : reduced ? 100 : ACTION_DURATION_MS);
  }
  playRef.current = play;
  useEffect(() => {
    clearTimeout(autoTimer.current);
    if (auto && !busy && total && table.funded && (renderer !== 'unity' || unityReady)) autoTimer.current = setTimeout(() => playRef.current(), 1400);
    return () => clearTimeout(autoTimer.current);
  }, [auto, busy, total, table.funded, renderer, unityReady]);
  const payload = {
    version: 1,
    game,
    placements: Object.entries(bets).map(([selection, amount]) => ({
      selection,
      amount
    })),
    locked: busy || !!point,
    point
  };
  return <main className="table-lab table-action-lab">
  <header><div><a className="lab-back" href="/Games">← Lobby</a><small>IMPERIAL GAMING</small><h1>The Imperial tables</h1><p>Practice chips · no cash value</p></div><div className="chip-balance"><small>AVAILABLE CHIPS</small><strong>{chips.toLocaleString()}</strong><span>{total} on the felt{point ? ` · point ${point}` : ''}</span></div></header>
  <nav aria-label="Practice game">{['roulette', 'craps'].map(g => <button key={g} disabled={busy || !!total} aria-pressed={game === g} onClick={() => {
        dispatch({
          type: 'game',
          game: g
        });
        setOutcome(null);
        setMessage('Enter a wager, then tap the felt to place your chips.');
      }}>{g === 'roulette' ? 'Single-zero roulette' : 'Craps'}</button>)}</nav>
  <div className="scene-toolbar"><label>Renderer <select aria-label="Renderer" disabled={busy} value={renderer} onChange={e => {
          setRenderer(e.target.value);
          setUnityStatus('Unity not loaded');
        }}><option value="unity">Unity 3D</option><option value="web">Lightweight 3D</option></select></label><label>Camera <select aria-label="Camera" value={camera} onChange={e => setCamera(e.target.value)}><option value="table">Table view</option><option value="overhead">Overhead</option></select></label><label>Zoom <input aria-label="Table zoom" type="range" min="1" max="2.4" step=".05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><button aria-pressed={sound} onClick={toggleSound}>{sound ? 'Sound on' : 'Sound off'}</button><label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /> Reduced motion</label></div>
  {reduced && <p className="motion-notice">Reduced motion is on. <button onClick={() => setReduced(false)}>Enable full action</button></p>}
  <p className="portrait-tip">Turn your phone sideways for the largest full-table view. Use Zoom to bring the felt closer.</p>
  <div ref={scene} className="action-stage">
   {renderer === 'unity' ? <><UnityTable key={attempt} game={game} outcome={outcome} reduced={reduced} camera={camera} zoom={zoom} onZoomGesture={scale=>setZoom(z=>Math.max(1,Math.min(2.4,z*scale)))} bet={payload} onBet={onTableBet} onStatus={onStatus} onComplete={onComplete} /><p className="renderer-status" role="status">{unityStatus}{unityStatus === 'Unity load failed' && <button onClick={() => {
            setUnityStatus('Unity not loaded');
            setAttempt(a => a + 1);
          }}>Retry Unity</button>}</p></> : <TableScene game={game} outcome={outcome} busy={busy} reduced={reduced} cameraView={camera} zoom={zoom} onZoomGesture={scale=>setZoom(z=>Math.max(1,Math.min(2.4,z*scale)))} bet={payload} onBet={onTableBet} />}
  </div>
  <p className="felt-instructions">{game === 'roulette' ? 'Tap a number, RED, BLACK, GREEN 0, EVEN or ODD on the felt. Red/black/even/odd pay 1:1; a single number, including 0, pays 35:1.' : `PASS LINE · PAYS 1:1. Come-out: 7 or 11 wins; 2, 3 or 12 loses. Otherwise repeat the point before a 7.${point ? ` Current point: ${point}.` : ''}`}</p>
  <footer className="action-dock"><label>Wager amount <input aria-label="Wager amount" inputMode="numeric" type="number" min="1" step="1" value={amount} disabled={busy || !!point} onChange={e => setAmount(e.target.value)} /></label><button className="action" disabled={busy || !total || !table.funded || renderer === 'unity' && !unityReady} onClick={play}>{busy ? 'Action in progress…' : game === 'roulette' ? `Spin · ${total} chips` : `Roll dice · ${point ? 'continue' : total + ' chips'}`}</button><button disabled={!total} onClick={() => {
        setAuto(false);
        if (busy || point) {
          clearQueued.current = true;
          setMessage('Bets will clear when the current hand finishes.');
        } else {
          dispatch({
            type: 'clear'
          });
          setMessage('Bets cleared.');
        }
      }}>Clear bets</button><button disabled={busy || !!point || !table.undo.length} onClick={() => {
        dispatch({
          type: 'undo'
        });
        setMessage('Last chip placement undone.');
      }}>Back / Undo</button><label><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />Automatic rounds</label><button disabled={busy || !!total} onClick={() => {
        dispatch({
          type: 'reset'
        });
        setHistory([]);
        setMessage('Practice balance reset.');
      }}>Reset practice</button><div className="wager-summary" aria-label="Placed bets">{Object.entries(bets).length ? Object.entries(bets).map(([s, a]) => <span key={s}>{betName(s)}: {a}</span>) : 'Enter an amount, then tap the table.'}</div>{!table.funded && <p role="alert">Not enough available chips to repeat all bets. Clear or undo bets to continue.</p>}<p className="round-result" role="status" aria-live="polite">{message}</p></footer>
  <section className="round-history" aria-label="Recent practice rounds"><h2>Recent action</h2>{history.length ? <ol>{history.map(h => <li key={h.id}>{h.text}</li>)}</ol> : <p>Your practice results will appear here.</p>}</section>
 </main>;
}
