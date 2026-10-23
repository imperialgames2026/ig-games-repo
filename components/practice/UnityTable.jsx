import React, { useEffect, useRef, useState } from "react";
import { validateOutcome } from "./outcomes.mjs";
export default function UnityTable({
  game,
  outcome,
  reduced,
  camera,
  onStatus,
}) {
  const frame = useRef(null),
    latest = useRef({ game, outcome, reduced, camera }),
    sent = useRef(null);
  const [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  latest.current = { game, outcome, reduced, camera };
  useEffect(() => {
    const send = (command, value) =>
      frame.current?.contentWindow?.postMessage(
        { channel: "imperial-practice-command", command, value },
        location.origin,
      );
    const handshake = setInterval(() => send("Hello", ""), 250);
    const event = (e) => {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow ||
        e.data?.channel !== "imperial-practice-event"
      )
        return;
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
      // Completion is telemetry; the renderer stays ready between rounds.
    };
    window.addEventListener("message", event);
    return () => {
      clearInterval(handshake);
      window.removeEventListener("message", event);
    };
  }, [onStatus]);
  useEffect(() => {
    if (!ready) return;
    const send = (command, value) =>
      frame.current?.contentWindow?.postMessage(
        { channel: "imperial-practice-command", command, value },
        location.origin,
      );
    send("SetGame", game);
    send("SetReducedMotion", String(reduced));
    send("CameraView", camera);
    if (
      outcome &&
      sent.current !== outcome.roundId &&
      validateOutcome(outcome)
    ) {
      send("PresentOutcome", JSON.stringify(outcome));
      sent.current = outcome.roundId;
    }
  }, [game, outcome, reduced, camera, ready]);
  return (
    <div className="unity-surface">
      <iframe
        ref={frame}
        src="/unity-practice-frame.html"
        title={`Unity 3D ${game} table`}
        className="table-scene"
      />
      {!ready && !error && (
        <p role="status">Loading Unity table… {Math.round(progress * 100)}%</p>
      )}
      {error && (
        <p role="alert">{error}. Select Lightweight 3D to keep practicing.</p>
      )}
    </div>
  );
}
