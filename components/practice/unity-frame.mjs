import { loadUnity } from "./unity-loader.mjs";
import { validBet } from "./bet-layout.mjs";
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
  if (e.detail.type === 'bet' && typeof e.detail.selection === 'string') post('bet', {
    selection: e.detail.selection
  });
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
  } else if (command === "SetGame") {
    if (!["roulette", "craps"].includes(value)) return;
  } else if (command === "SetReducedMotion") {
    if (!["true", "false"].includes(value)) return;
  } else if (command === "CameraView") {
    if (!["table", "overhead"].includes(value)) return;
  } else return;
  if (command === "PresentOutcome") document.getElementById("imperial-unity-practice-canvas").focus();
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
