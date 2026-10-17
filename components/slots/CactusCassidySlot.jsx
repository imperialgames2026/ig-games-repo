import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Settings, Zap, Gift, Star, Info } from 'lucide-react';
import useSlotSounds from '@/hooks/useSlotSounds';

// ─── SYMBOLS ─────────────────────────────────────────────────────────────────
// Ranks (low → high): 10, J, Q, K, A, Horseshoe, Whiskey, Cactus, Cowboy, Wild, Scatter, Revolver, Coin
const SYM = {
  TEN:     { id: '10',       emoji: '10',  label: '10',        color: '#94a3b8' },
  J:       { id: 'J',        emoji: 'J',   label: 'J',         color: '#94a3b8' },
  Q:       { id: 'Q',        emoji: 'Q',   label: 'Q',         color: '#94a3b8' },
  K:       { id: 'K',        emoji: 'K',   label: 'K',         color: '#fbbf24' },
  A:       { id: 'A',        emoji: 'A',   label: 'A',         color: '#fbbf24' },
  SHOE:    { id: 'SHOE',     emoji: '🧲',  label: 'Horseshoe', color: '#c0c0c0' },
  WHISKEY: { id: 'WHISKEY',  emoji: '🍺',  label: 'Whiskey',   color: '#d97706' },
  CACTUS:  { id: 'CACTUS',   emoji: '🌵',  label: 'Cactus',    color: '#16a34a' },
  COWBOY:  { id: 'COWBOY',   emoji: '🤠',  label: 'Cowboy',    color: '#b45309' },
  WILD:    { id: 'WILD',     emoji: '⭐',  label: 'WILD',      color: '#f59e0b' },
  SCATTER: { id: 'SCATTER',  emoji: '🌟',  label: 'SCATTER',   color: '#ffd700' },
  REVOLVER:{ id: 'REVOLVER', emoji: '🔫',  label: 'Revolver',  color: '#6b7280' },
  COIN_G:  { id: 'COIN_G',   emoji: '🪙',  label: 'Gold Coin', color: '#f59e0b' },
  COIN_S:  { id: 'COIN_S',   emoji: '💿',  label: 'Silv Coin', color: '#c0c0c0' },
  ART:     { id: 'ART',      emoji: '🌵',  label: 'Art',       color: '#16a34a', image: 'https://media.base44.com/images/public/69cc9d71eaebb780909c7a7d/c78437e1f_generated_image.png' },
};

// Symbol rank for respin logic (higher = more valuable)
const SYMBOL_RANK = {
  '10': 1, 'J': 2, 'Q': 3, 'K': 4, 'A': 5,
  'SHOE': 6, 'WHISKEY': 7, 'CACTUS': 8, 'COWBOY': 9,
  'WILD': 10, 'SCATTER': 11, 'REVOLVER': 12, 'COIN_G': 13, 'COIN_S': 12,
};

// Payout multipliers: symbol → [3-of-a-kind, 4, 5, 6]
const PAY = {
  'COWBOY':  [30,  80,  200, 600],
  'CACTUS':  [12,  30,  80,  200],
  'WHISKEY': [6,   15,  40,  100],
  'SHOE':    [3,   8,   20,  50],
  'A':       [2,   5,   12,  30],
  'K':       [1.5, 4,   10,  25],
  'Q':       [1,   3,   8,   20],
  'J':       [0.8, 2,   6,   15],
  '10':      [0.5, 1.5, 4,   10],
};

const COLS = 6;
const ROWS = 4;

// Standard weighted pool
const makePool = (enhancer = 'none') => {
  const base = [
    ...Array(26).fill('10'),
    ...Array(20).fill('J'),
    ...Array(16).fill('Q'),
    ...Array(12).fill('K'),
    ...Array(9).fill('A'),
    ...Array(6).fill('SHOE'),
    ...Array(5).fill('WHISKEY'),
    ...Array(4).fill('CACTUS'),
    ...Array(3).fill('COWBOY'),
    ...Array(4).fill('WILD'),
    ...Array(2).fill('SCATTER'),
    ...Array(1).fill('REVOLVER'),
    ...Array(1).fill('COIN_G'),
    ...Array(1).fill('COIN_S'),
  ];
  if (enhancer === 'E1' || enhancer === 'B1') {
    // 4x more scatters
    return [...base, ...Array(6).fill('SCATTER'), ...Array(3).fill('COIN_G'), ...Array(3).fill('COIN_S')];
  }
  if (enhancer === 'E2' || enhancer === 'B2') {
    // Silver/gold coins only (no low symbols on some reels)
    return [...base, ...Array(8).fill('COIN_G'), ...Array(8).fill('COIN_S'), ...Array(3).fill('SCATTER')];
  }
  return base;
};

