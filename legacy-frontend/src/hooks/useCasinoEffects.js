import { useCallback, useRef, useState } from 'react';

function createTone(context, frequency, type, duration, volume, startTime) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export default function useCasinoEffects() {
  const audioRef = useRef(null);
  const [flash, setFlash] = useState(null);

  const getAudioContext = useCallback(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioRef.current) audioRef.current = new AudioCtx();
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }, []);

  const pulse = useCallback((type) => {
    setFlash(type);
    window.setTimeout(() => setFlash(null), 380);
  }, []);

  const playSound = useCallback((type) => {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;

    if (type === 'bet') {
      createTone(context, 180, 'square', 0.08, 0.03, now);
      createTone(context, 220, 'square', 0.08, 0.02, now + 0.05);
    }

    if (type === 'action') {
      createTone(context, 320, 'triangle', 0.06, 0.035, now);
      createTone(context, 420, 'triangle', 0.08, 0.025, now + 0.04);
    }

    if (type === 'tick') {
      createTone(context, 520, 'sine', 0.04, 0.018, now);
    }

    if (type === 'win') {
      createTone(context, 440, 'triangle', 0.12, 0.04, now);
      createTone(context, 660, 'triangle', 0.16, 0.035, now + 0.08);
      createTone(context, 880, 'triangle', 0.2, 0.03, now + 0.16);
    }

    if (type === 'lose') {
      createTone(context, 240, 'sawtooth', 0.12, 0.03, now);
      createTone(context, 180, 'sawtooth', 0.18, 0.025, now + 0.08);
    }

    if (type === 'cashout') {
      createTone(context, 540, 'triangle', 0.08, 0.035, now);
      createTone(context, 740, 'triangle', 0.12, 0.03, now + 0.05);
      createTone(context, 980, 'triangle', 0.16, 0.028, now + 0.1);
    }
  }, [getAudioContext]);

  const triggerEffect = useCallback((type) => {
    playSound(type);
    if (type === 'win' || type === 'cashout') pulse('win');
    if (type === 'lose') pulse('lose');
    if (type === 'action' || type === 'bet') pulse('action');
  }, [playSound, pulse]);

  const effectClassName = flash === 'win'
    ? 'ring-2 ring-green-400/70 shadow-[0_0_35px_rgba(74,222,128,0.35)]'
    : flash === 'lose'
    ? 'ring-2 ring-red-400/70 shadow-[0_0_35px_rgba(248,113,113,0.3)]'
    : flash === 'action'
    ? 'ring-2 ring-pink-400/60 shadow-[0_0_30px_rgba(236,72,153,0.28)]'
    : '';

  return { triggerEffect, effectClassName, flash };
}