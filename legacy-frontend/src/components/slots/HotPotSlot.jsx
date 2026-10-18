import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Zap, RotateCcw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

// Symbols — payouts match official paytable (5x/4x/3x multipliers × bet)
const SYMBOLS = {
  // Wild — Chef character (appears reels 2,3,4 only — enforced in backend)
  WILD:       { id: 'WILD',       label: 'WILD',  name: 'Chef Wild',    color: '#FFD700', weight: 2,  payout: { 3: 5,   4: 10,  5: 37  } },
  // Premium food symbols
  ZONGZI:     { id: 'ZONGZI',     label: '🫕',    name: 'Zongzi',       color: '#84CC16', weight: 6,  payout: { 3: 5,   4: 10,  5: 37  } },
  SUSHI:      { id: 'SUSHI',      label: '🍱',    name: 'Sushi Bowl',   color: '#EC4899', weight: 8,  payout: { 3: 3,   4: 5,   5: 25  } },
  TACO:       { id: 'TACO',       label: '🌮',    name: 'Taco',         color: '#F59E0B', weight: 8,  payout: { 3: 3,   4: 5,   5: 25  } },
  ONION:      { id: 'ONION',      label: '🧅',    name: 'Onion',        color: '#A855F7', weight: 10, payout: { 3: 2,   4: 3,   5: 10  } },
  STAR_ANISE: { id: 'STAR_ANISE', label: '🌟',    name: 'Star Anise',   color: '#D97706', weight: 10, payout: { 3: 2,   4: 3,   5: 10  } },
  BAO:        { id: 'BAO',        label: '🥟',    name: 'Bao',          color: '#E5E7EB', weight: 10, payout: { 3: 2,   4: 3,   5: 10  } },
  // Card symbols
  A: { id: 'A', label: 'A', name: 'Ace',   color: '#EF4444', weight: 12, payout: { 3: 1, 4: 2, 5: 4 } },
  K: { id: 'K', label: 'K', name: 'King',  color: '#EF4444', weight: 12, payout: { 3: 1, 4: 2, 5: 4 } },
  Q: { id: 'Q', label: 'Q', name: 'Queen', color: '#EF4444', weight: 12, payout: { 3: 1, 4: 2, 5: 4 } },
  J: { id: 'J', label: 'J', name: 'Jack',  color: '#EF4444', weight: 14, payout: { 3: 1, 4: 2, 5: 4 } },
  '9': { id: '9', label: '9', name: 'Nine',  color: '#F97316', weight: 15, payout: { 3: 1, 4: 2, 5: 4 } },
  '8': { id: '8', label: '8', name: 'Eight', color: '#F97316', weight: 15, payout: { 3: 1, 4: 2, 5: 4 } },
  // Scatter / Bonus balls
  RED_BALL:    { id: 'RED_BALL',    label: '🔴', name: 'Red Scatter',    color: '#EF4444', weight: 4, isBonus: true, bonusColor: 'red',    bonusType: 'Upsized' },
  GREEN_BALL:  { id: 'GREEN_BALL',  label: '🟢', name: 'Green Scatter',  color: '#22C55E', weight: 4, isBonus: true, bonusColor: 'green',  bonusType: 'Yummy'   },
  PURPLE_BALL: { id: 'PURPLE_BALL', label: '🟣', name: 'Purple Scatter', color: '#A855F7', weight: 4, isBonus: true, bonusColor: 'purple', bonusType: 'Spicy'   },
  // Jackpot symbols
  JP_MINI:  { id: 'JP_MINI',  label: 'MINI',  name: 'Mini Jackpot',  color: '#F97316', weight: 6, isJackpot: true, jackpotKey: 'MINI'  },
  JP_MINOR: { id: 'JP_MINOR', label: 'MINOR', name: 'Minor Jackpot', color: '#A855F7', weight: 2, isJackpot: true, jackpotKey: 'MINOR' },
  JP_MAJOR: { id: 'JP_MAJOR', label: 'MAJOR', name: 'Major Jackpot', color: '#22C55E', weight: 1, isJackpot: true, jackpotKey: 'MAJOR' },
  JP_GRAND: { id: 'JP_GRAND', label: 'GRAND', name: 'Grand Jackpot', color: '#EF4444', weight: 0, isJackpot: true, jackpotKey: 'GRAND' },
};

// Jackpot unlock thresholds (bet per spin)
const JACKPOT_THRESHOLDS = {
  MINI:  1,
  MINOR: 2,
  MAJOR: 4,
  GRAND: 8,
};

// Base pool without jackpot symbols — jackpot symbols added per-bet in generateGrid
const BASE_SYMBOL_POOL = Object.values(SYMBOLS)
  .filter(s => !s.isJackpot && s.weight > 0)
  .flatMap(s => Array(s.weight).fill(s.id));

function getSymbolPool(bet) {
  const pool = [...BASE_SYMBOL_POOL];
  if (bet >= JACKPOT_THRESHOLDS.MINI)  pool.push(...Array(SYMBOLS.JP_MINI.weight).fill('JP_MINI'));
  if (bet >= JACKPOT_THRESHOLDS.MINOR) pool.push(...Array(SYMBOLS.JP_MINOR.weight).fill('JP_MINOR'));
  if (bet >= JACKPOT_THRESHOLDS.MAJOR) pool.push(...Array(SYMBOLS.JP_MAJOR.weight).fill('JP_MAJOR'));
  // GRAND only triggers inside the bonus Hold & Win round — never appears in base reels
  return pool;
}

const JACKPOTS = {
  GRAND: { name: 'GRAND', color: '#EF4444', gradient: 'from-red-700 to-red-500', multiplier: 1000 },
  MAJOR: { name: 'MAJOR', color: '#22C55E', gradient: 'from-green-700 to-green-500', multiplier: 250 },
  MINOR: { name: 'MINOR', color: '#A855F7', gradient: 'from-purple-700 to-purple-500', multiplier: 50 },
  MINI:  { name: 'MINI',  color: '#F97316', gradient: 'from-orange-600 to-orange-400', multiplier: 10 },
};

