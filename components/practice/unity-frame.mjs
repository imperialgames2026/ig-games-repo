import { loadUnity } from "./unity-loader.mjs";
import { selectionAtScreen, validBet } from "./bet-layout.mjs";
import { validateOutcome } from "./outcomes.mjs";
let runtime,
  sceneReady = false,
  closed = false;
const post = (type, detail = {}) => {
  if (!closed) window.parent.postMessage({
    channel: "imperial-practice-event",
    type,
    ...detail
  }, location.origin);
};
// Presentation-only hit testing. The parent and server retain wager authority.
let inputGame = 'roulette',
  inputCamera = 'table',
  inputZoom = 1.12,
  inputBet = null;
const controller = new AbortController();
const timeout = setTimeout(() => {
  controller.abort();
  post("error", {
    message: "Unity loading took too long"
  });
}, 60000);
function ready() {
  if (runtime && sceneReady) {
    clearTimeout(timeout);
    post("ready");
  }
}
window.addEventListener("imperial-unity-practice", e => {
  if (e.detail?.version !== 1) return;
  if (e.detail.type === "ready") {
    sceneReady = true;
    ready();
  }
  if (['motion', 'betPlacement', 'layout'].includes(e.detail.type)) post(e.detail.type, e.detail);
  if (e.detail.type === "complete") post("complete", {
    roundId: e.detail.roundId
  });
});
window.addEventListener("message", e => {
  if (e.origin !== location.origin || e.source !== window.parent || e.data?.channel !== "imperial-practice-command" || !runtime || !sceneReady) return;
  const {
    command,
    value
  } = e.data;
  if (command === "Hello") {
    ready();
    return;
  }
  if (command === "PresentOutcome") {
    try {
      if (!validateOutcome(JSON.parse(value))) return;
    } catch {
      return;
    }
  } else if (command === 'SetBet') {
    try {
      if (!validBet(JSON.parse(value))) return;
    } catch {
      return;
    }
  } else if (command === "SetZoom") {
    if (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 2.4) return;
  } else if (command === "SetRoundDuration") {
    if (!Number.isFinite(Number(value)) || Number(value) < .01 || Number(value) > 8) return;
  } else if (command === "SetGame") {
    if (!["roulette", "craps"].includes(value)) return;
  } else if (command === "SetReducedMotion") {
    if (!["true", "false"].includes(value)) return;
  } else if (command === "CameraView") {
    if (!["table", "overhead"].includes(value)) return;
  } else return;
  if (command === "PresentOutcome") document.getElementById("imperial-unity-practice-canvas").focus();
  if (command === 'SetGame') inputGame = value;
  if (command === 'CameraView') inputCamera = value;
  if (command === 'SetZoom') inputZoom = Number(value);
  if (command === 'SetBet') {
    inputBet = JSON.parse(value);
    runtime.SendMessage('PracticeBridge', command, JSON.stringify({
      ...inputBet,
      locked: true
    }));
    return;
  }
  runtime.SendMessage("PracticeBridge", command, value);
});
loadUnity(document.getElementById("imperial-unity-practice-canvas"), {
  signal: controller.signal,
  onProgress: progress => post("progress", {
    progress
  })
}).then(value => {
  runtime = value;
  if (closed) {
    void value.Quit();
    return;
  }
  ready();
}).catch(error => {
  clearTimeout(timeout);
  post("error", {
    message: error.message
  });
});
document.addEventListener("visibilitychange", () => runtime?.SendMessage("PracticeBridge", "SetPaused", String(document.hidden)));
window.addEventListener("pagehide", () => {
  closed = true;
  clearTimeout(timeout);
  controller.abort();
  void runtime?.Quit();
}, {
  once: true
});
const inputCanvas = document.getElementById('imperial-unity-practice-canvas'),
  pointers = new Map();
let multi = false,
  pinchDistance = 0;
inputCanvas.style.touchAction = 'none';
inputCanvas.addEventListener('pointerdown', e => {
  // Touch contacts also use button 0; retain all fingers for pinch gestures.
  if (e.button !== 0) return;
  pointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY
  });
  if (pointers.size > 1) {
    multi = true;
    const [a, b] = [...pointers.values()];
    pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
inputCanvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()],
      d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDistance > 0 && d > 0) {
      const scale = d / pinchDistance;
      if (scale >= .5 && scale <= 2) post('gesture', {
        scale
      });
    }
    pinchDistance = d;
  }
});
inputCanvas.addEventListener('pointerup', e => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (e.button === 0 && p && !multi && sceneReady && inputBet && !inputBet.locked && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 14) {
    const r = inputCanvas.getBoundingClientRect(),
      s = selectionAtScreen(inputGame, (e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, r.width / r.height, inputCamera, inputZoom);
    if (s !== null) post('bet', {
      selection: s
    });
  }
  if (!pointers.size) {
    multi = false;
    pinchDistance = 0;
  }
});
inputCanvas.addEventListener('pointercancel', e => {
  pointers.delete(e.pointerId);
  if (!pointers.size) {
    multi = false;
    pinchDistance = 0;
  }
});
