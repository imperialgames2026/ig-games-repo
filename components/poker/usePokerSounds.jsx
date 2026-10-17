// Poker sound effects using Web Audio API + synth sounds (no external files needed)
import { useCallback, useRef } from 'react';

function createAudioCtx() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)();
  } catch { return null; }
}

export function usePokerSounds() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = createAudioCtx();
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  // Generic tone helper
  const tone = useCallback((freq, type, duration, volume = 0.3, delay = 0) => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  }, []);

  // Chip click noise (white noise burst)
  const chipClick = useCallback((delay = 0) => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
  }, []);

  // Card dealing sound (short swish)
  const cardSwish = useCallback((delay = 0) => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.3));
      data[i] = (Math.random() * 2 - 1) * env * 0.4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(t);
  }, []);

  const sounds = {
    // Chip raking — multiple chip clicks cascading
    rakeChips: () => {
      for (let i = 0; i < 8; i++) chipClick(i * 0.04);
      for (let i = 0; i < 4; i++) chipClick(0.35 + i * 0.03);
    },

    // Card shuffle — rapid swishes
    shuffle: () => {
      for (let i = 0; i < 12; i++) cardSwish(i * 0.06);
    },

    // Deal cards
    deal: (numCards = 1) => {
      for (let i = 0; i < numCards; i++) cardSwish(i * 0.12);
    },

    // Crowd clap / cheer — layered rising noise
    crowd: () => {
      const ctx = getCtx();
      if (!ctx) return;
      for (let j = 0; j < 20; j++) {
        const t = ctx.currentTime + j * 0.02;
        const bufferSize = Math.floor(ctx.sampleRate * 0.15);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
      }
      // Rising cheer tone
      tone(300, 'sine', 1.5, 0.08, 0);
      tone(400, 'sine', 1.2, 0.06, 0.1);
      tone(500, 'sine', 1.0, 0.05, 0.2);
    },

    // "All In" announcement — dramatic low chord
    allIn: () => {
      tone(80, 'sawtooth', 0.8, 0.3, 0);
      tone(120, 'sawtooth', 0.8, 0.2, 0);
      tone(160, 'sine', 1.2, 0.15, 0.1);
      tone(240, 'sine', 0.8, 0.1, 0.2);
    },

    // Chip bet — single click
    bet: () => chipClick(0),

    // Fold — soft thud
    fold: () => {
      tone(200, 'sine', 0.15, 0.2, 0);
      cardSwish(0.05);
    },

    // Check — soft tap
    check: () => {
      tone(400, 'sine', 0.08, 0.15, 0);
      tone(350, 'sine', 0.08, 0.1, 0.05);
    },

    // Win fanfare
    win: () => {
      tone(523, 'sine', 0.15, 0.3, 0);
      tone(659, 'sine', 0.15, 0.3, 0.12);
      tone(784, 'sine', 0.2, 0.4, 0.24);
      tone(1046, 'sine', 0.25, 0.6, 0.36);
      sounds.rakeChips();
    },

    // Beer clink 🍺 — high metallic ping
    beerClink: () => {
      tone(1200, 'sine', 0.5, 0.4, 0);
      tone(1600, 'sine', 0.4, 0.3, 0.02);
      tone(900, 'sine', 0.3, 0.4, 0.04);
    },

    // Taunt — short descending whistle
    taunt: () => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    },

    // Silence / shush — soft descending hiss
    shush: () => {
      const ctx = getCtx();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = 1 - i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * env * 0.2;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 4000;
      source.connect(filter);
      filter.connect(ctx.destination);
      source.start();
    }
  };

  return sounds;
}