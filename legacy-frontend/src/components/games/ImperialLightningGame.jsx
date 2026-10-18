import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROWS = 3;
const REELS = 3;

// Prize values a LIGHTNING PRIZE orb can carry
const PRIZE_VALUES = [1, 2, 3, 5, 7, 10, 15, 25, 50, 150, 1000];
const JACKPOTS = [
  { label: 'GRAND', mult: 1000, color: '#e11d48', glow: '#fb7185' },
  { label: 'MAJOR', mult: 150,  color: '#7c3aed', glow: '#c084fc' },
  { label: 'MINOR', mult: 50,   color: '#059669', glow: '#34d399' },
  { label: 'MINI',  mult: 25,   color: '#0284c7', glow: '#38bdf8' },
];

// Symbol types
const SYM_BLANK  = 'blank';
const SYM_PRIZE  = 'prize';   // blue orb — reels 0 & 2
const SYM_ORB    = 'orb';     // pink orb — reel 1 only

// Col 0 & Col 2: mix of PRIZE orbs (carry values) + decorative ORBs (no value, just eye candy)
// Col 1 (middle): ONLY ORBs — sparse because landing one triggers Hold & Win bonus
// Hold & Win fires when col0 has ≥1 PRIZE + col1 has ≥1 ORB + col2 has ≥1 PRIZE (~2% of spins)
const REEL_POOLS = [
  // Col 0 (left):  lots of visible orbs — PRIZE carry values, extra ORBs are eye candy only
  [...Array(30).fill(SYM_BLANK), ...Array(12).fill(SYM_PRIZE), ...Array(8).fill(SYM_ORB)],
  // Col 1 (middle): SPARSE — only 4 orbs in 80 so bonus triggers ~15% column hit rate
  [...Array(76).fill(SYM_BLANK), ...Array(4).fill(SYM_ORB)],
  // Col 2 (right):  lots of visible orbs — PRIZE carry values, extra ORBs are eye candy only
  [...Array(30).fill(SYM_BLANK), ...Array(12).fill(SYM_PRIZE), ...Array(8).fill(SYM_ORB)],
];

function randPrizeValue() {
  // weighted: small values more common
  const w = [30,20,15,12,8,6,4,2,1,1,1];
  const total = w.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return PRIZE_VALUES[i]; }
  return PRIZE_VALUES[0];
}

function spinReels() {
  return Array.from({ length: REELS }, (_, col) =>
    Array.from({ length: ROWS }, () => {
      const pool = REEL_POOLS[col];
      const sym = pool[Math.floor(Math.random() * pool.length)];
      // Col 0 & 2 orbs count as PRIZE (carry a value, collected in Hold & Win)
      // Col 1 orbs also carry a value — they pay out directly whenever they land
      const value = (sym === SYM_PRIZE || sym === SYM_ORB) ? randPrizeValue() : null;
      const type = (sym === SYM_ORB && col !== 1) ? SYM_PRIZE : sym;
      return { type, value };
    })
  );
}

// ─── Orb Components ──────────────────────────────────────────────────────────