const POTS = [
  { id: 'yummy', label: 'YUMMY', color: '#22C55E', bg: 'bg-green-600', ballColor: 'green', bonusId: 'GREEN_BALL', jackpot: 'MAJOR' },
  { id: 'upsized', label: 'UPSIZED', color: '#EF4444', bg: 'bg-red-600', ballColor: 'red', bonusId: 'RED_BALL', jackpot: 'GRAND' },
  { id: 'spicy', label: 'SPICY', color: '#A855F7', bg: 'bg-purple-600', ballColor: 'purple', bonusId: 'PURPLE_BALL', jackpot: 'MINOR' },
];

const COLS = 5;
const ROWS = 3;
const PAYLINES = [
  [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0],
  [1,0,0,0,1], [1,2,2,2,1],
  [0,1,1,1,0],
];

function getBallValue(bet) {
  const values = [0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 5.00];
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const idx = buf[0] % values.length;
  return Math.round(values[idx] * bet * 10) / 10;
}

function TemperatureKnob({ level, color }) {
  const maxLevel = 7;
  const pct = Math.min(level / maxLevel, 1);
  const angle = -135 + pct * 270;
  return (
    <div className="relative w-5 h-5">
      <div className="w-5 h-5 rounded-full border border-gray-500 bg-gray-800 flex items-center justify-center">
        <div
          className="w-0.5 h-2 rounded-full"
          style={{
            backgroundColor: color,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50% 100%',
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

function BallSymbol({ color, value, size = 'md' }) {
  const colors = {
    red: { bg: 'radial-gradient(circle at 35% 35%, #ff6b6b, #cc0000)', glow: '#ef4444', border: '#991b1b' },
    green: { bg: 'radial-gradient(circle at 35% 35%, #4ade80, #15803d)', glow: '#22c55e', border: '#166534' },
    purple: { bg: 'radial-gradient(circle at 35% 35%, #c084fc, #7e22ce)', glow: '#a855f7', border: '#581c87' },
  };
  const c = colors[color] || colors.red;
  const sz = size === 'lg' ? 'w-14 h-14 text-xs' : size === 'xs' ? 'w-5 h-5 text-[8px]' : 'w-10 h-10 text-xs';

  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white relative`}
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        boxShadow: `0 0 12px ${c.glow}, inset 0 -2px 4px rgba(0,0,0,0.3)`,
      }}
    >
      {value !== undefined && (
        <span className="text-white font-bold drop-shadow text-[10px]">${value}</span>
      )}
    </div>
  );
}

function JackpotSymbol({ sym, isWinning }) {
  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-[11px] text-white border-2 ${isWinning ? 'scale-110' : ''}`}
      style={{
        background: `radial-gradient(circle at 35% 35%, ${sym.color}cc, ${sym.color}55)`,
        border: `2px solid ${sym.color}`,
        boxShadow: `0 0 10px ${sym.color}88, inset 0 -2px 4px rgba(0,0,0,0.4)`,
      }}
    >
      {sym.label}
    </div>
  );
}

function SlotSymbol({ symbolId, isWinning, bonusGlow }) {
  const sym = SYMBOLS[symbolId];
  if (!sym) return null;

  if (sym.isJackpot) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <JackpotSymbol sym={sym} isWinning={isWinning} />
      </div>
    );
  }

  if (sym.isBonus) {
    return (
      <motion.div
        animate={bonusGlow ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.6 }}
        className="flex items-center justify-center w-full h-full"
      >
        <BallSymbol color={sym.bonusColor} />
      </motion.div>
    );
  }

  const isCard = ['K','Q','J','A','9','8'].includes(sym.id);
  const isWild = sym.id === 'WILD';

  // Map symbol IDs to display emoji for food symbols
  const FOOD_EMOJI = {
    ZONGZI: '🫕',
    SUSHI: '🍱',
    TACO: '🌮',
    ONION: '🧅',
    STAR_ANISE: '✵',
    BAO: '🥟',
  };

  const FOOD_IMAGES = {
    ZONGZI: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
    SUSHI: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
    TACO: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
    ONION: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
    STAR_ANISE: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
    BAO: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png',
  };

  return (
    <div
      className={`flex items-center justify-center w-full h-full rounded ${
        isWinning ? 'ring-2 ring-yellow-400' : ''
      } ${isWild ? 'bg-gradient-to-b from-yellow-600/30 to-yellow-800/20 rounded' : ''}`}
    >
      {isWild ? (
        <div className="flex flex-col items-center gap-0.5">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/be711c724_1000001676.png"
            alt="Wild Chef"
            style={{ height: 44, objectFit: 'contain' }}
          />
          <span className="text-yellow-400 font-black bg-yellow-900/80 px-1 rounded" style={{ fontSize: '9px' }}>WILD</span>
        </div>
      ) : isCard ? (
        <span className="font-black text-2xl drop-shadow-lg" style={{ color: sym.color, textShadow: `0 2px 8px rgba(0,0,0,0.8), 0 0 6px ${sym.color}` }}>{sym.label}</span>
      ) : FOOD_EMOJI[sym.id] ? (
        <div className="flex flex-col items-center justify-center">
          {FOOD_IMAGES[sym.id] ? (
            <img src={FOOD_IMAGES[sym.id]} alt={sym.name} className="h-10 w-10 object-contain" />
          ) : sym.id === 'STAR_ANISE' ? (
            <span className="text-3xl" style={{ color: '#D97706', textShadow: '0 0 8px #D97706' }}>✳</span>
          ) : (
            <span className="text-3xl">{FOOD_EMOJI[sym.id]}</span>
          )}
        </div>
      ) : (
        <span className="text-2xl">{sym.label}</span>
      )}
    </div>
  );
}