// ─── 20 WIN LINES (6×4 grid) ─────────────────────────────────────────────────
const WIN_LINES = [
  // 5 horizontal lines (top to bottom)
  [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]], // line 1 - top row
  [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1]], // line 2
  [[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]], // line 3
  [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3]], // line 4 - bottom
  // V shapes
  [[0,0],[1,1],[2,2],[3,1],[4,0],[5,0]], // line 5
  [[0,3],[1,2],[2,1],[3,2],[4,3],[5,3]], // line 6
  [[0,1],[1,0],[2,1],[3,0],[4,1],[5,1]], // line 7
  [[0,2],[1,3],[2,2],[3,3],[4,2],[5,2]], // line 8
  [[0,0],[1,1],[2,1],[3,1],[4,0],[5,0]], // line 9
  [[0,3],[1,2],[2,2],[3,2],[4,3],[5,3]], // line 10
  // Zigzags
  [[0,1],[1,0],[2,0],[3,0],[4,1],[5,1]], // line 11
  [[0,2],[1,3],[2,3],[3,3],[4,2],[5,2]], // line 12
  [[0,0],[1,0],[2,1],[3,0],[4,0],[5,0]], // line 13
  [[0,3],[1,3],[2,2],[3,3],[4,3],[5,3]], // line 14
  [[0,1],[1,1],[2,0],[3,1],[4,1],[5,1]], // line 15
  [[0,2],[1,2],[2,3],[3,2],[4,2],[5,2]], // line 16
  [[0,0],[1,1],[2,0],[3,1],[4,2],[5,3]], // line 17 diagonal
  [[0,3],[1,2],[2,3],[3,2],[4,1],[5,0]], // line 18 diagonal
  [[0,1],[1,2],[2,3],[3,2],[4,1],[5,0]], // line 19
  [[0,2],[1,1],[2,0],[3,1],[4,2],[5,3]], // line 20
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function randItem(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeGrid(pool) {
  return Array(COLS).fill(null).map(() =>
    Array(ROWS).fill(null).map(() => randItem(pool))
  );
}

function checkWins(grid, bet) {
  let totalWin = 0;
  const winCells = new Set();
  const winDetails = [];

  for (const line of WIN_LINES) {
    const symbols = line.map(([c, r]) => grid[c][r]);
    // Replace wilds for matching
    const nonWild = symbols.filter(s => s !== 'WILD' && s !== 'SCATTER' && s !== 'REVOLVER' && s !== 'COIN_G' && s !== 'COIN_S');
    if (nonWild.length === 0) continue;
    const mainSym = nonWild[0];
    if (!PAY[mainSym]) continue;

    // Count consecutive from left (wild counts)
    let count = 0;
    for (let i = 0; i < COLS; i++) {
      const s = symbols[i];
      if (s === mainSym || s === 'WILD') count++;
      else break;
    }

    if (count >= 3) {
      const payIdx = count - 3; // 0=3ofkind, 1=4, 2=5, 3=6
      const mult = PAY[mainSym][Math.min(payIdx, 3)];
      const win = bet * mult;
      totalWin += win;
      for (let i = 0; i < count; i++) {
        winCells.add(`${line[i][0]},${line[i][1]}`);
      }
      winDetails.push({ sym: mainSym, count, mult, win });
    }
  }

  return { totalWin, winCells, winDetails };
}

function countScatters(grid) {
  let count = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r] === 'SCATTER') count++;
  return count;
}

function findRevolvers(grid) {
  const revolvers = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r] === 'REVOLVER') revolvers.push([c, r]);
  return revolvers;
}

function findCoins(grid) {
  const coins = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r] === 'COIN_G' || grid[c][r] === 'COIN_S') coins.push([c, r]);
  return coins;
}

// Find highest-value winning symbol for respin lock
function findBestWinSymbol(grid, winCells) {
  let best = null;
  let bestRank = 0;
  winCells.forEach(key => {
    const [c, r] = key.split(',').map(Number);
    const s = grid[c][r];
    const rank = SYMBOL_RANK[s] || 0;
    if (rank > bestRank) { bestRank = rank; best = s; }
  });
  return best;
}

