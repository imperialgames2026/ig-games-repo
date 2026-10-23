// Own timing only: outcomes and fictional-chip settlement stay with TableLab.
export function createVisibleRounds({hidden, now = () => performance.now(), set = setTimeout, clear = clearTimeout}) {
  let alive = true, pending = null, watchdog = null, automatic = null, autoTask = null;
  let paused = hidden(), watchGeneration = 0, autoGeneration = 0;
  const visible = () => alive && !hidden() && !paused;
  const stopWatchdog = () => { watchGeneration++; clear(watchdog); watchdog = null; };
  const stopAuto = () => { autoGeneration++; clear(automatic); automatic = null; };
  function finish(round) {
    if (!visible() || pending !== round) return;
    stopWatchdog();
    pending = null; // Reentrant completion/watchdog callbacks cannot settle twice.
    round.finish();
  }
  function armWatchdog() {
    if (!visible() || !pending) return;
    const round = pending, generation = watchGeneration;
    round.started = now();
    watchdog = set(() => {
      if (generation !== watchGeneration) return;
      watchdog = null;
      if (!visible() || pending !== round) return;
      finish(round);
    }, round.remaining);
  }
  function armAuto() {
    stopAuto();
    if (!visible() || pending || !autoTask) return;
    const task = autoTask, generation = autoGeneration;
    automatic = set(() => {
      if (generation !== autoGeneration) return;
      automatic = null;
      if (visible() && !pending && autoTask === task) { autoTask = null; task(); }
    }, 1400);
  }
  return {
    canPlay: () => visible() && !pending,
    start(id, delay, finishRound) {
      if (!visible() || pending) return false;
      stopAuto(); autoTask = null;
      pending = {id, remaining: delay, started: now(), complete: false, finish: finishRound};
      armWatchdog(); return true;
    },
    complete(id) {
      if (!alive || pending?.id !== id) return;
      pending.complete = true;
      finish(pending); // Hidden callbacks are remembered, never settled unseen.
    },
    scheduleAuto(task) {
      stopAuto(); autoTask = alive ? task : null; armAuto();
    },
    visibilityChanged() {
      if (!alive) return;
      if (hidden()) {
        if (!paused && pending) pending.remaining = Math.max(0, pending.remaining - (now() - pending.started));
        paused = true; stopWatchdog(); stopAuto();
      } else if (paused) {
        paused = false;
        if (pending?.complete) finish(pending);
        else armWatchdog();
        armAuto(); // A fresh delay, never elapsed hidden time or missed rounds.
      }
    },
    dispose() { alive = false; stopWatchdog(); stopAuto(); pending = null; autoTask = null; }
  };
}
