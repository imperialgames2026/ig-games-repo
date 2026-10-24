import React, { useCallback, useEffect, useRef, useState } from 'react';
import UnityTable from './UnityTable';
import { serverPresentation, serverTarget, serverMarkers } from './multiplayer-visual.mjs';
import './table-lab.css';
export default function MultiplayerUnityTable({
  sceneRef,
  game,
  table,
  canBet,
  busy,
  stake,
  placeBet,
  onFallback
}) {
  const [status, setStatus] = useState('Loading Unity'),
    [camera, setCamera] = useState('table'),
    [zoom, setZoom] = useState(1.12),
    [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    [placing, setPlacing] = useState(false),
    [notice, setNotice] = useState('');
  const flight = useRef(false),
    latest = useRef(null);
  latest.current = {
    canBet,
    busy,
    stake,
    placeBet,
    game
  };
  const onStatus = useCallback(s => setStatus(s), []);
  useEffect(() => {
    setNotice('');
  }, [game]);
  const onBet = useCallback(async selection => {
    const s = latest.current,
      target = serverTarget(s.game, selection);
    if (!target || !s.canBet || s.busy || flight.current) return;
    flight.current = true;
    setPlacing(true);
    setNotice('Submitting wager to shared table…');
    try {
      const ok = await s.placeBet(target, s.stake);
      setNotice(ok ? 'Wager confirmed by server.' : 'Wager not confirmed. Check the table message before retrying.');
    } catch {
      setNotice('Wager not confirmed. Refresh the shared table before retrying.');
    } finally {
      flight.current = false;
      setPlacing(false);
    }
  }, []);
  const outcome = serverPresentation(game, table.lastResult);
  const bet = {
    version: 1,
    game,
    point: table.point || 0,
    placements: serverMarkers(game, table.publicBets),
    locked: !canBet || busy || placing
  };
  return <section ref={sceneRef} className="ig-table-stage ig-multiplayer-unity" aria-label={`Shared ${game} Unity table`}>
  <div className="ig-unity-toolbar"><label>Camera <select aria-label="Shared table camera" value={camera} onChange={e => setCamera(e.target.value)}><option value="table">Table view</option><option value="overhead">Overhead</option></select></label><label>Zoom <input aria-label="Shared table zoom" type="range" min="1" max="2.4" step=".05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />Reduced motion</label></div>
  <UnityTable fallbackLabel="2D felt" game={game} outcome={outcome} reduced={reduced} camera={camera} zoom={zoom} bet={bet} onBet={onBet} onStatus={onStatus} />
  <p role="status">{status} · Shared server round {table.round}. Chips on the felt show all players’ confirmed bets.</p>
  <p>{game === 'craps' ? 'Tap PASS LINE to wager. Use the betting card or 2D felt for other craps bets.' : 'Tap a number, green 0, red, black, even or odd. Use 2D felt for dozens, columns and high/low bets.'}</p>
  <p className="ig-unity-wager">Wager: {stake} practice chips · Available: {table.chips}</p>
  {notice && <p role="status">{notice}</p>}
  {status === 'Unity load failed' && <button type="button" onClick={onFallback}>Use 2D felt</button>}
 </section>;
}
