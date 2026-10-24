// Original synthesized sound effects; no external samples or autoplay.
export class PracticeAudio {
  constructor() {
    this.context = null;
    this.nodes = new Set();
    this.enabled = false;
  }
  async enable(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return;
    this.context ??= new C();
    await this.context.resume();
  }
  tone(frequency, at, duration, volume = 0.06, type = "sine") {
    if (!this.enabled || !this.context || document.hidden) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, c.currentTime + at);
    g.gain.setValueAtTime(0.001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(volume, c.currentTime + at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + at + duration);
    o.connect(g);
    g.connect(c.destination);
    this.nodes.add(o);
    o.onended = () => {
      this.nodes.delete(o);
      o.disconnect();
      g.disconnect();
    };
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + duration + 0.01);
  }
  noise(at, duration, volume = 0.08) {
    if (!this.enabled || !this.context || document.hidden) return;
    const c = this.context,
      b = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate),
      a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++)
      a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3);
    const s = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter();
    s.buffer = b;
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    g.gain.value = volume;
    s.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    this.nodes.add(s);
    s.onended = () => {
      this.nodes.delete(s);
      s.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    s.start(c.currentTime + at);
  }
  play(game) {
    this.stop();
    if (game === "roulette") {
      for (let i = 0; i < 24; i++) {
        const t = 2.45 * Math.pow(i / 24, 1.6);
        this.noise(t, 0.045, 0.055 * (1 - i / 40));
        this.tone(800 - i * 12, t, 0.03, 0.025, "triangle");
      }
    } else {
      for (let i = 0; i < 6; i++) {
        this.noise(i * 0.26, 0.12, 0.14 * (1 - i / 8));
        this.tone(180 + i * 27, i * 0.26, 0.06, 0.045, "triangle");
      }
    }
  }
  result(win) {
    this.tone(win ? 523 : 220, 0, 0.14, 0.045);
    if (win) {
      this.tone(659, 0.12, 0.15, 0.04);
      this.tone(784, 0.24, 0.25, 0.04);
    }
  }
  stop() {
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes.clear();
  }
  close() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