// Draws orbiting lightning bolts around a plasma orb using SVG + CSS animation
function PlasmaOrb({ size = 70, pulse = false, color = 'blue', value = null }) {
  const isPurple = color === 'purple';
  const coreColor1 = isPurple ? '#f0e6ff' : '#e0f2fe';
  const coreColor2 = isPurple ? '#c084fc' : '#60a5fa';
  const coreColor3 = isPurple ? '#7c3aed' : '#1e40af';
  const glowColor  = isPurple ? '#c084fc' : '#60a5fa';
  const boltColor  = isPurple ? '#e879f9' : '#bfdbfe';

  // Generate a jagged SVG lightning bolt path along a circle
  const orbitPath = (radius, offset, segments = 8) => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2 + offset;
      const r = radius + (i % 2 === 0 ? 4 : -4);
      pts.push(`${50 + Math.cos(angle) * r}% ${50 + Math.sin(angle) * r}%`);
    }
    return 'polygon(' + pts.join(', ') + ')';
  };

  // unused id removed

  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {/* Outer glow ring */}
      <motion.div
        animate={pulse
          ? { scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }
          : { scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ repeat: Infinity, duration: pulse ? 0.65 : 2 }}
        style={{
          position: 'absolute', inset: -size * 0.18,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor}44 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Core plasma ball */}
      <motion.div
        animate={pulse
          ? { scale: [1, 1.12, 1] }
          : { scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: pulse ? 0.65 : 1.8 }}
        style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `radial-gradient(circle at 38% 30%, ${coreColor1} 0%, ${coreColor2} 40%, ${coreColor3} 75%, #000 100%)`,
          boxShadow: `0 0 ${size * 0.22}px ${size * 0.08}px ${glowColor}99, 0 0 ${size * 0.5}px ${size * 0.15}px ${glowColor}33`,
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Inner plasma swirl */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
          style={{
            position: 'absolute', inset: '10%', borderRadius: '50%',
            background: `conic-gradient(from 0deg, transparent 0%, ${boltColor}66 30%, transparent 50%, ${boltColor}44 70%, transparent 100%)`,
            opacity: 0.6,
          }}
        />
        {/* Second swirl opposite */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
          style={{
            position: 'absolute', inset: '20%', borderRadius: '50%',
            background: `conic-gradient(from 90deg, transparent 0%, ${glowColor}88 25%, transparent 55%, ${glowColor}55 80%, transparent 100%)`,
            opacity: 0.7,
          }}
        />
        {/* Highlight glare */}
        <div style={{
          position: 'absolute', top: '10%', left: '15%',
          width: '35%', height: '30%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 80%)',
          opacity: 0.6,
        }} />
      </motion.div>

      {/* Orbiting bolt rings */}
      {[0, 1, 2].map((idx) => (
        <motion.div
          key={idx}
          animate={{ rotate: idx % 2 === 0 ? 360 : -360 }}
          transition={{ repeat: Infinity, duration: 1.2 + idx * 0.4, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: -size * 0.06,
            borderRadius: '50%',
            border: `${size * 0.025}px solid transparent`,
            borderTopColor: boltColor,
            borderRightColor: idx === 1 ? boltColor : 'transparent',
            boxShadow: `0 0 ${size * 0.1}px ${boltColor}99`,
            opacity: 0.75 - idx * 0.15,
          }}
        />
      ))}

      {/* Bolt sparks orbiting */}
      {[0, 120, 240].map((deg, idx) => (
        <motion.div
          key={`spark-${idx}`}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.4 + idx * 0.3, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <div style={{
            position: 'absolute',
            top: '2%', left: '46%',
            fontSize: size * 0.18,
            transform: `rotate(${deg}deg) translateX(${size * 0.44}px)`,
            color: boltColor,
            textShadow: `0 0 6px ${glowColor}, 0 0 12px ${glowColor}`,
            lineHeight: 1,
            opacity: 0.9,
          }}>⚡</div>
        </motion.div>
      ))}

      {/* Value text (for prize orb) */}
      {value !== null && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{
            color: isPurple ? '#fde68a' : '#fef08a',
            fontWeight: 900,
            fontSize: size * 0.21,
            textShadow: '0 0 10px #000, 0 0 20px rgba(0,0,0,0.9), 0 1px 4px #000',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {value}x
          </span>
        </div>
      )}
    </div>
  );
}

function LightningPrize({ value, size = 70, pulse = false }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <motion.img
        src="https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/1d856bfb0_generated_image.png"
        alt="Lightning prize orb"
        animate={pulse ? { scale: [1, 1.08, 1] } : { scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: pulse ? 0.65 : 1.8 }}
        style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(96,165,250,0.8))' }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, pointerEvents: 'none' }}>
        <span style={{ color: '#fef08a', fontWeight: 900, fontSize: size * 0.21, textShadow: '0 0 10px #000, 0 0 20px rgba(0,0,0,0.9), 0 1px 4px #000', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}x
        </span>
      </div>
    </div>
  );
}

function LightningOrb({ size = 70, pulse = false }) {
  return (
    <motion.img
      src="https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/a51ea233f_generated_image.png"
      alt="Lightning orb"
      animate={pulse ? { scale: [1, 1.08, 1] } : { scale: [1, 1.03, 1] }}
      transition={{ repeat: Infinity, duration: pulse ? 0.65 : 1.8 }}
      style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(96,165,250,0.8))' }}
    />
  );
}

