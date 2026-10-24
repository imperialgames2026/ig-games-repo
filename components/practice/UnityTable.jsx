import React, { useEffect, useRef, useState } from "react";
import { validBet, validSelection } from "./bet-layout.mjs";
import { validateOutcome } from "./outcomes.mjs";
export default function UnityTable({
  game,
  outcome,
  reduced,
  camera,
  onStatus,
  onComplete,
  onBet,
  bet,
  zoom
}) {
  const frame = useRef(null),
    latest = useRef({
      game,
      outcome,
      reduced,
      camera,
      bet,
      onBet,
      onComplete,
      zoom
    }),
    sent = useRef(null);
  const [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  latest.current = {
    game,
    outcome,
    reduced,
    camera,
    bet,
    onBet,
    onComplete,
    zoom
  };
  useEffect(() => {
    const send = (command, value) => frame.current?.contentWindow?.postMessage({
      channel: "imperial-practice-command",
      command,
      value
    }, location.origin);
    const handshake = setInterval(() => send("Hello", ""), 250);
    const event = e => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.channel !== "imperial-practice-event") return;
      const message = e.data;
      if (message.type === "progress") setProgress(message.progress);
      if (message.type === "error") {
        clearInterval(handshake);
        setError(message.message);
        onStatus("Unity load failed");
      }
      if (message.type === "ready") {
        clearInterval(handshake);
        const s = latest.current;
        send("SetGame", s.game);
        send("SetReducedMotion", String(s.reduced));
        send("CameraView", s.camera);
        setReady(true);
        onStatus("Unity ready");
      }
      if (message.type === 'bet' && !latest.current.bet.locked && validSelection(latest.current.game, message.selection)) latest.current.onBet(message.selection);
      if (message.type === 'complete') latest.current.onComplete?.(message.roundId);
      // Completion changes timing only; React owns the immutable outcome and settlement.
    };
    window.addEventListener("message", event);
    return () => {
      clearInterval(handshake);
      window.removeEventListener("message", event);
    };
  }, [onStatus]);
  useEffect(() => {
    if (!ready) return;
    const send = (command, value) => frame.current?.contentWindow?.postMessage({
      channel: "imperial-practice-command",
      command,
      value
    }, location.origin);
    send("SetGame", game);
    send("SetReducedMotion", String(reduced));
    send("CameraView", camera);
    send("SetZoom", String(zoom));
    if (validBet(bet)) send("SetBet", JSON.stringify(bet));
    if (outcome && sent.current !== outcome.roundId && validateOutcome(outcome)) {
      send("PresentOutcome", JSON.stringify(outcome));
      sent.current = outcome.roundId;
    }
  }, [game, outcome, reduced, camera, ready, bet, zoom]);
  return <div className="unity-surface">
      <iframe ref={frame} src="/unity-practice-frame.html" title={`Unity 3D ${game} table`} className="table-scene" />
      {!ready && !error && <p role="status">Loading Unity table… {Math.round(progress * 100)}%</p>}
      {error && <p role="alert">{error}. Select Lightweight 3D to keep practicing.</p>}
    </div>;
}
