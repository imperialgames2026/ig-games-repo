import React, { useCallback, useEffect, useRef, useState } from 'react';
import UnityTable from './UnityTable';
import { serverPresentation, serverTarget, serverMarkers } from './multiplayer-visual.mjs';
import './table-lab.css';
export default function MultiplayerUnityTable({
  sceneRef,
  presentationSeconds = 5.05,
  bettingOpen,
  secondsLeft,
  lockReason,
  tableAction,
  actionLabel,
  wagerControl,
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
    [notice, setNotice] = useState(''),
    [expanded, setExpanded] = useState(false);
  const surface = useRef(null),
    orientationOwned = useRef(false);
  const pinchZoom = useCallback(scale => setZoom(z => Math.max(1, Math.min(2.4, z * scale))), []);
  useEffect(() => {
    const change = () => {
      if (!document.fullscreenElement) {
        setExpanded(false);
        if (orientationOwned.current) {
          screen.orientation?.unlock?.();
          orientationOwned.current = false;
        }
      }
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  async function expand() {
    if (expanded) {
      if (document.fullscreenElement === surface.current) await document.exitFullscreen();
      setExpanded(false);
      if (orientationOwned.current) {
        screen.orientation?.unlock?.();
        orientationOwned.current = false;
      }
      return;
    }
    setExpanded(true);
    try {
      await surface.current.requestFullscreen();
      try {
        await screen.orientation?.lock?.('landscape');
        orientationOwned.current = true;
      } catch {
        setNotice('Turn your phone sideways for the largest table view.');
      }
    } catch {
      setNotice('Expanded table. Turn your phone sideways for landscape.');
    }
  }
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
  return <section ref={node => {
    surface.current = node;
    if (sceneRef) sceneRef.current = node;
  }} className={'ig-table-stage ig-multiplayer-unity' + (expanded ? ' ig-unity-expanded' : '')} aria-label={`Shared ${game} Unity table`}>
  <div className="ig-unity-toolbar"><span className="ig-rotate-hint">Turn phone sideways for landscape</span><button type="button" onClick={() => void expand()}>{expanded ? 'Exit full screen' : 'Expand table'}</button><label>Camera <select aria-label="Shared table camera" value={camera} onChange={e => setCamera(e.target.value)}><option value="table">Table view</option><option value="overhead">Overhead</option></select></label><label>Zoom <input aria-label="Shared table zoom" type="range" min="1" max="2.4" step=".05" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />Reduced motion</label></div>
  <div className="ig-unity-stage-wrap"><UnityTable presentationSeconds={presentationSeconds} onZoomGesture={pinchZoom} fallbackLabel="2D felt" game={game} outcome={outcome} reduced={reduced} camera={camera} zoom={zoom} bet={bet} onBet={onBet} onStatus={onStatus} />
  {!canBet && <div className="ig-unity-lock" role="status">{lockReason}</div>}
  <div className="ig-shared-dock"><strong role="status">{bettingOpen ? `Bets open · ${secondsLeft}s` : `Betting closed · ${secondsLeft}s`}</strong><label>Wager amount {wagerControl}</label>{tableAction && <button type="button" disabled={busy} onClick={tableAction}>{actionLabel}</button>}<span>Tap the felt · pinch to zoom</span></div></div>
  <p role="status">{status} · Shared server round {table.round}. Chips on the felt show all players’ confirmed bets.</p>
  <p>{game === 'craps' ? 'Tap PASS LINE to wager. Use the betting card or 2D felt for other craps bets.' : 'Tap a number, green 0, red, black, even or odd. Use 2D felt for dozens, columns and high/low bets.'}</p>
  <p className="ig-unity-wager">Wager: {stake} practice chips · Available: {table.chips}</p>
  {notice && <p role="status">{notice}</p>}
  {status === 'Unity load failed' && <button type="button" onClick={onFallback}>Use 2D felt</button>}
 </section>;
}
