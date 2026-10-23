import React, { useCallback, useEffect, useRef, useState } from "react";
import TableScene from "../components/practice/TableScene";
import UnityTable from "../components/practice/UnityTable";
import { createOutcome, reds } from "../components/practice/outcomes.mjs";
import { settlePractice } from "../components/practice/practice-rules.mjs";
import { PracticeAudio } from "../components/practice/practice-audio.mjs";
import "../components/practice/table-lab.css";
export default function TableLab() {
  const [game, setGame] = useState("roulette"),
    [outcome, setOutcome] = useState(null),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("red"),
    [chips, setChips] = useState(1000),
    [stake, setStake] = useState(10),
    [point, setPoint] = useState(0);
  const [message, setMessage] = useState("Choose a practice bet, then spin."),
    [history, setHistory] = useState([]);
  const [reduced, setReduced] = useState(false),
    [sound, setSound] = useState(false),
    [camera, setCamera] = useState("table"),
    [renderer, setRenderer] = useState("unity"),
    [unityStatus, setUnityStatus] = useState("Unity not loaded"),
    [attempt, setAttempt] = useState(0);
  const lock = useRef(false),
    timer = useRef(null),
    audio = useRef(null),
    settled = useRef(new Set());
  const onStatus = useCallback((s) => setUnityStatus(s), []);
  useEffect(() => {
    audio.current = new PracticeAudio();
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(q.matches);
    update();
    q.addEventListener("change", update);
    const hidden = () => {
      if (document.hidden) audio.current?.stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      q.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", hidden);
      clearTimeout(timer.current);
      audio.current?.close();
    };
  }, []);
  async function toggleSound() {
    const value = !sound;
    try {
      await audio.current.enable(value);
      setSound(value);
    } catch {
      setMessage("Audio could not start. Tap sound to try again.");
    }
  }
  function play() {
    if (
      lock.current ||
      (!point && chips < stake) ||
      (renderer === "unity" &&
        unityStatus !== "Unity ready" &&
        unityStatus !== "Unity animation complete")
    )
      return;
    lock.current = true;
    setBusy(true);
    const next = createOutcome(game);
    setOutcome(next);
    setMessage(game === "roulette" ? "Ball in motion…" : "Dice in motion…");
    if (game === "roulette" || !point) setChips((c) => c - stake);
    if (!reduced) audio.current.play(game);
    // Settlement uses the immutable outcome, never a renderer callback or physics result.
    timer.current = setTimeout(
      () => {
        if (settled.current.has(next.roundId)) return;
        settled.current.add(next.roundId);
        if (settled.current.size > 256) {
          settled.current.clear();
          settled.current.add(next.roundId);
        }
        const result = settlePractice({
          outcome: next,
          selected,
          point,
          stake,
        });
        setPoint(result.point);
        setChips((c) => c + result.credit);
        setMessage(result.label);
        setHistory((h) =>
          [{ id: next.roundId, text: result.label }, ...h].slice(0, 6),
        );
        audio.current.result(result.result === "win");
        lock.current = false;
        setBusy(false);
      },
      reduced ? 80 : 2800,
    );
  }
  const unityReady = ["Unity ready", "Unity animation complete"].includes(
    unityStatus,
  );
  return (
    <main className="table-lab">
      <header>
        <div>
          <a className="lab-back" href="/Games">
            ← Lobby
          </a>
          <small>IMPERIAL GAMING LLC</small>
          <h1>The Imperial tables</h1>
          <p>3D practice studio · fictional chips · no cash value</p>
        </div>
        <div className="chip-balance">
          <small>PRACTICE BALANCE</small>
          <strong>{chips.toLocaleString()}</strong>
          {point > 0 && (
            <span>
              {stake} on pass line · point {point}
            </span>
          )}
        </div>
      </header>
      <nav aria-label="Practice game">
        {["roulette", "craps"].map((g) => (
          <button
            key={g}
            disabled={busy || !!point}
            aria-pressed={game === g}
            onClick={() => {
              setGame(g);
              setOutcome(null);
              setMessage(
                g === "craps"
                  ? "Pass line practice · roll to establish a point."
                  : "Choose a practice bet, then spin.",
              );
            }}
          >
            {g === "roulette" ? "Single-zero roulette" : "Craps"}
          </button>
        ))}
      </nav>
      <div className="scene-toolbar">
        <label>
          Renderer{" "}
          <select
            aria-label="Renderer"
            disabled={busy}
            value={renderer}
            onChange={(e) => {
              setRenderer(e.target.value);
              setUnityStatus("Unity not loaded");
            }}
          >
            <option value="web">Lightweight 3D</option>
            <option value="unity">Unity 3D</option>
          </select>
        </label>
        <label>
          Camera{" "}
          <select
            aria-label="Camera"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
          >
            <option value="table">Table view</option>
            <option value="overhead">Overhead</option>
          </select>
        </label>
        <button aria-pressed={sound} onClick={toggleSound}>
          {sound ? "Sound on" : "Sound off"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />{" "}
          Reduced motion
        </label>
      </div>
      {renderer === "unity" ? (
        <>
          <UnityTable
            key={attempt}
            game={game}
            outcome={outcome}
            reduced={reduced}
            camera={camera}
            onStatus={onStatus}
          />
          <p className="renderer-status" role="status">
            {unityStatus}
            {unityStatus === "Unity load failed" && (
              <button
                onClick={() => {
                  setUnityStatus("Unity not loaded");
                  setAttempt((a) => a + 1);
                }}
              >
                Retry Unity
              </button>
            )}
          </p>
        </>
      ) : (
        <TableScene
          game={game}
          outcome={outcome}
          busy={busy}
          reduced={reduced}
          cameraView={camera}
        />
      )}
      <section className="betting-panel" aria-label={`${game} practice bets`}>
        <div className="panel-heading">
          <h2>
            {game === "roulette" ? "Place your chips" : "Join the pass line"}
          </h2>
          <span>
            {game === "roulette"
              ? `Selected: ${selected}`
              : point
                ? `Point ${point} · stake stays on table`
                : "Come-out roll"}
          </span>
        </div>
        {game === "roulette" ? (
          <>
            <div className="number-grid">
              <button
                disabled={busy}
                onClick={() => setSelected(0)}
                aria-pressed={selected === 0}
              >
                0
              </button>
              {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={reds.has(n) ? "red" : "black"}
                  disabled={busy}
                  aria-label={`Bet on ${n}`}
                  aria-pressed={selected === n}
                  onClick={() => setSelected(n)}
                >
                  {n}
                  {selected === n && (
                    <span className="bet-chip" aria-hidden="true">
                      {stake}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="outside">
              {["red", "black", "even", "odd"].map((b) => (
                <button
                  key={b}
                  disabled={busy}
                  aria-pressed={selected === b}
                  onClick={() => setSelected(b)}
                >
                  {b}
                </button>
              ))}
            </div>
            <p>
              Straight number pays 35:1 · outside bets pay 1:1 · zero loses
              outside bets.
            </p>
          </>
        ) : (
          <>
            <div className="pass">
              PASS LINE<strong>{point ? `POINT ${point}` : "COME OUT"}</strong>
              <span className="bet-chip">{stake}</span>
            </div>
            <p>
              Come-out: 7 or 11 wins; 2, 3 or 12 loses. Otherwise establish a
              point, then repeat it before a 7. Only pass-line bets are active
              in this prototype.
            </p>
          </>
        )}
      </section>
      <footer>
        <label>
          Chip amount{" "}
          <select
            aria-label="Chip amount"
            disabled={busy || !!point}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
          >
            {[10, 25, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          className="action"
          disabled={
            busy ||
            (!point && chips < stake) ||
            (renderer === "unity" && !unityReady)
          }
          onClick={play}
        >
          {busy
            ? "In motion…"
            : game === "roulette"
              ? `Spin · ${stake} chips`
              : `Roll dice · ${point ? "continue" : stake + " chips"}`}
        </button>
        <button
          disabled={busy || !!point}
          onClick={() => {
            setChips(1000);
            setHistory([]);
            setMessage("Practice balance reset.");
          }}
        >
          Reset practice
        </button>
        <p className="round-result" role="status" aria-live="polite">
          {message}
        </p>
      </footer>
      <section aria-label="Recent practice rounds" className="round-history">
        <h2>Recent action</h2>
        {history.length ? (
          <ol>
            {history.map((h) => (
              <li key={h.id}>{h.text}</li>
            ))}
          </ol>
        ) : (
          <p>Your practice results will appear here.</p>
        )}
      </section>
    </main>
  );
}