// Reusable single board logic — shared by both boards in Yummy mode
function useBonusBoard(grid, bet, MAX_SPINS) {
  const [holdGrid, setHoldGrid] = useState(() =>
    Array(COLS).fill(null).map((_, c) =>
      Array(ROWS).fill(null).map((_, r) => {
        const sym = grid[c][r];
        if (SYMBOLS[sym]?.isBonus) {
          return { value: getBallValue(bet), color: SYMBOLS[sym].bonusColor, type: 'wonton' };
        }
        return null;
      })
    )
  );
  const [featureWin, setFeatureWin] = useState(0);
  const [pepperFlash, setPepperFlash] = useState(null);
  const [orderUpFlash, setOrderUpFlash] = useState(false);
  const [litLetters, setLitLetters] = useState(Array(COLS).fill(false)); // G-A-R-N-D
  const holdGridRef = useRef(holdGrid);
  holdGridRef.current = holdGrid;

  const runSpin = (currentSpins) => {
    const currentGrid = holdGridRef.current;
    let newBallFound = false;

    const newGrid = currentGrid.map((col) =>
      col.map((cell) => {
        if (cell) return cell;
        const rand = Math.random();
        if (rand < 0.03) { newBallFound = true; return { value: getBallValue(bet), color: 'red', type: 'pepper' }; }
        if (rand < 0.23) {
          newBallFound = true;
          const colors = ['red', 'green', 'purple'];
          return { value: getBallValue(bet), color: colors[Math.floor(Math.random() * colors.length)], type: 'wonton' };
        }
        return null;
      })
    );

    // Fix pepper pos correctly
    let actualPepperPos = null;
    newGrid.forEach((col, c) => col.forEach((cell, r) => { if (cell?.type === 'pepper') actualPepperPos = { col: c, row: r }; }));

    let finalGrid = newGrid;
    if (actualPepperPos) {
      const pepperVal = newGrid[actualPepperPos.col][actualPepperPos.row].value;
      setPepperFlash(actualPepperPos);
      setTimeout(() => setPepperFlash(null), 1200);
      finalGrid = newGrid.map((col) =>
        col.map((cell) => {
          if (!cell) return null;
          if (cell.type === 'pepper') return { ...cell, type: 'wonton' };
          return { ...cell, value: Math.round((cell.value + pepperVal) * 100) / 100 };
        })
      );
      newBallFound = true;
    }

    // Order Up check — when a column is fully filled, award its sum, clear it, and light the GRAND letter
    let orderUpGrid = finalGrid.map(col => [...col]);
    let orderUpBonus = 0;
    const newlyLit = [];
    for (let c = 0; c < COLS; c++) {
      const col = orderUpGrid[c];
      if (col.every(cell => cell !== null)) {
        orderUpBonus += Math.round(col.reduce((s, cell) => s + (cell ? cell.value : 0), 0) * 100) / 100;
        orderUpGrid[c] = [null, null, null];
        newlyLit.push(c);
      }
    }
    if (orderUpBonus > 0) {
      setFeatureWin(prev => Math.round((prev + orderUpBonus) * 100) / 100);
      setOrderUpFlash(true);
      setTimeout(() => setOrderUpFlash(false), 1800);
      finalGrid = orderUpGrid;
    }
    if (newlyLit.length > 0) {
      setLitLetters(prev => {
        const next = [...prev];
        newlyLit.forEach(c => { next[c] = true; });
        return next;
      });
    }

    setHoldGrid(finalGrid);
    const newSpins = newBallFound ? MAX_SPINS : currentSpins - 1;
    const allFilled = finalGrid.flat().every(c => c !== null);
    return { finalGrid, newSpins, allFilled };
  };

  const liveWin = holdGrid.flat().reduce((s, c) => s + (c ? c.value : 0), 0);

  return { holdGrid, featureWin, setFeatureWin, pepperFlash, orderUpFlash, litLetters, runSpin, liveWin };
}