// ─── SYMBOL CELL ─────────────────────────────────────────────────────────────
function SymbolCell({ symId, isWin = false, isLocked = false }) {
  const sym = Object.values(SYM).find(s => s.id === symId);
  if (!sym) return null;
  const isCard = ['10', 'J', 'Q', 'K', 'A'].includes(symId);
  const isSpecial = ['WILD', 'SCATTER', 'REVOLVER', 'COIN_G', 'COIN_S'].includes(symId);

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center rounded-md transition-all duration-200 relative
      ${isLocked ? 'ring-4 ring-yellow-400 ring-opacity-100' : ''}
      ${isWin ? 'ring-2 ring-green-400' : ''}
      ${isCard ? 'bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600' : 
        isSpecial ? 'bg-gradient-to-b from-amber-800/60 to-amber-950/80 border border-amber-600' :
        'bg-gradient-to-b from-amber-900/60 to-amber-950/80 border border-amber-700'}`}
      style={isLocked ? { boxShadow: '0 0 12px 3px rgba(255,220,0,0.6)' } : {}}>
      {sym.image ? (
        <img src={sym.image} alt={sym.label} className="w-10 h-10 object-contain" />
      ) : isCard ? (
        <span className="text-xl font-black" style={{ color: sym.color }}>{sym.emoji}</span>
      ) : (
        <span className="text-2xl leading-none">{sym.emoji}</span>
      )}
      {isSpecial && (
        <span className="text-[8px] font-bold mt-0.5 tracking-widest" style={{ color: sym.color }}>{sym.label}</span>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CactusCassidySlot({ wallet, onBet, currency = 'IC' }) {
  const [grid, setGrid] = useState(() => makeGrid(makePool()));
  const [spinning, setSpinning] = useState(false);
  const [droppingCols, setDroppingCols] = useState(Array(COLS).fill(false));
  const [exitingCols, setExitingCols] = useState(Array(COLS).fill(false));

  const [bet, setBet] = useState(1);
  const [lastWin, setLastWin] = useState(0);
  const [winCells, setWinCells] = useState(new Set());
  const [showWin, setShowWin] = useState(false);
  const [winMessage, setWinMessage] = useState('');

  // Respin
  const [respinActive, setRespinActive] = useState(false);
  const [lockedCells, setLockedCells] = useState(new Set());
  const [lockedSymbol, setLockedSymbol] = useState(null);

  // Free Games
  const [freeGames, setFreeGames] = useState(0);
  const [freeGamesActive, setFreeGamesActive] = useState(false);
  const [collectorTrail, setCollectorTrail] = useState(Array(COLS).fill(0)); // 0-2 hits per reel

  // Revolver
  const [revolverAnim, setRevolverAnim] = useState(null); // { multiplier, bullets, coins }

  // Auto play
  const [betMode, setBetMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({ numGames: 10, stopOnWin: 0, stopOnLoss: 0 });
  const [autoStats, setAutoStats] = useState({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoRunRef = useRef(false);

  // Enhancers/Bonuses
  const [showEnhancers, setShowEnhancers] = useState(false);
  const [activeMode, setActiveMode] = useState('standard'); // standard|E1|E2|B1|B2
  const [showRules, setShowRules] = useState(false);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const sounds = useSlotSounds();

  // ── Effective bet based on mode ──────────────────────────────────────────
  const effectiveBet = activeMode === 'E1' ? bet * 2
    : activeMode === 'E2' ? bet * 10
    : activeMode === 'B1' ? bet * 100
    : activeMode === 'B2' ? bet * 500
    : bet;

  // ── Animate grid drop ────────────────────────────────────────────────────
  const animateGrid = async (newGrid, colsToSpin = null) => {
    const cols = colsToSpin || Array(COLS).fill(null).map((_, i) => i);

    sounds.playSpinStart();
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      await new Promise(r => setTimeout(r, 50 * i));
      setExitingCols(prev => { const n = [...prev]; n[col] = true; return n; });
    }
    await new Promise(r => setTimeout(r, 300));
    setExitingCols(Array(COLS).fill(false));

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      await new Promise(r => setTimeout(r, 80 * i));
      setGrid(prev => {
        const g = prev.map(c => [...c]);
        g[col] = newGrid[col];
        return g;
      });
      setDroppingCols(prev => { const n = [...prev]; n[col] = true; return n; });
      sounds.playReelStop(i);
      setTimeout(() => setDroppingCols(prev => { const n = [...prev]; n[col] = false; return n; }), 350);
    }
    await new Promise(r => setTimeout(r, 400));
  };

  // ── Revolver feature ────────────────────────────────────────────────────
  const handleRevolvers = async (currentGrid, bet, framedCells) => {
    const revolvers = findRevolvers(currentGrid);
    if (revolvers.length === 0 && framedCells.size === 0) return { win: 0, newGrid: currentGrid };

    // Convert framed positions to coins
    const workGrid = currentGrid.map(c => [...c]);
    let allCoins = [];
    framedCells.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      workGrid[c][r] = 'COIN_G';
      allCoins.push([c, r, Math.floor(Math.random() * 5) + 1]); // coin value 1-5x bet
    });
    // Also find existing coins
    findCoins(currentGrid).forEach(([c, r]) => {
      if (!framedCells.has(`${c},${r}`)) {
        allCoins.push([c, r, Math.floor(Math.random() * 5) + 1]);
      }
    });

    setGrid([...workGrid]);

    let totalRevolverWin = 0;
    for (const [rc, rr] of revolvers) {
      const multiplier = [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)];
      const bullets = allCoins.length;
      setRevolverAnim({ col: rc, row: rr, multiplier, bullets, shooting: true });
      await new Promise(r => setTimeout(r, 400));

      for (const [cc, cr, coinVal] of allCoins) {
        await new Promise(r => setTimeout(r, 200));
        totalRevolverWin += coinVal * bet * multiplier;
      }
      setRevolverAnim(null);
      await new Promise(r => setTimeout(r, 300));
    }

    return { win: totalRevolverWin, newGrid: workGrid };
  };

  // ── Core spin logic ──────────────────────────────────────────────────────
  const doSpin = useCallback(async (isFreeSpin = false, currentLockedCells = new Set(), currentLockedSym = null, currentFG = 0, currentTrail = Array(COLS).fill(0)) => {
    const pool = makePool(activeMode === 'B2' || activeMode === 'E2' ? 'E2' : activeMode === 'B1' || activeMode === 'E1' ? 'E1' : 'none');

    // Generate new grid, respecting locked cells
    const newGrid = Array(COLS).fill(null).map((_, c) =>
      Array(ROWS).fill(null).map((_, r) => {
        const key = `${c},${r}`;
        if (currentLockedCells.has(key)) return currentLockedSym; // locked cell stays
        // During respin, only allowed symbols
        if (currentLockedSym) {
          const respinPool = [
            ...Array(30).fill(currentLockedSym),
            ...Array(10).fill('WILD'),
            ...Array(5).fill('SCATTER'),
            ...Array(5).fill('REVOLVER'),
          ];
          return randItem(respinPool);
        }
        return randItem(pool);
      })
    );

    // Animate cols that are NOT locked
    const colsToSpin = Array(COLS).fill(null).map((_, i) => i)
      .filter(c => Array(ROWS).fill(null).every((_, r) => !currentLockedCells.has(`${c},${r}`)));
    await animateGrid(newGrid, colsToSpin.length > 0 ? colsToSpin : null);
    setGrid(newGrid);

    // Check scatters for free games
    const scatterCount = countScatters(newGrid);
    let newFG = currentFG;
    let fgTriggered = false;
    if (!isFreeSpin && scatterCount >= 4) {
      const fgMap = { 4: 8, 5: 12, 6: 16 };
      newFG = fgMap[Math.min(scatterCount, 6)] || 8;
      fgTriggered = true;
    }

    // Check wins
    const { totalWin, winCells: wc, winDetails } = checkWins(newGrid, effectiveBet);
    setWinCells(wc);

    // Revolver feature
    let revolverWin = 0;
    const revolvers = findRevolvers(newGrid);
    if (revolvers.length > 0 || currentLockedCells.size > 0) {
      const result = await handleRevolvers(newGrid, effectiveBet, currentLockedCells);
      revolverWin = result.win;
    }

    const totalRoundWin = totalWin + revolverWin;

    // Respin check: random chance after any win
    let newLockedCells = new Set();
    let newLockedSym = null;
    let shouldRespin = false;

    if (totalWin > 0 && wc.size > 0) {
      const respinChance = Math.random();
      if (respinChance < 0.30) { // 30% chance of respin
        const bestSym = findBestWinSymbol(newGrid, wc);
        if (bestSym && bestSym !== 'WILD' && bestSym !== 'SCATTER') {
          // Lock winning cells with that symbol
          wc.forEach(key => {
            const [c, r] = key.split(',').map(Number);
            if (newGrid[c][r] === bestSym) newLockedCells.add(key);
          });
          newLockedSym = bestSym;
          shouldRespin = newLockedCells.size > 0;
        }
      }
    }

    // Collector trail update during free games
    let newTrail = [...currentTrail];
    if (isFreeSpin && revolvers.length > 0) {
      revolvers.forEach(([c]) => {
        newTrail[c] = (newTrail[c] || 0) + 1;
        if (newTrail[c] >= 3) {
          newFG += 3;
          newTrail[c] = 0;
        }
      });
    }

    return {
      totalWin: totalRoundWin,
      shouldRespin,
      newLockedCells,
      newLockedSym,
      fgTriggered,
      newFG,
      newGrid,
      newTrail,
    };
  }, [activeMode, effectiveBet]);

  // ── Full round handler ───────────────────────────────────────────────────
  const playRound = useCallback(async () => {
    if (spinning) return;
    if (effectiveBet > balance) return;
    setSpinning(true);
    setShowWin(false);
    setLastWin(0);
    setWinCells(new Set());
    setLockedCells(new Set());
    setLockedSymbol(null);
    setRespinActive(false);

    let roundTotalWin = 0;
    let currentLockedCells = new Set();
    let currentLockedSym = null;
    let currentFG = freeGamesActive ? freeGames : 0;
    let currentTrail = collectorTrail;

    // Initial spin
    const result = await doSpin(freeGamesActive, currentLockedCells, null, currentFG, currentTrail);
    roundTotalWin += result.totalWin;
    currentLockedCells = result.newLockedCells;
    currentLockedSym = result.newLockedSym;
    currentFG = result.newFG;
    currentTrail = result.newTrail;

    if (result.fgTriggered && !freeGamesActive) {
      sounds.playBonus();
      setFreeGames(currentFG);
      setFreeGamesActive(true);
      setWinMessage(`🌟 FREE GAMES! ${currentFG} spins awarded!`);
      setShowWin(true);
      await new Promise(r => setTimeout(r, 2000));
      setShowWin(false);
    }

    // Respin loop
    if (result.shouldRespin) {
      setRespinActive(true);
      setLockedCells(currentLockedCells);
      setLockedSymbol(currentLockedSym);

      let respinCount = 0;
      while (respinCount < 5) {
        await new Promise(r => setTimeout(r, 500));
        const rr = await doSpin(freeGamesActive, currentLockedCells, currentLockedSym, currentFG, currentTrail);
        roundTotalWin += rr.totalWin;

        // Add new locks
        rr.newLockedCells.forEach(k => currentLockedCells.add(k));
        setLockedCells(new Set(currentLockedCells));

        // Revolver from framed positions
        const revolvers = findRevolvers(Array.from(currentLockedCells).reduce((g, k) => {
          const [c, row] = k.split(',').map(Number);
          g[c][row] = currentLockedSym;
          return g;
        }, makeGrid(makePool())));

        if (revolvers.length > 0) {
          const rv = await handleRevolvers(
            Array.from(currentLockedCells).reduce((g, k) => {
              const [c, row] = k.split(',').map(Number);
              g[c][row] = currentLockedSym;
              return g;
            }, makeGrid(makePool())),
            effectiveBet, currentLockedCells
          );
          roundTotalWin += rv.win;
          break; // Revolver ends respin
        }

        if (rr.newLockedCells.size === 0) break; // No new matches → end respin
        respinCount++;
      }

      setRespinActive(false);
      setLockedCells(new Set());
      setLockedSymbol(null);
    }

    // Free games loop
    if (currentFG > 0 && !freeGamesActive) {
      setFreeGamesActive(true);
      let fg = currentFG;
      while (fg > 0) {
        setFreeGames(fg);
        await new Promise(r => setTimeout(r, 800));
        const fr = await doSpin(true, new Set(), null, fg, currentTrail);
        roundTotalWin += fr.totalWin;
        currentTrail = fr.newTrail;
        setCollectorTrail([...currentTrail]);
        fg = fr.newFG - 1;
        if (fr.fgTriggered) fg += fr.newFG; // Retrigger
      }
      setFreeGames(0);
      setFreeGamesActive(false);
      setCollectorTrail(Array(COLS).fill(0));
    }

    // Handle free game decrement
    if (freeGamesActive && currentFG > 0) {
      setFreeGames(Math.max(0, currentFG - 1));
      if (currentFG <= 1) {
        setFreeGamesActive(false);
        setCollectorTrail(Array(COLS).fill(0));
      }
    }

    // Apply win cap: 25,000x standard, 50,000x enhanced
    const maxWin = activeMode === 'standard' ? bet * 25000 : effectiveBet * 50000;
    const finalWin = Math.min(roundTotalWin, maxWin);

    setLastWin(finalWin);
    if (finalWin > 0) {
      setShowWin(true);
      setWinMessage(finalWin >= bet * 100 ? '🤠 BIG WIN! YEEHAW! 🤠' : finalWin >= bet * 20 ? '🌵 GREAT WIN! 🌵' : '⭐ WIN! ⭐');
      if (finalWin >= bet * 100) sounds.playBigWin();
      else sounds.playWin();
    }

    await onBet(effectiveBet, finalWin, 'cactus-cassidy');
    setSpinning(false);

    // Auto play continuation
    if (autoRunRef.current && betMode === 'auto') {
      const newStats = {
        gamesPlayed: autoStats.gamesPlayed + 1,
        totalWon: autoStats.totalWon + (finalWin > 0 ? finalWin : 0),
        totalLost: autoStats.totalLost + (finalWin === 0 ? effectiveBet : 0),
      };
      setAutoStats(newStats);
      const shouldStop =
        (autoConfig.numGames > 0 && newStats.gamesPlayed >= autoConfig.numGames) ||
        (autoConfig.stopOnWin > 0 && newStats.totalWon >= autoConfig.stopOnWin) ||
        (autoConfig.stopOnLoss > 0 && newStats.totalLost >= autoConfig.stopOnLoss) ||
        (finalWin > 0 && autoConfig.stopOnWin === -1); // stop on any win
      if (shouldStop) {
        autoRunRef.current = false;
        setIsAutoRunning(false);
      } else {
        setTimeout(() => playRound(), 1200);
      }
    }
  }, [spinning, effectiveBet, balance, freeGamesActive, freeGames, collectorTrail, doSpin, onBet, activeMode, bet, betMode, autoStats, autoConfig]);

  const startAuto = () => {
    autoRunRef.current = true;
    setIsAutoRunning(true);
    setAutoStats({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
    playRound();
  };

  const stopAuto = () => {
    autoRunRef.current = false;
    setIsAutoRunning(false);
  };

  const BET_PRESETS = [0.20, 0.50, 1, 2, 5, 10, 25, 50, 100, 200];

  return (
    <div className="max-w-2xl mx-auto select-none" style={{ fontFamily: "'Trebuchet MS', sans-serif" }}>

      {/* ── Rules Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-[#1a0e00] border-2 border-amber-600 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-black text-amber-400 mb-4 text-center">🤠 CACTUS CASSIDY RULES</h2>
              <div className="space-y-3 text-sm text-amber-100">
                <p><strong className="text-amber-400">Grid:</strong> 6×4, awards on 20 Win-Lines. Match 3+ symbols left-to-right.</p>
                <p><strong className="text-amber-400">Wild (⭐):</strong> Substitutes for all symbols except Scatter, Revolver & Coins.</p>
                <p><strong className="text-amber-400">Respin Feature:</strong> After any win, may randomly lock highest-value symbol. Remaining reels respin with only that symbol + Wild/Scatter/Revolver eligible. Continues until no new matches land.</p>
                <p><strong className="text-amber-400">Revolver & Coin:</strong> Revolver has a multiplier and bullets. Each bullet shoots a coin applying the multiplier. Multiple Revolvers operate in sequence.</p>
                <p><strong className="text-amber-400">Free Games:</strong> 4/5/6 Scatters = 8/12/16 Free Games. All respin & coin mechanics active. Collector Trail: 3 bullet hits on a reel trail = +3 Free Games.</p>
                <p><strong className="text-amber-400">Max Win:</strong> Standard = 25,000× | Enhanced/Bonus = 50,000×</p>
                <div className="border-t border-amber-700 pt-2">
                  <p className="font-bold text-amber-400 mb-1">Game Enhancers:</p>
                  <p>• Enhancer 1 (2× bet): 4× Free Games trigger chance</p>
                  <p>• Enhancer 2 (10× bet): Silver/Gold coins only + 4× Free Games chance</p>
                  <p>• Bonus 1 (100× bet): Immediately enter Free Games with 4+ Scatters</p>
                  <p>• Bonus 2 (500× bet): Free Games with silver/gold coins only</p>
                </div>
              </div>
              <button onClick={() => setShowRules(false)} className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl">CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Enhancers Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showEnhancers && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowEnhancers(false)}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-[#1a0e00] border-2 border-amber-600 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-black text-amber-400 mb-4 text-center">⚡ GAME ENHANCERS</h2>
              <div className="space-y-2">
                {[
                  { id: 'standard', label: 'Standard', cost: '1×', desc: 'Normal play. Max 25,000×', rtp: '96.55%' },
                  { id: 'E1', label: 'Enhancer 1', cost: '2×', desc: '4× Free Games chance. Max 50,000×', rtp: '96.70%' },
                  { id: 'E2', label: 'Enhancer 2', cost: '10×', desc: 'Silver/Gold coins + 4× FG chance. Max 50,000×', rtp: '96.62%' },
                  { id: 'B1', label: 'Bonus 1', cost: '100×', desc: 'Instantly buy into Free Games! Max 50,000×', rtp: '96.68%' },
                  { id: 'B2', label: 'Bonus 2', cost: '500×', desc: 'Free Games + coins only. Max 50,000×', rtp: '96.68%' },
                ].map(m => (
                  <button key={m.id} onClick={() => { setActiveMode(m.id); setShowEnhancers(false); }}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${activeMode === m.id ? 'border-amber-400 bg-amber-800/40' : 'border-amber-800/40 bg-amber-950/40 hover:border-amber-600'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-300">{m.label}</span>
                      <span className="text-amber-400 font-black">{m.cost} bet</span>
                    </div>
                    <p className="text-xs text-amber-200 mt-0.5">{m.desc}</p>
                    <p className="text-xs text-green-400 mt-0.5">RTP: {m.rtp}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowEnhancers(false)} className="mt-3 w-full py-2 bg-amber-600 text-black font-black rounded-xl">CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Machine Frame ─────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-700"
        style={{ background: 'linear-gradient(180deg, #1a0500 0%, #2d0f00 30%, #3d1800 100%)' }}>

        {/* Title */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setShowRules(true)} className="p-2 rounded-lg bg-amber-900/60 hover:bg-amber-800/60 text-amber-300">
            <Info className="w-4 h-4" />
          </button>
          <div className="text-center">
            <div className="text-2xl font-black tracking-widest" style={{ color: '#FFD700', textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
              🤠 CACTUS CASSIDY 🌵
            </div>
            {activeMode !== 'standard' && (
              <div className="text-xs font-bold text-orange-400 tracking-widest">
                {activeMode === 'E1' ? '⚡ ENHANCER 1 ACTIVE' : activeMode === 'E2' ? '⚡ ENHANCER 2 ACTIVE' : activeMode === 'B1' ? '🎁 BONUS 1 ACTIVE' : '🎁 BONUS 2 ACTIVE'}
              </div>
            )}
            {freeGamesActive && (
              <div className="text-sm font-black text-yellow-300 animate-pulse">⭐ FREE GAMES: {freeGames} LEFT ⭐</div>
            )}
          </div>
          <button onClick={() => setShowEnhancers(true)} className="p-2 rounded-lg bg-amber-900/60 hover:bg-amber-800/60 text-amber-300">
            <Zap className="w-4 h-4" />
          </button>
        </div>

        {/* Collector Trail (during free games) */}
        {freeGamesActive && (
          <div className="px-4 pb-1 flex gap-1">
            {Array(COLS).fill(null).map((_, i) => (
              <div key={i} className="flex-1 flex gap-0.5 justify-center">
                {[0, 1, 2].map(pos => (
                  <div key={pos} className={`w-2 h-2 rounded-full ${collectorTrail[i] > pos ? 'bg-yellow-400' : 'bg-amber-900/60 border border-amber-700'}`} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Respin indicator */}
        {respinActive && (
          <div className="px-4 py-1 text-center">
            <span className="text-xs font-black text-yellow-300 tracking-widest animate-pulse">🔒 RESPIN — LOCKED: {lockedSymbol}</span>
          </div>
        )}

        {/* ── Reel Window ────────────────────────────────────────── */}
        <div className="mx-3 mb-2 rounded-xl overflow-hidden border-4 border-amber-700/80 relative"
          style={{ background: '#0a0400', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.9)' }}>

          {/* Win overlay */}
          <AnimatePresence>
            {showWin && lastWin > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 cursor-pointer"
                onClick={() => setShowWin(false)}>
                <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}
                  className="text-5xl font-black" style={{ color: '#FFD700', textShadow: '0 0 30px rgba(255,200,0,0.9)' }}>
                  +{lastWin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </motion.div>
                <div className="text-lg font-bold text-amber-300 mt-1">{winMessage}</div>
                <div className="text-xs text-amber-400 mt-2">Tap to continue</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Revolver animation overlay */}
          <AnimatePresence>
            {revolverAnim && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.4 }}
                  className="text-center">
                  <div className="text-5xl">🔫</div>
                  <div className="text-2xl font-black text-amber-400">×{revolverAnim.multiplier}</div>
                  <div className="text-sm text-amber-300">{revolverAnim.bullets} bullets!</div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div className="grid gap-0.5 p-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {Array(COLS).fill(null).map((_, col) => (
              <div key={col} className="flex flex-col gap-0.5">
                {Array(ROWS).fill(null).map((_, row) => {
                  const key = `${col},${row}`;
                  const isWin = winCells.has(key);
                  const isLocked = lockedCells.has(key);
                  return (
                    <motion.div key={row} className="h-12"
                      animate={
                        exitingCols[col] ? { y: 60, opacity: 0 }
                          : droppingCols[col] ? { y: [-60, 0], opacity: [0, 1] }
                          : { y: 0, opacity: 1 }
                      }
                      transition={{ duration: 0.32, ease: 'easeOut', delay: droppingCols[col] ? row * 0.03 : 0 }}>
                      <SymbolCell symId={grid[col]?.[row] || '10'} isWin={isWin} isLocked={isLocked} />
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="px-3 pb-3">
          {/* Stats bar */}
          <div className="flex items-center justify-between text-xs text-amber-300 mb-2 px-1 bg-black/30 rounded-lg py-2">
            <div>
              <div className="text-amber-500 font-bold text-[10px]">COINS</div>
              <div className="font-bold">{balance.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-amber-500 font-bold text-[10px]">WIN</div>
              <div className={`font-black text-base ${lastWin > 0 ? 'text-yellow-300' : ''}`}>
                {lastWin > 0 ? lastWin.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-amber-500 font-bold text-[10px]">SPIN</div>
              <div className="font-bold">{effectiveBet.toFixed(2)}</div>
            </div>
          </div>

          {/* Bet mode tabs */}
          <div className="flex gap-1 bg-black/40 rounded-xl p-1 mb-2">
            {['manual', 'auto'].map(m => (
              <button key={m} onClick={() => setBetMode(m)}
                className={`flex-1 py-1.5 rounded-lg font-bold text-sm capitalize transition-all ${betMode === m ? 'bg-amber-600 text-black' : 'text-amber-400 hover:text-amber-200'}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Auto config */}
          {betMode === 'auto' && (
            <div className="bg-black/40 rounded-xl p-3 space-y-2 mb-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-amber-400 font-bold mb-1 block">NUM GAMES</label>
                  <input type="number" value={autoConfig.numGames}
                    onChange={e => setAutoConfig(p => ({ ...p, numGames: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-black/60 border border-amber-800/40 rounded-lg px-2 py-1 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-amber-400 font-bold mb-1 block">STOP WIN</label>
                  <input type="number" value={autoConfig.stopOnWin}
                    onChange={e => setAutoConfig(p => ({ ...p, stopOnWin: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-black/60 border border-amber-800/40 rounded-lg px-2 py-1 text-white text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-amber-400 font-bold mb-1 block">STOP LOSS</label>
                  <input type="number" value={autoConfig.stopOnLoss}
                    onChange={e => setAutoConfig(p => ({ ...p, stopOnLoss: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-black/60 border border-amber-800/40 rounded-lg px-2 py-1 text-white text-sm" />
                </div>
              </div>
              {isAutoRunning && (
                <div className="flex justify-between text-xs text-amber-300">
                  <span>Played: {autoStats.gamesPlayed}</span>
                  <span className="text-green-400">Won: +{autoStats.totalWon.toFixed(2)}</span>
                  <span className="text-red-400">Lost: -{autoStats.totalLost.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Bet selector */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-xs font-bold">BET:</span>
            <div className="flex flex-wrap gap-1 flex-1">
              {BET_PRESETS.map(p => (
                <button key={p} onClick={() => setBet(p)} disabled={spinning}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${bet === p ? 'bg-amber-500 text-black' : 'bg-amber-900/60 text-amber-300 hover:bg-amber-800/60'}`}>
                  {p}
                </button>
              ))}
            </div>
            {activeMode !== 'standard' && (
              <span className="text-xs text-orange-400 font-bold whitespace-nowrap">={effectiveBet}</span>
            )}
          </div>

          {/* Spin button */}
          {betMode === 'auto' ? (
            <Button onClick={isAutoRunning ? stopAuto : startAuto}
              disabled={spinning && !isAutoRunning}
              className={`w-full h-12 text-lg font-black rounded-xl ${isAutoRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
              {isAutoRunning ? '⛔ STOP AUTO' : '🔄 START AUTO'}
            </Button>
          ) : (
            <Button onClick={playRound} disabled={spinning || effectiveBet > balance}
              className="w-full h-12 text-lg font-black rounded-xl text-black"
              style={{ background: spinning ? '#555' : 'linear-gradient(135deg, #FFD700, #FF8C00)', boxShadow: spinning ? 'none' : '0 4px 20px rgba(255,165,0,0.5)' }}>
              {spinning
                ? <><RotateCcw className="w-5 h-5 animate-spin mr-2" />SPINNING...</>
                : freeGamesActive ? <><Star className="w-5 h-5 mr-2" />FREE SPIN ({freeGames} left)</>
                : <><span className="mr-2">🤠</span>SPIN</>}
            </Button>
          )}
        </div>
      </div>

      {/* ── Paytable ──────────────────────────────────────────────── */}
      <div className="mt-4 p-4 bg-amber-950/80 rounded-xl border border-amber-800">
        <h3 className="text-sm font-black text-amber-400 mb-3 text-center">🤠 PAYTABLE (×bet per line)</h3>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {Object.entries(PAY).map(([sym, pays]) => {
            const s = Object.values(SYM).find(x => x.id === sym);
            return (
              <div key={sym} className="flex items-center justify-between px-2 py-1.5 bg-amber-900/30 rounded-lg">
                <span className="font-bold text-white">{s?.emoji} {s?.label}</span>
                <span className="text-amber-400 text-[10px]">{pays[0]}/ {pays[1]}/ {pays[2]}/ {pays[3]}x</span>
              </div>
            );
          })}
        </div>
        <p className="text-center text-[10px] text-amber-600 mt-2">3× / 4× / 5× / 6× of a kind on 20 lines</p>
      </div>
    </div>
  );
}