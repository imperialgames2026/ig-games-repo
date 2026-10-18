import React, { useState, useRef, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const DIFFICULTIES = {
  easy:      { label: 'Easy',      winChance: 0.84, multiplierStep: 1.18, color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  medium:    { label: 'Medium',    winChance: 0.70, multiplierStep: 1.30, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  hard:      { label: 'Hard',      winChance: 0.55, multiplierStep: 1.40, color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  daredevil: { label: 'Daredevil', winChance: 0.34, multiplierStep: 1.75, color: 'bg-red-500/20 text-red-400 border-red-500/40' },
};

const ROCKET_BG = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/afc3fae45_crocket0.jpg';
const PLANET_STEP_PX = 144;

// Planet visuals matched to bc.game screenshots:
// ~1x: teal/green swirl, ~2x: orange/tan with ring, ~3x: blue-purple spotted, ~4x: purple-blue gradient, ~6x: orange sun, ~8x+: teal spotted
function getPlanetConfig(multiplier) {
  if (!multiplier || multiplier < 1.5) return {
    bg: 'radial-gradient(circle at 35% 35%, #5eead4, #0d9488 55%, #065f46)',
    glow: '#14b8a6',
    ring: false,
    spots: [{ c: '#2dd4bf', x: '60%', y: '25%', r: 18 }, { c: '#99f6e4', x: '30%', y: '65%', r: 10 }],
  };
  if (multiplier < 2.5) return {
    bg: 'radial-gradient(circle at 38% 32%, #fdba74, #f97316 50%, #c2410c)',
    glow: '#f97316',
    ring: true,
    spots: [{ c: '#fed7aa', x: '55%', y: '30%', r: 14 }, { c: '#fb923c', x: '25%', y: '60%', r: 8 }],
  };
  if (multiplier < 4) return {
    bg: 'radial-gradient(circle at 38% 32%, #93c5fd, #3b82f6 45%, #1e3a8a)',
    glow: '#60a5fa',
    ring: false,
    spots: [{ c: '#bfdbfe', x: '50%', y: '25%', r: 16 }, { c: '#1d4ed8', x: '65%', y: '60%', r: 10 }, { c: '#93c5fd', x: '25%', y: '55%', r: 8 }],
  };
  if (multiplier < 6) return {
    bg: 'radial-gradient(circle at 38% 38%, #c084fc, #7c3aed 50%, #4c1d95)',
    glow: '#a855f7',
    ring: false,
    spots: [{ c: '#e9d5ff', x: '55%', y: '28%', r: 14 }, { c: '#6d28d9', x: '30%', y: '62%', r: 9 }],
  };
  if (multiplier < 10) return {
    bg: 'radial-gradient(circle at 38% 35%, #fde68a, #f59e0b 45%, #b45309)',
    glow: '#f59e0b',
    ring: false,
    spots: [{ c: '#fef3c7', x: '52%', y: '28%', r: 18 }, { c: '#fbbf24', x: '25%', y: '58%', r: 10 }],
  };
  if (multiplier < 20) return {
    bg: 'radial-gradient(circle at 38% 35%, #5eead4, #0f766e 50%, #134e4a)',
    glow: '#2dd4bf',
    ring: false,
    spots: [{ c: '#99f6e4', x: '55%', y: '28%', r: 13 }, { c: '#0d9488', x: '30%', y: '65%', r: 8 }, { c: '#ccfbf1', x: '65%', y: '58%', r: 6 }],
  };
  return {
    bg: 'radial-gradient(circle at 38% 35%, #fef08a, #eab308 45%, #713f12)',
    glow: '#eab308',
    ring: false,
    spots: [{ c: '#fef9c3', x: '52%', y: '25%', r: 20 }, { c: '#ca8a04', x: '28%', y: '62%', r: 10 }],
  };
}

function Planet({ multiplier, size = 100, active = false, selected = false, reached = false, onClick }) {
  const cfg = getPlanetConfig(multiplier);
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center bg-transparent" style={{ gap: 4 }}>
      <div style={{ color: active || selected ? '#4ade80' : '#94a3b8', fontSize: 14, fontWeight: 900 }}>▼</div>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: cfg.bg,
        boxShadow: active || selected
          ? `0 0 24px 6px ${cfg.glow}88, 0 0 48px 12px ${cfg.glow}33`
          : `0 0 20px 4px ${cfg.glow}55, 0 0 40px 8px ${cfg.glow}18`,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        outline: selected ? '3px solid rgba(236,72,153,0.9)' : active ? '2px solid rgba(74,222,128,0.9)' : reached ? '2px solid rgba(255,255,255,0.18)' : '2px solid transparent',
        opacity: reached || active || selected ? 1 : 0.9,
      }}>
        {cfg.spots.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%',
            background: s.c, opacity: 0.35,
            width: s.r * 2, height: s.r * 2,
            left: `calc(${s.x} - ${s.r}px)`, top: `calc(${s.y} - ${s.r}px)`,
          }} />
        ))}
        {cfg.ring && (
          <div style={{
            position: 'absolute', top: '50%', left: '-20%',
            width: '140%', height: '18%',
            border: '3px solid rgba(255,255,255,0.25)',
            borderRadius: '50%', transform: 'translateY(-50%) rotateX(70deg)',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.16, textShadow: '0 1px 4px rgba(0,0,0,0.8)', zIndex: 2 }}>
            {multiplier ? multiplier.toFixed(2) + 'x' : '?'}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function StellarRushGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [difficulty, setDifficulty] = useState('hard');
  const [phase, setPhase] = useState('idle'); // idle | flying | crashed | won
  const [currentMult, setCurrentMult] = useState(1.00);
  const [targetMult, setTargetMult] = useState(null);
  const [nextMult, setNextMult] = useState(null);
  const [lockedMult, setLockedMult] = useState(null);
  const [history, setHistory] = useState([]);
  const [isFlying, setIsFlying] = useState(false);
  const [asteroidActive, setAsteroidActive] = useState(false);
  const [planetOffset, setPlanetOffset] = useState(0);
  const [roundLocked, setRoundLocked] = useState(false);
  const [mode, setMode] = useState('manual');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoTargetIndex, setAutoTargetIndex] = useState(2);
  const [moving, setMoving] = useState(false);
  const animRef = useRef(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const diff = DIFFICULTIES[difficulty];
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const calcNextTarget = (current) => {
    return Math.round(current * diff.multiplierStep * 100) / 100;
  };

  const planetRail = useMemo(() => {
    const items = [1];
    let current = 1;
    for (let i = 0; i < 11; i += 1) {
      current = calcNextTarget(current);
      items.push(current);
    }
    return items;
  }, [difficulty]);

  const previewTarget = targetMult || calcNextTarget(1.00);
  const previewNext = nextMult || calcNextTarget(calcNextTarget(1.00));
  const selectedAutoMult = planetRail[Math.max(1, Math.min(autoTargetIndex, planetRail.length - 1))];

  const startGame = async () => {
    if (betAmount > balance) return;
    triggerEffect('bet');
    await onBet(betAmount, 0, 'stellar-rush');
    const firstTarget = calcNextTarget(1.00);
    const secondTarget = calcNextTarget(firstTarget);
    setCurrentMult(1.00);
    setLockedMult(null);
    setRoundLocked(false);
    setTargetMult(firstTarget);
    setNextMult(secondTarget);
    setPlanetOffset(0);
    setIsFlying(true);
    setPhase('flying');
    animateFly(() => setIsFlying(false));
  };

  // Simulates flight duration (planets slide past), then calls onArrived
  const animateFly = (onArrived) => {
    clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      onArrived && onArrived();
    }, 1200);
  };

  const moveSpaces = async (steps = 1) => {
    if (roundLocked || moving || phase !== 'flying') return;
    setMoving(true);

    const response = await base44.functions.invoke('generateStellarRushOutcomeSSRCR', {
      bet_amount: betAmount,
      difficulty,
      current_multiplier: currentMult,
      steps,
      currency,
    });

    const data = response.data;
    const finalMove = data.moves[data.moves.length - 1];

    if (!data.survived) {
      triggerEffect('lose');
      setRoundLocked(true);
      setAsteroidActive(true);
      setTimeout(() => {
        setAsteroidActive(false);
        setPhase('crashed');
        setHistory(prev => [{ mult: finalMove?.target_multiplier || targetMult, won: false }, ...prev.slice(0, 7)]);
        setMoving(false);
      }, 900);
      return;
    }

    triggerEffect('action');
    const newCurrent = data.final_multiplier;
    const next = calcNextTarget(newCurrent);
    const afterNext = calcNextTarget(next);
    setLockedMult(newCurrent);
    setCurrentMult(newCurrent);
    setTargetMult(next);
    setNextMult(afterNext);
    setPlanetOffset(prev => prev + steps);
    setMoving(false);
  };

  const handleContinue = () => moveSpaces(1);
  const handleDoubleMove = () => moveSpaces(2);

  const handleCashOut = () => {
    if (!lockedMult || roundLocked || phase !== 'flying') return;
    triggerEffect('cashout');
    setRoundLocked(true);
    const cashMult = lockedMult;
    const winAmount = Math.round(betAmount * cashMult * 100) / 100;
    setPhase('won');
    setHistory(prev => [{ mult: cashMult, won: true }, ...prev.slice(0, 7)]);
    onBet(0, winAmount, 'stellar-rush');
  };

  const handleBet = async () => {
    await startGame();
  };

  const resetRound = () => {
    setPhase('idle');
    setLockedMult(null);
    setRoundLocked(false);
    setTargetMult(null);
    setNextMult(null);
    setCurrentMult(1);
    setPlanetOffset(0);
    setAutoRunning(false);
  };

  const handleAutoRun = async () => {
    if (autoRunning || betAmount > balance) return;
    setAutoRunning(true);

    const firstTarget = calcNextTarget(1.0);
    const secondTarget = calcNextTarget(firstTarget);
    await onBet(betAmount, 0, 'stellar-rush');
    setCurrentMult(1.0);
    setLockedMult(null);
    setRoundLocked(false);
    setTargetMult(firstTarget);
    setNextMult(secondTarget);
    setPlanetOffset(0);
    setIsFlying(true);
    setPhase('flying');
    animateFly(() => setIsFlying(false));

    let current = firstTarget;
    for (let step = 1; step < autoTargetIndex; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const response = await base44.functions.invoke('generateStellarRushOutcomeSSRCR', {
        bet_amount: betAmount,
        difficulty,
        current_multiplier: current,
        steps: 1,
        currency,
      });
      const data = response.data;
      const finalMove = data.moves[data.moves.length - 1];

      if (!data.survived) {
        triggerEffect('lose');
        setRoundLocked(true);
        setAsteroidActive(true);
        setTimeout(() => {
          setAsteroidActive(false);
          setPhase('crashed');
          setHistory(prev => [{ mult: finalMove?.target_multiplier || current, won: false }, ...prev.slice(0, 7)]);
        }, 900);
        setAutoRunning(false);
        return;
      }

      triggerEffect('action');
      current = data.final_multiplier;
      const next = calcNextTarget(current);
      const afterNext = calcNextTarget(next);
      setLockedMult(current);
      setCurrentMult(current);
      setTargetMult(next);
      setNextMult(afterNext);
      setPlanetOffset(prev => prev + 1);
    }

    await new Promise((resolve) => setTimeout(resolve, 1400));
    triggerEffect('cashout');
    setRoundLocked(true);
    const winAmount = Math.round(betAmount * current * 100) / 100;
    setLockedMult(current);
    setPhase('won');
    setHistory(prev => [{ mult: current, won: true }, ...prev.slice(0, 7)]);
    onBet(0, winAmount, 'stellar-rush');
    setAutoRunning(false);
  };

  useEffect(() => () => clearInterval(animRef.current), []);

  const isActive = phase === 'flying';

  return (
    <div className="max-w-lg mx-auto">
      <div className={`bg-[#1c1c2e] rounded-2xl overflow-hidden transition-all duration-300 ${effectClassName}`}>
        {/* History Bar */}
        <div className="flex gap-2 px-4 py-2 bg-[#111122] overflow-x-auto min-h-[40px] items-center">
          {history.length === 0
            ? <span className="text-gray-600 text-xs">No history yet</span>
            : history.map((h, i) => (
              <span key={i} className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${h.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {h.mult.toFixed(2)}x
              </span>
            ))
          }
        </div>

        {/* Game Arena */}
        <div className="relative overflow-hidden" style={{ height: 280 }}>
          {/* Background image fills entire arena */}
          <img
            src={ROCKET_BG}
            alt="rocket cat"
            className="absolute inset-0 w-full h-full object-cover object-left"
            style={{ zIndex: 0 }}
          />
          {/* Dark overlay on right side to help planets stand out */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, transparent 30%, rgba(0,0,0,0.45) 100%)', zIndex: 1 }} />

          {/* Asteroid */}
          <AnimatePresence>
            {asteroidActive && (
              <motion.div
                className="absolute z-20 text-4xl"
                style={{ left: '45%' }}
                initial={{ top: '-10%', rotate: -30 }}
                animate={{ top: '45%', rotate: 45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeIn' }}
              >
                ☄️
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="absolute flex items-end gap-16"
            style={{ zIndex: 2, bottom: 18, left: '38%' }}
            animate={{ x: -planetOffset * PLANET_STEP_PX }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
          >
            {planetRail.map((mult, index) => (
              <Planet
                key={`${difficulty}-${index}-${mult}`}
                multiplier={mult}
                size={index === planetOffset + 2 ? 70 : 80}
                active={index === planetOffset}
                reached={index < planetOffset}
              />
            ))}
          </motion.div>

          {/* Lockedmult badge floating above the current planet */}
          <AnimatePresence>
            {lockedMult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute px-2 py-1 bg-black/80 border border-green-500/40 rounded-lg text-green-400 text-xs font-bold"
                style={{ zIndex: 3, bottom: 108, left: 'calc(38% + 18px)' }}
              >
                {lockedMult.toFixed(2)}x ✓
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result overlay */}
          <AnimatePresence>
            {phase === 'crashed' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-red-900/60 flex items-center justify-center z-10">
                <div className="text-red-200 font-black text-3xl drop-shadow-lg">💥 CRASHED!</div>
              </motion.div>
            )}
            {phase === 'won' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-green-900/40 flex items-center justify-center z-10">
                <div className="text-green-200 font-black text-3xl drop-shadow-lg">🎉 {(betAmount * (lockedMult || 1)).toFixed(2)} {currency}!</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-5 space-y-4">
          {/* Amount */}
          <div className="space-y-1">
            <label className="text-gray-400 text-sm">Amount</label>
            <div className="flex items-center gap-2 bg-[#111122] border border-white/10 rounded-lg px-3 py-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
                className="bg-transparent text-white font-mono flex-1 outline-none text-sm"
                disabled={isActive}
              />
              <button onClick={() => setBetAmount(prev => Math.max(0.01, Math.round(prev / 2 * 100) / 100))} disabled={isActive} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-50">1/2</button>
              <button onClick={() => setBetAmount(prev => Math.min(balance, Math.round(prev * 2 * 100) / 100))} disabled={isActive} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-50">2x</button>
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-gray-400 text-sm">Difficulty</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(DIFFICULTIES).map(([key, d]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  disabled={isActive}
                  className={`py-2 rounded-lg text-sm font-bold border transition-all disabled:opacity-50 ${
                    difficulty === key
                      ? d.color + ' ring-1 ring-white/30'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] bg-[#111122] p-1 flex">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 h-11 rounded-[22px] font-bold text-sm ${mode === 'manual' ? 'bg-[#EC4899] text-white' : 'text-white/70'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('auto')}
              className={`flex-1 h-11 rounded-[22px] font-bold text-sm ${mode === 'auto' ? 'bg-[#EC4899] text-white' : 'text-white/70'}`}
            >
              Auto
            </button>
          </div>

          {!isActive && mode === 'auto' && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#111122] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Auto target</span>
                <span className="text-pink-400 font-bold">{selectedAutoMult.toFixed(2)}x</span>
              </div>
              <div className="overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex gap-4 min-w-max pr-4">
                  {planetRail.map((mult, index) => (
                    <Planet
                      key={`${difficulty}-${mult}`}
                      multiplier={mult}
                      size={index === 0 ? 58 : 64}
                      selected={index === autoTargetIndex}
                      reached={index < autoTargetIndex}
                      onClick={() => index > 0 && setAutoTargetIndex(index)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isActive ? (
            <Button
              onClick={async () => {
                resetRound();
                if (mode === 'auto') {
                  await handleAutoRun();
                } else {
                  await handleBet();
                }
              }}
              disabled={betAmount > balance || autoRunning}
              className="w-full h-14 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl disabled:opacity-50"
            >
              {autoRunning ? 'Running...' : 'Bet'}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleContinue}
                  disabled={roundLocked || moving || mode === 'auto'}
                  className="h-12 text-base font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl disabled:opacity-40"
                >
                  move1
                </Button>
                <Button
                  onClick={handleDoubleMove}
                  disabled={roundLocked || moving || mode === 'auto'}
                  className="h-12 text-base font-bold bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-xl disabled:opacity-40"
                >
                  move2
                </Button>
              </div>
              <Button
                onClick={handleCashOut}
                disabled={!lockedMult || roundLocked}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl disabled:opacity-40"
              >
                Cash Out {lockedMult ? `${(betAmount * lockedMult).toFixed(2)} ${currency}` : '(reach a planet first)'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}