function BonusGrid({ holdGrid, pepperFlash, litLetters = Array(COLS).fill(false), label, borderColor = 'border-green-700' }) {
  const grandLetters = ['G','A','R','N','D'];
  const allLit = litLetters.every(Boolean);

  return (
    <div className="w-full">
      {label && (
        <div className={`text-center text-xs font-black py-0.5 mb-0.5 rounded-t border ${borderColor} text-white`}
          style={{ background: 'rgba(0,80,0,0.5)' }}>
          {label}
        </div>
      )}
      <div className="grid w-full mb-0.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {grandLetters.map((l, i) => {
          const lit = litLetters[i];
          return (
            <motion.div
              key={i}
              animate={lit ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-center h-6 font-black text-sm border"
              style={{
                background: lit ? 'linear-gradient(180deg, #cc3300, #660000)' : '#1a0a0a',
                border: lit ? '1px solid #ff4400' : '1px solid #2a1010',
                color: lit ? '#FFD700' : '#555',
                textShadow: lit ? '0 0 8px #FFD700, 0 0 16px #FF4400' : 'none',
                boxShadow: lit ? '0 0 10px rgba(255,68,0,0.8), inset 0 0 6px rgba(255,180,0,0.3)' : 'none',
              }}
            >
              {l}
            </motion.div>
          );
        })}
      </div>
      <div className="grid w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {Array(ROWS).fill(null).map((_, r) =>
          Array(COLS).fill(null).map((_, c) => {
            const cell = holdGrid[c][r];
            const isPepper = pepperFlash && pepperFlash.col === c && pepperFlash.row === r;
            return (
              <div
                key={`${c}-${r}`}
                className={`h-12 rounded bg-gradient-to-b from-[#2a0808] to-[#1a0505] border flex items-center justify-center relative overflow-hidden transition-all ${
                  cell ? 'border-orange-500' : 'border-red-950/50'
                } ${isPepper ? 'border-yellow-300' : ''}`}
                style={cell ? { boxShadow: isPepper ? '0 0 16px #FFD700' : '0 0 8px rgba(251,146,60,0.5)' } : {}}
              >
                {cell ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    {cell.type === 'pepper' ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xl">🌶️</span>
                        <span className="text-yellow-300 text-[9px] font-bold">${cell.value}</span>
                      </div>
                    ) : (
                      <BallSymbol color={cell.color} value={cell.value} size="sm" />
                    )}
                  </motion.div>
                ) : (
                  <span className="text-gray-700 text-xs">·</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Hold & Win bonus — single board (Spicy/Upsized only) or double stacked (Yummy involved)
function HoldAndWinBonus({ grid, bet, isUpsized, isYummy, onComplete }) {
  const MAX_SPINS = isUpsized ? 4 : 3;

  // Board 1 always present
  const board1 = useBonusBoard(grid, bet, MAX_SPINS);
  // Board 2 only for Yummy — start empty
  const emptyGrid = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));
  const board2 = useBonusBoard(emptyGrid, bet, MAX_SPINS);

  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS);
  const [done, setDone] = useState(false);
  const [jackpotWon, setJackpotWon] = useState(null);
  const spinningRef = useRef(false);
  const doneRef = useRef(false);
  const spinsRef = useRef(MAX_SPINS);
  spinsRef.current = spinsLeft;

  const doSpin = () => {
    if (spinningRef.current || doneRef.current) return;
    spinningRef.current = true;

    setTimeout(() => {
      const currentSpins = spinsRef.current;
      const r1 = board1.runSpin(currentSpins);
      const r2 = isYummy ? board2.runSpin(currentSpins) : { newSpins: currentSpins, finalGrid: emptyGrid, allFilled: false };

      const newBallFound = r1.newSpins === MAX_SPINS || (isYummy && r2.newSpins === MAX_SPINS);
      const newSpins = newBallFound ? MAX_SPINS : currentSpins - 1;
      setSpinsLeft(newSpins);
      spinningRef.current = false;

      // GRAND jackpot: all 5 letters lit on either board
      const grandTriggered = board1.litLetters.every(Boolean) || (isYummy && board2.litLetters.every(Boolean));
      if (grandTriggered) {
        setJackpotWon('GRAND');
        doneRef.current = true;
        setDone(true);
        return;
      }

      // Jackpot: check if either board is all filled (all 15 cells)
      if (r1.allFilled || (isYummy && r2.allFilled)) {
        const allCells = [...r1.finalGrid.flat(), ...(isYummy ? r2.finalGrid.flat() : [])];
        const colorCounts = {};
        allCells.filter(Boolean).forEach(c => { colorCounts[c.color] = (colorCounts[c.color] || 0) + 1; });
        let jp = null;
        if (Object.values(colorCounts).some(v => v >= 12)) jp = 'MAJOR';
        else if (Object.values(colorCounts).some(v => v >= 9)) jp = 'MINOR';
        else if (Object.values(colorCounts).some(v => v >= 6)) jp = 'MINI';
        setJackpotWon(jp);
        doneRef.current = true;
        setDone(true);
        return;
      }

      if (newSpins <= 0) {
        doneRef.current = true;
        setDone(true);
      }
    }, 950);
  };

  useEffect(() => {
    if (!done && !spinningRef.current) {
      const t = setTimeout(doSpin, 700);
      return () => clearTimeout(t);
    }
  }, [board1.holdGrid, board2.holdGrid, done]);

  const totalWin = Math.round((board1.liveWin + (isYummy ? board2.liveWin : 0) + board1.featureWin + (isYummy ? board2.featureWin : 0)) * 100) / 100;

  return (
    <div className="absolute inset-0 bg-[#0a0005]/96 z-50 flex flex-col items-center overflow-y-auto py-2 px-2 rounded-2xl">

      {/* Feature Win */}
      <div className="w-full flex justify-center mb-2">
        <div className="bg-gradient-to-r from-red-900 to-red-800 border border-red-500 rounded-xl px-6 py-2 text-center">
          <div className="text-white font-bold text-xs">Feature Win</div>
          <motion.div
            key={Math.round(totalWin * 1000)}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.3 }}
            className="text-yellow-400 font-black text-2xl"
            style={{ textShadow: '0 0 15px #FFD700' }}
          >
            ${totalWin.toFixed(3)}
          </motion.div>
        </div>
      </div>

      {jackpotWon && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="text-xl font-black mb-2"
          style={{ color: JACKPOTS[jackpotWon].color, textShadow: `0 0 15px ${JACKPOTS[jackpotWon].color}` }}
        >
          🏆 {jackpotWon} JACKPOT! 🏆
        </motion.div>
      )}

      {/* Spins remaining */}
      {!done && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gray-300 text-xs font-bold">SPINS:</span>
          {Array(MAX_SPINS).fill(null).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${
                i < spinsLeft
                  ? 'bg-orange-500 border-orange-300 text-white shadow-[0_0_8px_#f97316]'
                  : 'bg-gray-800 border-gray-600 text-gray-600'
              }`}
            >
              {i < spinsLeft ? i + 1 : ''}
            </div>
          ))}
          {isUpsized && <span className="text-orange-400 text-xs font-bold ml-1">UPSIZED!</span>}
          {isYummy && <span className="text-green-400 text-xs font-bold ml-1">YUMMY!</span>}
        </div>
      )}

      {/* Board 1 */}
      <BonusGrid holdGrid={board1.holdGrid} pepperFlash={board1.pepperFlash} litLetters={board1.litLetters} label={isYummy ? 'BOARD 1' : null} />

      {/* Pepper / Order Up flashes for board 1 */}
      <AnimatePresence>
        {board1.pepperFlash && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-yellow-300 font-black text-xs text-center" style={{ textShadow: '0 0 10px #FFD700' }}>
            🌶️ PEPPER BOOST!
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {board1.orderUpFlash && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.1 }} exit={{ opacity: 0, scale: 0.5 }}
            className="text-orange-300 font-black text-sm text-center" style={{ textShadow: '0 0 15px #f97316' }}>
            🍜 ORDER UP!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board 2 — only shown when Yummy */}
      {isYummy && (
        <>
          <div className="w-full border-t border-green-700/50 mt-1 mb-1" />
          <BonusGrid holdGrid={board2.holdGrid} pepperFlash={board2.pepperFlash} litLetters={board2.litLetters} label="BOARD 2" borderColor="border-green-500" />
          <AnimatePresence>
            {board2.pepperFlash && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-yellow-300 font-black text-xs text-center" style={{ textShadow: '0 0 10px #FFD700' }}>
                🌶️ PEPPER BOOST! (Board 2)
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {board2.orderUpFlash && (
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.1 }} exit={{ opacity: 0, scale: 0.5 }}
                className="text-orange-300 font-black text-sm text-center" style={{ textShadow: '0 0 15px #f97316' }}>
                🍜 ORDER UP! (Board 2)
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Completion bar */}
      <div className="flex items-center justify-center gap-1 mt-1 py-1 w-full bg-[#1a0a0a] rounded">
        {done ? (
          <span className="text-xs font-black text-yellow-400 tracking-widest">COMPLETED</span>
        ) : (
          <div className="flex gap-1">
            {Array(MAX_SPINS).fill(null).map((_, i) => (
              <div key={i}
                className={`w-6 h-2 rounded-sm transition-all ${i >= spinsLeft ? 'bg-orange-500' : 'bg-gray-700'}`}
                style={i >= spinsLeft ? { boxShadow: '0 0 4px #f97316' } : {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* Collect button when done */}
      {done && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3">
          <Button
            onClick={() => onComplete(totalWin, jackpotWon)}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-base px-8 py-2 rounded-xl"
          >
            COLLECT ${totalWin.toFixed(3)}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default function HotPotSlot({ wallet, onBet, currency = 'IC', user }) {
  const [bet, setBet] = useState(0.22);
  const [speed, setSpeed] = useState(0); // 0=normal, 1=fast, 2=turbo
  const [autoSpins, setAutoSpins] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoStopRef = useRef(false);
  const [grid, setGrid] = useState(() => {
    const startSyms = ['K','Q','J','A','9','8','ZONGZI','TACO','STAR_ANISE','ONION','BAO','SUSHI','K','Q','J'];
    return Array(COLS).fill(null).map((_, c) => Array(ROWS).fill(null).map((_, r) => startSyms[(c*3+r) % startSyms.length]));
  });
  const [pendingGrid, setPendingGrid] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [exitingCols, setExitingCols] = useState(Array(COLS).fill(false));
  const [droppingCols, setDroppingCols] = useState(Array(COLS).fill(false));
  const [winAmount, setWinAmount] = useState(0);
  const [winningCells, setWinningCells] = useState([]);
  const [bonusMode, setBonusMode] = useState(null);
  const [bonusBalls, setBonusBalls] = useState({ red: 0, green: 0, purple: 0 });
  const [ballValues, setBallValues] = useState({ red: [], green: [], purple: [] });
  const [potTemps, setPotTemps] = useState({ red: 0, green: 0, purple: 0 });
  const [jackpots] = useState({ GRAND: 22, MAJOR: 11, MINOR: 4.7, MINI: 0.5 });
  const [showWin, setShowWin] = useState(false);
  const [reelAnimating, setReelAnimating] = useState(Array(COLS).fill(false));
  const [message, setMessage] = useState('GOOD LUCK');
  const [bonusTriggerGrid, setBonusTriggerGrid] = useState(null);
  const [bonusIsUpsized, setBonusIsUpsized] = useState(false);
  const [bonusIsYummy, setBonusIsYummy] = useState(false);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);

  // Jackpot icon map (matches screenshots: red/green/purple scatter balls on meters)
  const JP_ICONS = { GRAND: '🔴', MAJOR: '🟢', MINOR: '🟣', MINI: '🌶️' };

  const checkPaylines = (g) => {
    let totalWin = 0;
    const winning = new Set();

    PAYLINES.forEach((line) => {
      // Collect symbols on this payline
      const lineSyms = line.map((row, col) => g[col][row]);
      
      // Count from left
      const first = lineSyms[0] === 'WILD' ? lineSyms.find(s => s !== 'WILD') || 'WILD' : lineSyms[0];
      let count = 0;
      for (let i = 0; i < lineSyms.length; i++) {
        if (lineSyms[i] === first || lineSyms[i] === 'WILD') count++;
        else break;
      }

      if (count >= 3 && SYMBOLS[first]?.payout) {
        const mult = SYMBOLS[first].payout[count] || 0;
        if (mult > 0) {
          totalWin += mult * bet;
          for (let i = 0; i < count; i++) winning.add(`${i},${line[i]}`);
        }
      }
    });

    return { totalWin: Math.round(totalWin * 100) / 100, winning: [...winning] };
  };

  const SPEED_CONFIG = {
    0: { reelBase: 150, reelStep: 120 },
    1: { reelBase: 50,  reelStep: 40  },
    2: { reelBase: 10,  reelStep: 10  },
  };

  const cycleSpeed = () => setSpeed(prev => (prev + 1) % 3);

  // Auto spin engine
  useEffect(() => {
    if (!autoRunning || autoStopRef.current || bonusMode) return;
    if (autoSpins !== null && autoSpins !== Infinity && autoSpins <= 0) {
      setAutoRunning(false);
      setAutoSpins(null);
      return;
    }
    if (!spinning) {
      spin().then(() => {
        if (!autoStopRef.current) {
          setAutoSpins(prev => prev === Infinity ? Infinity : (prev > 0 ? prev - 1 : 0));
        }
      });
    }
  }, [autoRunning, spinning, bonusMode]);

  const startAuto = (count) => {
    autoStopRef.current = false;
    setAutoSpins(count);
    setAutoRunning(true);
  };

  const stopAuto = () => {
    autoStopRef.current = true;
    setAutoRunning(false);
    setAutoSpins(null);
  };

  const spin = async () => {
    if (spinning || bonusMode) return;
    if (bet > balance) return;

    const cfg = SPEED_CONFIG[speed];
    setSpinning(true);
    setShowWin(false);
    setWinAmount(0);
    setWinningCells([]);
    setMessage('SPINNING...');

    // Deduct bet immediately
    await onBet(bet, 0, 'hotpot', 0);

    // --- Request outcome from server (true crypto RNG) ---
    const { data: outcome } = await base44.functions.invoke('generateHotPotOutcome', {
      bet,
      currency,
      accumulated_balls: bonusBalls,
    });

    if (!outcome?.success) {
      setMessage('ERROR — PLEASE TRY AGAIN');
      setSpinning(false);
      return;
    }

    setLastSeed(outcome.seed);
    setLastHash(outcome.hash);

    const newGrid = outcome.grid;

    // Phase 1: exit old symbols downward
    setExitingCols(Array(COLS).fill(true));
    await new Promise(res => setTimeout(res, 350));
    setExitingCols(Array(COLS).fill(false));

    // Phase 2: drop new symbols in column by column
    setReelAnimating(Array(COLS).fill(false));
    for (let c = 0; c < COLS; c++) {
      await new Promise(res => setTimeout(res, cfg.reelBase + c * cfg.reelStep));
      setGrid(prev => { const next = prev.map(col => [...col]); next[c] = newGrid[c]; return next; });
      setDroppingCols(prev => { const n = [...prev]; n[c] = true; return n; });
      setTimeout(() => setDroppingCols(prev => { const n = [...prev]; n[c] = false; return n; }), 400);
    }

    // Update accumulated balls from server
    setBonusBalls(outcome.accumulated_balls);
    setPotTemps({
      red:    Math.min(outcome.accumulated_balls.red, 7),
      green:  Math.min(outcome.accumulated_balls.green, 7),
      purple: Math.min(outcome.accumulated_balls.purple, 7),
    });

    if (outcome.bonus_triggered && outcome.bonus_result) {
      // Bonus was fully resolved on server — show result directly
      const br = outcome.bonus_result;
      const upsized = br.board2 !== null;
      const yummy = br.board2 !== null;
      const parts = [];
      if (yummy && upsized) parts.push('🟢🔥 YUMMY UPSIZED!');
      else if (yummy)       parts.push('🟢 YUMMY BONUS!');
      else                  parts.push('🌶️ SPICY BONUS!');
      setMessage(parts.join(' '));
      setBonusIsUpsized(upsized);
      setBonusIsYummy(yummy);
      setBonusTriggerGrid(newGrid);
      // Show bonus animation briefly then award win
      setTimeout(async () => {
        const bonusWin = outcome.spin_win;
        if (bonusWin > 0) {
          await onBet(0, bonusWin, 'hotpot', Math.floor(bet));
          setWinAmount(bonusWin);
          setShowWin(true);
          setMessage(`BONUS WIN! ${bonusWin.toFixed(2)} ${currency}${br.jackpotWon ? ` + ${br.jackpotWon} JACKPOT!` : ''}`);
        } else {
          setMessage('GOOD LUCK');
        }
        setBonusMode(null);
        setBonusTriggerGrid(null);
        setSpinning(false);
      }, 2500);
      return;
    }

    // Regular spin win
    const totalWin = outcome.spin_win;
    if (totalWin > 0) {
      setWinAmount(totalWin);
      setWinningCells(outcome.winningCells || []);
      setShowWin(true);
      const jpMsg = outcome.jackpot_hits?.length > 0
        ? ` + ${outcome.jackpot_hits.map(j => j.sym.replace('JP_','')).join('+')} JACKPOT!`
        : '';
      setMessage(`WIN! ${totalWin.toFixed(2)} ${currency}${jpMsg}`);
      await onBet(0, totalWin, 'hotpot', Math.floor(bet));
    } else {
      setMessage('GOOD LUCK');
    }

    setSpinning(false);
  };

  const handleBonusComplete = async (winAmt, jackpotWon) => {
    // Bonus is now fully resolved server-side; this handler is kept for UI cleanup only
    setBonusMode(null);
    setBonusTriggerGrid(null);
    setBonusIsYummy(false);
    setMessage('GOOD LUCK');
  };

  const adjustBet = (delta) => setBet(prev => Math.max(0.01, Math.min(balance, Math.round((prev + delta) * 100) / 100)));

  const handleCurrencyToggle = () => {
    // no-op placeholder — currency toggled from parent
  };

  return (
    <div className="flex flex-col items-center select-none w-full" style={{ maxWidth: 420, margin: '0 auto', background: '#1a0000', borderRadius: 0 }}>
      
      {/* ===== JACKPOT HEADER (warm kitchen background) ===== */}
      <div className="w-full relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f5c842 0%, #e8a020 40%, #c07010 100%)', minHeight: 220 }}>
        {/* Kitchen bg silhouette overlay */}
        <div className="absolute inset-0 opacity-20" style={{ background: 'url(https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=20) center/cover' }} />
        
        {/* GRAND + MAJOR row */}
        <div className="relative z-10 flex items-center justify-between px-3 pt-3 gap-2">
          {/* GRAND */}
          {(() => {
            const jp = JACKPOTS['GRAND'];
            const unlocked = bet >= JACKPOT_THRESHOLDS['GRAND'];
            return (
              <motion.div
                animate={unlocked ? { boxShadow: [`0 0 6px ${jp.color}`, `0 0 16px ${jp.color}`, `0 0 6px ${jp.color}`] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #7a0000, #cc0000)', border: '2px solid #ff4444', opacity: unlocked ? 1 : 0.5 }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-yellow-300 font-black text-xs tracking-wider">GRAND</span>
                  <BallSymbol color="red" size="xs" />
                </div>
                <span className="text-white font-black text-base">${(jackpots['GRAND'] * bet).toFixed(2)}</span>
              </motion.div>
            );
          })()}
          {/* MAJOR */}
          {(() => {
            const jp = JACKPOTS['MAJOR'];
            const unlocked = bet >= JACKPOT_THRESHOLDS['MAJOR'];
            return (
              <motion.div
                animate={unlocked ? { boxShadow: [`0 0 6px ${jp.color}`, `0 0 16px ${jp.color}`, `0 0 6px ${jp.color}`] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #004d00, #00aa00)', border: '2px solid #44ff44', opacity: unlocked ? 1 : 0.5 }}
              >
                <span className="text-yellow-300 font-black text-xs tracking-wider">MAJOR</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-black text-base">${(jackpots['MAJOR'] * bet).toFixed(2)}</span>
                  <BallSymbol color="green" size="xs" />
                </div>
              </motion.div>
            );
          })()}
        </div>

        {/* MINOR + MINI row */}
        <div className="relative z-10 flex items-center justify-between px-3 pt-1.5 gap-2">
          {/* MINOR */}
          {(() => {
            const jp = JACKPOTS['MINOR'];
            const unlocked = bet >= JACKPOT_THRESHOLDS['MINOR'];
            return (
              <motion.div
                animate={unlocked ? { boxShadow: [`0 0 5px ${jp.color}`, `0 0 12px ${jp.color}`, `0 0 5px ${jp.color}`] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: 'linear-gradient(90deg, #5a0080, #aa00cc)', border: '2px solid #cc44ff', opacity: unlocked ? 1 : 0.5 }}
              >
                <span className="text-yellow-300 font-black text-[10px] tracking-wider">MINOR</span>
                <BallSymbol color="purple" size="xs" />
                <span className="text-white font-black text-sm">${(jackpots['MINOR'] * bet).toFixed(2)}</span>
              </motion.div>
            );
          })()}
          <div className="flex-1" />
          {/* MINI */}
          {(() => {
            const jp = JACKPOTS['MINI'];
            const unlocked = bet >= JACKPOT_THRESHOLDS['MINI'];
            return (
              <motion.div
                animate={unlocked ? { boxShadow: [`0 0 5px ${jp.color}`, `0 0 12px ${jp.color}`, `0 0 5px ${jp.color}`] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: 'linear-gradient(90deg, #7a3800, #cc6600)', border: '2px solid #ffaa44', opacity: unlocked ? 1 : 0.5 }}
              >
                <span className="text-yellow-300 font-black text-[10px] tracking-wider">MINI</span>
                <span className="text-base">🌶️</span>
                <span className="text-white font-black text-sm">${(jackpots['MINI'] * bet).toFixed(2)}</span>

              </motion.div>
            );
          })()}
        </div>

        {/* Chef image centered */}
        <div className="relative z-10 flex flex-col items-center pt-1">
          <img
            src="https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/8ace546a5_generated_image.png"
            alt="Chef"
            className="drop-shadow-2xl"
            style={{ height: 140, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
          />
          
          {/* Pots row — on the stove shelf */}
          <div className="flex items-end justify-center gap-3 mt-1">
            {POTS.map(pot => (
              <div key={pot.id} className="flex flex-col items-center">
                {/* Steam */}
                {potTemps[pot.ballColor] > 2 && (
                  <motion.div animate={{ y: [-2, -6, -2], opacity: [0.7, 0.3, 0.7] }} transition={{ repeat: Infinity, duration: 1 }}
                    className="text-white/60 text-sm mb-0.5">〰️</motion.div>
                )}
                {/* Pot */}
                <div
                  className={`w-16 h-14 ${pot.bg} rounded-t-3xl flex flex-col items-center justify-center border-t-4 border-white/30 relative`}
                  style={{ boxShadow: `0 -4px 16px ${pot.color}99, inset 0 -4px 8px rgba(0,0,0,0.4)` }}
                >
                  <span className="text-white font-black text-xs tracking-wide drop-shadow">{pot.label}</span>
                </div>
                {/* Knob */}
                <div className="w-5 h-3 bg-gray-700 rounded-b flex items-center justify-center" style={{ borderTop: `2px solid ${pot.color}` }}>
                  <TemperatureKnob level={potTemps[pot.ballColor]} color={pot.color} />
                </div>
              </div>
            ))}
          </div>
          {/* Stove shelf bar */}
          <div className="w-full h-3 mt-0" style={{ background: 'linear-gradient(180deg, #333, #111)', borderTop: '2px solid #555', borderBottom: '2px solid #000' }} />
        </div>
      </div>

      {/* ===== REEL GRID ===== */}
      <div className="relative w-full" style={{ background: '#1a0505' }}>
        <div className="grid gap-0.5 p-0.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {Array(ROWS).fill(null).map((_, r) =>
            Array(COLS).fill(null).map((_, c) => {
              const sym = grid[c][r];
              const isWin = winningCells.includes(`${c},${r}`);

              return (
                <div
                  key={`${c}-${r}`}
                  className="h-[72px] flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: isWin
                      ? 'linear-gradient(180deg, #3a2800, #2a1800)'
                      : 'linear-gradient(180deg, #2a0808, #1a0303)',
                    border: isWin ? '2px solid #f59e0b' : '1px solid #3a0808',
                    boxShadow: isWin ? '0 0 12px rgba(245,158,11,0.6), inset 0 0 8px rgba(245,158,11,0.2)' : 'inset 0 0 4px rgba(0,0,0,0.5)',
                  }}
                >
                  <motion.div
                    className="w-full h-full flex items-center justify-center"
                    animate={
                      exitingCols[c] ? { y: 80, opacity: 0 } :
                      droppingCols[c] ? { y: [-80, 0], opacity: [0, 1] } :
                      { y: 0, opacity: 1 }
                    }
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <SlotSymbol symbolId={sym} isWinning={isWin} />
                  </motion.div>
                </div>
              );
            })
          )}
        </div>

        {/* Bonus Overlay */}
        {bonusMode === 'holdwin' && bonusTriggerGrid && (
          <HoldAndWinBonus
            grid={bonusTriggerGrid}
            bet={bet}
            isUpsized={bonusIsUpsized}
            isYummy={bonusIsYummy}
            onComplete={handleBonusComplete}
          />
        )}
      </div>

      {/* ===== WIN / MESSAGE BAR ===== */}
      <div className="w-full py-2 text-center" style={{ background: 'linear-gradient(180deg, #001a4d, #002266)', borderTop: '2px solid #003399', borderBottom: '2px solid #001133' }}>
        <AnimatePresence mode="wait">
          {showWin ? (
            <motion.div key="win" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="text-gray-300 text-xs font-bold tracking-widest">WIN</div>
              <div className="text-yellow-400 font-black text-2xl" style={{ textShadow: '0 0 15px #FFD700' }}>
                {winAmount.toFixed(3)}
              </div>
            </motion.div>
          ) : (
            <motion.div key="msg" className="text-blue-200 font-bold text-sm tracking-[0.2em]">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== BOTTOM CONTROLS (matches screenshot exactly) ===== */}
      <div className="w-full flex items-center gap-2 px-3 py-3" style={{ background: 'linear-gradient(180deg, #0a0a1a, #050510)' }}>
        
        {/* BET control - dark pill */}
        <div className="flex flex-col items-center rounded-xl px-2 py-1.5" style={{ background: '#1a1a2e', border: '1px solid #333' }}>
          <span className="text-gray-400 text-[9px] font-bold tracking-wider mb-0.5">TOTAL BET</span>
          <span className="text-white font-black text-base">{bet.toFixed(2)}</span>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => adjustBet(-0.01)}
              className="w-6 h-6 rounded flex items-center justify-center text-white font-black"
              style={{ background: '#2a2a3e', border: '1px solid #555' }}
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => adjustBet(0.01)}
              className="w-6 h-6 rounded flex items-center justify-center text-white font-black"
              style={{ background: '#2a2a3e', border: '1px solid #555' }}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* SPIN button — large green circle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={autoRunning ? stopAuto : spin}
          disabled={!autoRunning && (spinning || !!bonusMode || bet > balance)}
          className="flex-1 flex flex-col items-center justify-center font-black text-lg"
          style={{
            width: 72, height: 72, minWidth: 72, borderRadius: '50%',
            background: autoRunning
              ? 'radial-gradient(circle at 40% 35%, #ff6633, #cc2200)'
              : spinning
                ? 'radial-gradient(circle at 40% 35%, #888, #444)'
                : 'radial-gradient(circle at 40% 35%, #66ff44, #22aa00)',
            border: autoRunning ? '4px solid #ff8855' : spinning ? '4px solid #666' : '4px solid #88ff66',
            boxShadow: autoRunning
              ? '0 0 20px rgba(255,80,0,0.8), inset 0 -4px 8px rgba(0,0,0,0.4)'
              : spinning
                ? 'none'
                : '0 0 24px rgba(34,180,0,0.9), inset 0 -4px 8px rgba(0,0,0,0.3)',
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {autoRunning ? 'STOP' : spinning ? '…' : 'SPIN'}
        </motion.button>

        {/* Right side: Balance + Speed + Auto */}
        <div className="flex flex-col gap-1.5">
          {/* Balance */}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: '#1a1a2e', border: '1px solid #333' }}>
            <span className="text-green-400 text-sm">$</span>
            <span className="text-white font-bold text-sm">{balance.toFixed(2)}</span>
            <button onClick={handleCurrencyToggle} className="text-gray-400 hover:text-white">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
          {/* Speed + Auto row */}
          <div className="flex items-center gap-1.5">
            {/* Speed */}
            <button
              onClick={cycleSpeed}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: speed > 0 ? '#1a2a1a' : '#1a1a2e', border: speed > 0 ? '1px solid #44ff44' : '1px solid #333' }}
            >
              <Zap className={`w-4 h-4 ${speed === 0 ? 'text-gray-500' : speed === 1 ? 'text-yellow-400' : 'text-cyan-400'}`} />
            </button>
            {/* Auto */}
            <div className="relative group">
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: '#1a1a2e', border: '1px solid #333' }}
              >
                <RotateCcw className="w-4 h-4 text-gray-400" />
              </button>
              <div className="absolute bottom-full mb-1 right-0 hidden group-hover:flex flex-col bg-gray-900 border border-purple-500 rounded-lg overflow-hidden z-20 shadow-xl min-w-[90px]">
                {[10, 20, 30, 'Infinite'].map((opt) => (
                  <button key={opt} onClick={() => startAuto(opt === 'Infinite' ? Infinity : opt)}
                    className="px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 text-left whitespace-nowrap">
                    {opt === 'Infinite' ? '∞ Infinite' : `${opt} Spins`}
                  </button>
                ))}
              </div>
            </div>
            {/* Menu */}
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#1a1a2e', border: '1px solid #333' }}
            >
              <span className="text-gray-400 text-lg leading-none">≡</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}