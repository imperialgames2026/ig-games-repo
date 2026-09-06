import { useRef, useCallback } from 'react';

// Web Audio API based slot sound engine — no external files needed
export default function useSlotSounds() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  // Reel spin — fast ticking mechanical sound
  const spinIntervalRef = useRef(null);
  const playSpinStart = useCallback(() => {
    try {
      const ctx = getCtx();
      let tick = 0;
      const maxTicks = 30;
      spinIntervalRef.current = setInterval(() => {
        if (tick >= maxTicks) { clearInterval(spinIntervalRef.current); return; }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const freq = 300 + Math.random() * 150;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.type = 'square';
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.04);
        tick++;
      }, 60);
    } catch (e) {}
  }, []);

  const stopSpin = useCallback(() => {
    clearInterval(spinIntervalRef.current);
  }, []);

  // Reel stop — thud per reel
  const playReelStop = useCallback((colIndex = 0) => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime + colIndex * 0.07;

      // Thud — low noise burst
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.08);
    } catch (e) {}
  }, []);

  // Small win jingle — ascending arpeggio
  const playWin = useCallback(() => {
    try {
      const ctx = getCtx();
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.0, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.18);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    } catch (e) {}
  }, []);

  // Big win fanfare — triumphant chords + coin cascade
  const playBigWin = useCallback(() => {
    try {
      const ctx = getCtx();
      // Chord burst
      const chords = [
        [523, 659, 784],   // C major
        [587, 740, 880],   // D major
        [659, 830, 988],   // E major
        [784, 988, 1174],  // G major
      ];
      chords.forEach((chord, ci) => {
        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          const t = ctx.currentTime + ci * 0.15;
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.0, t);
          gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.start(t);
          osc.stop(t + 0.3);
        });
      });

      // Coin cascade
      for (let i = 0; i < 12; i++) {
        const t = ctx.currentTime + 0.6 + i * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800 + Math.random() * 600, t);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.1);
      }
    } catch (e) {}
  }, []);

  // Bonus/free games triggered — dramatic ascending sweep
  const playBonus = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.7);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1);
    } catch (e) {}
  }, []);

  // Click / button press
  const playClick = useCallback(() => {
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    } catch (e) {}
  }, []);

  return { playSpinStart, stopSpin, playReelStop, playWin, playBigWin, playBonus, playClick };
}