// Big bolt that flashes across the screen during a spin
function BigLightningBolt({ active }) {
  const [bolts, setBolts] = React.useState([]);

  React.useEffect(() => {
    if (!active) { setBolts([]); return; }
    const fire = () => {
      const id = Date.now();
      const fromTop = Math.random() > 0.5;
      setBolts(prev => [...prev, { id, fromTop, angle: (Math.random() * 30 - 15) }]);
      setTimeout(() => setBolts(prev => prev.filter(b => b.id !== id)), 500);
    };
    fire();
    const t1 = setTimeout(fire, 600);
    const t2 = setTimeout(fire, 1300);
    const t3 = setTimeout(fire, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <AnimatePresence>
      {bolts.map(bolt => (
        <motion.div
          key={bolt.id}
          initial={{ opacity: 0, scaleX: 0, x: '-50%' }}
          animate={{ opacity: [0, 1, 1, 0], scaleX: [0, 1, 1, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: bolt.fromTop ? '20%' : '60%',
            left: 0, right: 0,
            height: 3,
            zIndex: 50,
            transformOrigin: 'left center',
            transform: `rotate(${bolt.angle}deg)`,
            background: 'linear-gradient(90deg, transparent 0%, #a5f3fc 15%, #ffffff 40%, #facc15 60%, #c084fc 80%, transparent 100%)',
            boxShadow: '0 0 8px 3px #fff, 0 0 20px 6px #60a5fa, 0 0 40px 10px #7c3aed44',
            pointerEvents: 'none',
          }}
        />
      ))}
    </AnimatePresence>
  );
}

function JackpotBadge({ jp }) {
  return (
    <div style={{
      padding: '3px 10px', borderRadius: 999,
      background: `radial-gradient(circle, ${jp.color}cc, ${jp.color})`,
      boxShadow: `0 0 12px 3px ${jp.glow}66`,
      color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: 1,
      border: `1px solid ${jp.glow}`,
    }}>
      {jp.label} <span style={{ opacity: 0.8 }}>{jp.mult}x</span>
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function ImperialLightningGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [phase, setPhase] = useState('idle'); // idle | spinning | hold_win | result
  const [grid, setGrid] = useState(() => spinReels());
  const [spinning, setSpinning] = useState(false);
  const [holdGrid, setHoldGrid] = useState(null); // 3×3 array of locked cells
  const [respins, setRespins] = useState(3);
  const [holdPhase, setHoldPhase] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [lastWin, setLastWin] = useState(null);
  const [history, setHistory] = useState([]);
  const [vortexActive, setVortexActive] = useState(false);
  const [blitzActive, setBlitzActive] = useState(false);
  const [highlightCells, setHighlightCells] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [spinningCols, setSpinningCols] = useState([false, false, false]);
  const animRef = useRef(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);

  const resetGame = () => {
    setPhase('idle');
    setHoldPhase(false);
    setHoldGrid(null);
    setWinAmount(0);
    setLastWin(null);
    setHighlightCells([]);
    setShowResult(false);
    setVortexActive(false);
    setBlitzActive(false);
    setSpinning(false);
  };

  const doSpin = async () => {
    if (betAmount > balance || spinning) return;
    resetGame();
    await onBet(betAmount, 0, 'imperial-lightning');

    // Animate reels sequentially
    setSpinning(true);
    setSpinningCols([true, true, true]);

    // Generate final result upfront
    let result = spinReels();

    // Check for Vortex Surge (random 2% chance)
    let vortex = false;
    if (Math.random() < 0.02) {
      vortex = true;
      setVortexActive(true);
      // inject extra prize symbols to guarantee hold & win trigger
      result = injectVortexSymbols(result);
    }

    // Stop reels one by one
    for (let col = 0; col < REELS; col++) {
      await delay(400 + col * 200);
      setSpinningCols(prev => { const n = [...prev]; n[col] = false; return n; });
      setGrid(prev => {
        const ng = prev.map(r => [...r]);
        for (let row = 0; row < ROWS; row++) ng[col][row] = result[col][row];
        return ng;
      });
    }

    await delay(300);
    if (vortex) setVortexActive(false);
    setSpinning(false);
    setGrid(result);
    evaluateResult(result, betAmount);
  };

  function injectVortexSymbols(grid) {
    const ng = grid.map(r => r.map(c => ({ ...c })));
    // ensure at least one ORB on reel 1 and one PRIZE on reel 0 and 2
    let orbPlaced = false;
    for (let row = 0; row < ROWS; row++) {
      if (ng[1][row].type === SYM_ORB) { orbPlaced = true; break; }
    }
    if (!orbPlaced) ng[1][Math.floor(Math.random() * ROWS)] = { type: SYM_ORB, value: null };

    let prizePlaced0 = ng[0].some(c => c.type === SYM_PRIZE);
    if (!prizePlaced0) ng[0][Math.floor(Math.random() * ROWS)] = { type: SYM_PRIZE, value: randPrizeValue() };

    let prizePlaced2 = ng[2].some(c => c.type === SYM_PRIZE);
    if (!prizePlaced2) ng[2][Math.floor(Math.random() * ROWS)] = { type: SYM_PRIZE, value: randPrizeValue() };

    return ng;
  }

  function evaluateResult(result, bet) {
    const orbOnCol0 = result[0].some(c => c.type === SYM_PRIZE);
    const orbOnCol1 = result[1].some(c => c.type === SYM_ORB);
    const orbOnCol2 = result[2].some(c => c.type === SYM_PRIZE);

    // Hold & Win bonus: must have an orb in ALL THREE columns
    const holdWin = orbOnCol0 && orbOnCol1 && orbOnCol2;

    // Col 1 ORB alone does nothing — must pair with at least col 0 or col 2
    const paysOut = orbOnCol1 && (orbOnCol0 || orbOnCol2);

    if (holdWin) {
      setTimeout(() => startHoldWin(result, bet, false), 600);
    } else if (paysOut) {
      // Pay col 0 + col 1 + col 2 values (only sides that have orbs)
      let total = 0;
      result[0].forEach(cell => { if (cell.type === SYM_PRIZE && cell.value) total += cell.value; });
      result[1].forEach(cell => { if (cell.type === SYM_ORB && cell.value) total += cell.value; });
      result[2].forEach(cell => { if (cell.type === SYM_PRIZE && cell.value) total += cell.value; });
      const win = Math.round(total * bet * 100) / 100;
      setBlitzActive(true);
      setTimeout(() => {
        setBlitzActive(false);
        finalizeWin(win, bet, result);
      }, 1200);
    } else {
      finalizeWin(0, bet, result);
    }
  }

  function startHoldWin(result, bet, blitz) {
    // Build hold grid from current result — locked cells keep prize/orb, rest are empty
    const hg = result.map(col => col.map(cell =>
      (cell.type === SYM_PRIZE || cell.type === SYM_ORB)
        ? { ...cell, locked: true }
        : { type: SYM_BLANK, value: null, locked: false }
    ));
    setHoldGrid(hg);
    setRespins(3);
    setHoldPhase(true);
    setPhase('hold_win');
    runRespins(hg, 3, bet, blitz);
  }

  async function runRespins(currentHG, remaining, bet, blitz) {
    if (remaining <= 0) {
      finishHoldWin(currentHG, bet, blitz);
      return;
    }

    await delay(900);
    // Spin only unlocked cells
    const newHG = currentHG.map((col, ci) => col.map((cell, ri) => {
      if (cell.locked) return cell;
      const pool = REEL_POOLS[ci];
      const sym = pool[Math.floor(Math.random() * pool.length)];
      const val = sym === SYM_PRIZE ? randPrizeValue() : null;
      return { type: sym, value: val, locked: false };
    }));

    // Lock any newly landed prize/orb cells and reset respins
    let anyNew = false;
    const lockedHG = newHG.map(col => col.map(cell => {
      if (!cell.locked && (cell.type === SYM_PRIZE || cell.type === SYM_ORB)) {
        anyNew = true;
        return { ...cell, locked: true };
      }
      return cell;
    }));

    setHoldGrid(lockedHG);
    const nextRespins = anyNew ? 3 : remaining - 1;
    setRespins(nextRespins);

    runRespins(lockedHG, nextRespins, bet, blitz);
  }

  function finishHoldWin(hg, bet, blitz) {
    let total = 0;
    const lockedCount = hg.flat().filter(c => c.locked && c.type === SYM_PRIZE).length;

    // Sum all prize values
    hg.forEach(col => col.forEach(cell => {
      if (cell.locked && cell.type === SYM_PRIZE) total += cell.value;
    }));

    // Jackpot for full board (9 locked cells)
    if (lockedCount >= 9) total = Math.max(total, 1000);

    // Grand jackpot
    const hasGrand = hg.flat().some(c => c.value === 1000);
    if (hasGrand) total = Math.max(total, 1000);

    // If blitz: collect ORB values too
    if (blitz) {
      // already collected via prize values; bonus multiplier x1.5
      total = Math.round(total * 1.5);
    }

    const win = Math.round(total * bet * 100) / 100;
    setHoldPhase(false);
    finalizeWin(win, bet, null);
  }

  function finalizeWin(win, bet, finalGrid) {
    setWinAmount(win);
    setLastWin(win);
    setShowResult(true);
    setHistory(prev => [{ win, bet }, ...prev.slice(0, 7)]);
    if (win > 0) onBet(0, win, 'imperial-lightning');
    setPhase('result');
  }

  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  const isActive = spinning || holdPhase;
  const currentGrid = holdPhase ? holdGrid : grid;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto select-none">
      <div className="bg-[#080818] rounded-2xl overflow-hidden border border-purple-900/40">

        {/* Header */}
        <div className="relative bg-gradient-to-b from-[#0d0028] to-[#080818] pt-4 pb-2 px-4 text-center overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div key={i}
                className="absolute w-px bg-gradient-to-b from-transparent via-purple-400 to-transparent"
                style={{ left: `${8 + i * 8}%`, height: '100%', opacity: 0.15 }}
                animate={{ opacity: [0.05, 0.2, 0.05] }}
                transition={{ repeat: Infinity, duration: 1.5 + i * 0.3, delay: i * 0.2 }}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="text-white font-black text-lg tracking-widest" style={{
              textShadow: '0 0 20px #a855f7, 0 0 40px #7c3aed'
            }}>IMPERIAL RAPID LIGHTNING</span>
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>

          {/* Jackpot display */}
          <div className="flex justify-center gap-2 flex-wrap mt-1 mb-2">
            {JACKPOTS.map(jp => <JackpotBadge key={jp.label} jp={jp} />)}
          </div>
        </div>

        {/* History Bar */}
        <div className="flex gap-2 px-4 py-2 bg-black/40 overflow-x-auto min-h-[36px] items-center">
          {history.length === 0
            ? <span className="text-gray-600 text-xs">No history yet</span>
            : history.map((h, i) => (
              <span key={i} className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${h.win > 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'}`}>
                {h.win > 0 ? `+${h.win.toFixed(1)}` : '—'}
              </span>
            ))
          }
        </div>

        {/* Reel Grid */}
        <div className="relative px-4 pt-5 pb-3">
          {/* Background glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 bg-purple-700/10 rounded-full blur-3xl" />
          </div>

          {/* Big lightning bolt flash */}
          <BigLightningBolt active={spinning} />

          {/* Vortex Surge overlay */}
          <AnimatePresence>
            {vortexActive && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex items-center justify-center rounded-xl"
                style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-5xl"
                >⚡</motion.div>
                <div className="absolute bottom-4 text-purple-300 font-black text-sm tracking-widest">VORTEX SURGE!</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voltage Blitz overlay */}
          <AnimatePresence>
            {blitzActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-xl"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)' }}
              >
                <div className="text-blue-200 font-black text-2xl tracking-widest drop-shadow-lg">⚡ VOLTAGE BLITZ! ⚡</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3×3 Grid */}
          <div className="relative z-10 grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {Array.from({ length: REELS }, (_, col) =>
              Array.from({ length: ROWS }, (_, row) => {
                const cell = currentGrid?.[col]?.[row];
                const key = `${col}-${row}`;
                const isSpinningCol = spinningCols[col];
                const isLocked = holdPhase && cell?.locked;
                return (
                  <motion.div
                    key={key}
                    animate={isLocked ? { boxShadow: ['0 0 0px #a855f7', '0 0 16px #a855f7', '0 0 0px #a855f7'] } : {}}
                    transition={{ repeat: Infinity, duration: 1 }}
                    style={{
                      background: isLocked
                        ? 'linear-gradient(135deg, #1e0a3c, #2d1060)'
                        : 'linear-gradient(135deg, #0f0828, #1a0a30)',
                      borderRadius: 12,
                      border: isLocked ? '1px solid #a855f788' : '1px solid rgba(255,255,255,0.05)',
                      height: 90,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative',
                    }}
                  >
                    {/* Spinning blur effect */}
                    {isSpinningCol && (
                      <motion.div
                        animate={{ y: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 0.15, ease: 'linear' }}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-40"
                      >
                        <LightningPrize value={randPrizeValue()} size={50} />
                      </motion.div>
                    )}

                    {/* Static cell */}
                    {!isSpinningCol && (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${col}-${row}-${cell?.type}-${cell?.value}`}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                          className="flex items-center justify-center"
                        >
                          {cell?.type === SYM_PRIZE && (
                            <LightningPrize value={cell.value} size={64} pulse={isLocked} />
                          )}
                          {cell?.type === SYM_ORB && (
                            <LightningOrb size={64} pulse={isLocked} />
                          )}
                          {cell?.type === SYM_BLANK && (
                            <div style={{ width: 64, height: 64, opacity: 0.08, borderRadius: '50%', background: '#fff' }} />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    )}

                    {/* Locked badge */}
                    {isLocked && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                        <span style={{ fontSize: 8, color: '#fff' }}>🔒</span>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Reel labels */}
          <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {['PRIZE', 'ORB', 'PRIZE'].map((l, i) => (
              <div key={i} className="text-center text-xs font-bold text-purple-400/50 tracking-widest">{l}</div>
            ))}
          </div>

          {/* Hold & Win Respins counter */}
          <AnimatePresence>
            {holdPhase && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 flex items-center justify-center gap-3"
              >
                <div className="px-4 py-2 rounded-xl bg-purple-900/40 border border-purple-500/40">
                  <span className="text-purple-200 text-sm font-bold">HOLD & WIN — </span>
                  <span className="text-yellow-300 font-black text-lg">{respins}</span>
                  <span className="text-purple-200 text-sm font-bold"> RESPINS</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Win Result */}
        <AnimatePresence>
          {showResult && lastWin !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mx-4 mb-3 py-3 rounded-xl text-center"
              style={{
                background: lastWin > 0
                  ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2))'
                  : 'rgba(255,255,255,0.04)',
                border: lastWin > 0 ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {lastWin > 0 ? (
                <>
                  <div className="text-xs text-purple-300 font-bold tracking-widest mb-1">⚡ YOU WON ⚡</div>
                  <div className="text-3xl font-black text-white">
                    +{lastWin.toFixed(2)} <span className="text-purple-300 text-xl">{currency}</span>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 font-bold text-sm">No win this round</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="p-4 space-y-3">
          {/* Bet Amount */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
            <span className="text-gray-400 text-sm shrink-0">Bet</span>
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
              className="bg-transparent text-white font-mono flex-1 outline-none text-sm min-w-0"
              disabled={isActive}
            />
            <button onClick={() => setBetAmount(p => Math.max(0.01, Math.round(p / 2 * 100) / 100))} disabled={isActive}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-40">½</button>
            <button onClick={() => setBetAmount(p => Math.min(balance, Math.round(p * 2 * 100) / 100))} disabled={isActive}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-40">2×</button>
          </div>

          {/* Quick bets */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 25].map(v => (
              <button key={v} onClick={() => setBetAmount(Math.min(balance, v))} disabled={isActive}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40 ${
                  betAmount === v
                    ? 'bg-purple-600/30 border-purple-500/60 text-purple-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}>
                {v}
              </button>
            ))}
          </div>

          <Button
            onClick={doSpin}
            disabled={isActive || betAmount > balance}
            className="w-full h-14 text-lg font-black text-white rounded-xl disabled:opacity-50"
            style={{ background: isActive ? '#1a0a30' : 'linear-gradient(135deg, #4f46e5, #7c3aed, #a855f7)' }}
          >
            {holdPhase ? (
              <span className="flex items-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.5 }}>⚡</motion.span>
                Respin in progress...
              </span>
            ) : spinning ? (
              <span className="flex items-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.4 }}>⚡</motion.span>
                Spinning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5" /> SPIN
              </span>
            )}
          </Button>
        </div>

        {/* Info strip */}
        <div className="px-4 pb-4 text-center text-xs text-gray-600 space-y-0.5">
          <div>PRIZE on col 1 + ORB on col 2 + PRIZE on col 3 → Hold & Win feature</div>
          <div>RTP 96.31% · Medium Volatility</div>
        </div>
      </div>
    </div>
  );
}