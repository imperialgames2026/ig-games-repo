import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Info, Zap, Star } from 'lucide-react';
import useSlotSounds from '@/hooks/useSlotSounds';

// ─── 20 WIN LINES on a 6×4 grid ──────────────────────────────────────────────
export const WIN_LINES = [
  [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]],
  [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1]],
  [[0,2],[1,2],[2,2],[3,2],[4,2],[5,2]],
  [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3]],
  [[0,0],[1,1],[2,2],[3,1],[4,0],[5,0]],
  [[0,3],[1,2],[2,1],[3,2],[4,3],[5,3]],
  [[0,1],[1,0],[2,1],[3,0],[4,1],[5,1]],
  [[0,2],[1,3],[2,2],[3,3],[4,2],[5,2]],
  [[0,0],[1,1],[2,1],[3,1],[4,0],[5,0]],
  [[0,3],[1,2],[2,2],[3,2],[4,3],[5,3]],
  [[0,1],[1,0],[2,0],[3,0],[4,1],[5,1]],
  [[0,2],[1,3],[2,3],[3,3],[4,2],[5,2]],
  [[0,0],[1,0],[2,1],[3,0],[4,0],[5,0]],
  [[0,3],[1,3],[2,2],[3,3],[4,3],[5,3]],
  [[0,1],[1,1],[2,0],[3,1],[4,1],[5,1]],
  [[0,2],[1,2],[2,3],[3,2],[4,2],[5,2]],
  [[0,0],[1,1],[2,0],[3,1],[4,2],[5,3]],
  [[0,3],[1,2],[2,3],[3,2],[4,1],[5,0]],
  [[0,1],[1,2],[2,3],[3,2],[4,1],[5,0]],
  [[0,2],[1,1],[2,0],[3,1],[4,2],[5,3]],
];

export const COLS = 6;
export const ROWS = 4;

export function randItem(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function makeGrid(pool) {
  return Array(COLS).fill(null).map(() =>
    Array(ROWS).fill(null).map(() => randItem(pool))
  );
}

// Check all 20 win lines; returns { totalWin, winCells, winDetails }
export function checkWins(grid, bet, pay, wildId, specialIds = []) {
  let totalWin = 0;
  const winCells = new Set();

  for (const line of WIN_LINES) {
    const symbols = line.map(([c, r]) => grid[c][r]);
    const nonWild = symbols.filter(s => s !== wildId && !specialIds.includes(s));
    if (nonWild.length === 0) continue;
    const mainSym = nonWild[0];
    if (!pay[mainSym]) continue;

    let count = 0;
    for (let i = 0; i < COLS; i++) {
      if (symbols[i] === mainSym || symbols[i] === wildId) count++;
      else break;
    }

    if (count >= 3) {
      const payIdx = Math.min(count - 3, 3);
      const mult = pay[mainSym][payIdx];
      totalWin += bet * mult;
      for (let i = 0; i < count; i++) winCells.add(`${line[i][0]},${line[i][1]}`);
    }
  }
  return { totalWin, winCells };
}

export function countSymbol(grid, symId) {
  let n = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r] === symId) n++;
  return n;
}

// ─── SHARED SLOT ENGINE COMPONENT ────────────────────────────────────────────
export default function SlotEngine({
  // Theme
  title,
  titleEmoji,
  accentColor,       // tailwind color name e.g. 'violet'
  bgGradient,        // inline style string for machine bg
  borderColor,       // e.g. 'border-violet-500'
  spinBtnStyle,      // inline style for spin button

  // Game config
  config,            // { symbols, pay, pool, wildId, scatterId, gameSlug, specialIds }
  wallet,
  onBet,
  currency,

  // Optional: special feature per-slot
  bonusFeature,      // { name, description, triggerChance, onTrigger }
  winLabel,          // e.g. "COSMIC WIN!"
}) {
  const COLS = 6, ROWS = 4;
  const { symbols, pay, pool, wildId, scatterId, gameSlug, specialIds = [] } = config;

  const initGrid = () => makeGrid(pool);
  const [grid, setGrid] = useState(initGrid);
  const [spinning, setSpinning] = useState(false);
  const [dropping, setDropping] = useState(Array(COLS).fill(false));
  const [exiting, setExiting] = useState(Array(COLS).fill(false));
  const [winCells, setWinCells] = useState(new Set());
  const [lockedCells, setLockedCells] = useState(new Set());
  const [lockedSym, setLockedSym] = useState(null);
  const [respinActive, setRespinActive] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const [winMsg, setWinMsg] = useState('');
  const [freeGames, setFreeGames] = useState(0);
  const [freeActive, setFreeActive] = useState(false);
  const [bonusAnim, setBonusAnim] = useState(null);
  const [bet, setBet] = useState(0.1);
  const [betMode, setBetMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({ numGames: 10, stopOnWin: 0, stopOnLoss: 0 });
  const [autoStats, setAutoStats] = useState({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const autoRef = useRef(false);
  const sounds = useSlotSounds();

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const BET_PRESETS = [0.10, 0.20, 0.50, 1, 2, 5, 10, 25, 50, 100];

  const animateReels = async (newGrid, cols = null) => {
    const c = cols || Array(COLS).fill(null).map((_, i) => i);
    sounds.playSpinStart();
    for (let i = 0; i < c.length; i++) {
      await new Promise(r => setTimeout(r, 45 * i));
      setExiting(prev => { const n = [...prev]; n[c[i]] = true; return n; });
    }
    await new Promise(r => setTimeout(r, 280));
    setExiting(Array(COLS).fill(false));
    for (let i = 0; i < c.length; i++) {
      await new Promise(r => setTimeout(r, 70 * i));
      setGrid(prev => { const g = prev.map(x => [...x]); g[c[i]] = newGrid[c[i]]; return g; });
      setDropping(prev => { const n = [...prev]; n[c[i]] = true; return n; });
      sounds.playReelStop(i);
      setTimeout(() => setDropping(prev => { const n = [...prev]; n[c[i]] = false; return n; }), 320);
    }
    await new Promise(r => setTimeout(r, 380));
  };

  const playRound = useCallback(async () => {
    if (spinning || bet > balance) return;
    setSpinning(true);
    setShowWin(false);
    setLastWin(0);
    setWinCells(new Set());
    setLockedCells(new Set());
    setLockedSym(null);
    setRespinActive(false);

    // Deduct bet immediately
    await onBet(bet, 0, gameSlug);

    let roundWin = 0;

    // ── spin ──
    const newGrid = makeGrid(pool);
    await animateReels(newGrid);
    setGrid(newGrid);

    // ── check wins ──
    const { totalWin, winCells: wc } = checkWins(newGrid, bet, pay, wildId, specialIds);
    setWinCells(wc);
    roundWin += totalWin;

    // ── scatter / free games ──
    const scatters = scatterId ? countSymbol(newGrid, scatterId) : 0;
    let fgCount = 0;
    if (!freeActive && scatters >= 4) {
      fgCount = scatters === 4 ? 8 : scatters === 5 ? 12 : 16;
    }

    // ── bonus feature trigger ──
    if (bonusFeature && totalWin > 0 && Math.random() < (bonusFeature.triggerChance || 0.25)) {
      sounds.playBonus();
      setBonusAnim(bonusFeature.name);
      await new Promise(r => setTimeout(r, 400));
      const bonusWin = bonusFeature.onTrigger(bet, newGrid);
      roundWin += bonusWin;
      await new Promise(r => setTimeout(r, 600));
      setBonusAnim(null);
    }

    // ── respin ──
    if (totalWin > 0 && wc.size > 0 && Math.random() < 0.28) {
      // find best symbol in win cells
      let bestSym = null, bestCount = 0;
      wc.forEach(key => {
        const [c, row] = key.split(',').map(Number);
        const s = newGrid[c][row];
        if (s === wildId || s === scatterId || specialIds.includes(s)) return;
        const cnt = Array.from(wc).filter(k => {
          const [cc, rr] = k.split(',').map(Number); return newGrid[cc][rr] === s;
        }).length;
        if (cnt > bestCount) { bestCount = cnt; bestSym = s; }
      });

      if (bestSym) {
        const locked = new Set();
        wc.forEach(key => {
          const [c, row] = key.split(',').map(Number);
          if (newGrid[c][row] === bestSym) locked.add(key);
        });
        setLockedCells(locked);
        setLockedSym(bestSym);
        setRespinActive(true);

        for (let rs = 0; rs < 4; rs++) {
          await new Promise(r => setTimeout(r, 500));
          const respinPool = [...Array(35).fill(bestSym), ...Array(10).fill(wildId), ...(scatterId ? Array(5).fill(scatterId) : [])];
          const rGrid = Array(COLS).fill(null).map((_, c) =>
            Array(ROWS).fill(null).map((_, row) => locked.has(`${c},${row}`) ? bestSym : randItem(respinPool))
          );
          const freeCols = Array(COLS).fill(null).map((_, i) => i)
            .filter(c => Array(ROWS).fill(null).every((_, r) => !locked.has(`${c},${r}`)));
          await animateReels(rGrid, freeCols);
          setGrid(rGrid);

          const { totalWin: rw, winCells: rwc } = checkWins(rGrid, bet, pay, wildId, specialIds);
          roundWin += rw;
          let newLocked = false;
          rwc.forEach(k => { if (!locked.has(k)) { const [c, row] = k.split(',').map(Number); if (rGrid[c][row] === bestSym) { locked.add(k); newLocked = true; } } });
          setLockedCells(new Set(locked));
          if (!newLocked) break;
        }
        setRespinActive(false);
        setLockedCells(new Set());
        setLockedSym(null);
      }
    }

    // ── free games ──
    if (fgCount > 0 && !freeActive) {
      sounds.playBonus();
      setFreeGames(fgCount);
      setFreeActive(true);
      setWinMsg(`🌟 FREE GAMES! ${fgCount} spins!`);
      setLastWin(roundWin);
      setShowWin(true);
      await new Promise(r => setTimeout(r, 2000));
      setShowWin(false);

      let fg = fgCount;
      while (fg > 0) {
        setFreeGames(fg);
        await new Promise(r => setTimeout(r, 700));
        const fg2 = makeGrid(pool);
        await animateReels(fg2);
        setGrid(fg2);
        const { totalWin: fw } = checkWins(fg2, bet, pay, wildId, specialIds);
        roundWin += fw;
        fg--;
      }
      setFreeGames(0);
      setFreeActive(false);
    }

    // ── free game decrement ──
    if (freeActive) {
      setFreeGames(p => Math.max(0, p - 1));
      if (freeGames <= 1) setFreeActive(false);
    }

    const maxWin = bet * 25000;
    const finalWin = Math.min(roundWin, maxWin);
    setLastWin(finalWin);
    if (finalWin > 0) {
      setWinMsg(finalWin >= bet * 50 ? '🏆 BIG WIN!' : '✨ WIN!');
      setShowWin(true);
      if (finalWin >= bet * 50) sounds.playBigWin();
      else sounds.playWin();
    }

    if (finalWin > 0) await onBet(0, finalWin, gameSlug);
    setSpinning(false);

    if (autoRef.current && betMode === 'auto') {
      const ns = {
        gamesPlayed: autoStats.gamesPlayed + 1,
        totalWon: autoStats.totalWon + (finalWin > 0 ? finalWin : 0),
        totalLost: autoStats.totalLost + (finalWin === 0 ? bet : 0),
      };
      setAutoStats(ns);
      const stop = (autoConfig.numGames > 0 && ns.gamesPlayed >= autoConfig.numGames)
        || (autoConfig.stopOnWin > 0 && ns.totalWon >= autoConfig.stopOnWin)
        || (autoConfig.stopOnLoss > 0 && ns.totalLost >= autoConfig.stopOnLoss);
      if (stop) { autoRef.current = false; setIsAutoRunning(false); }
      else setTimeout(playRound, 1000);
    }
  }, [spinning, bet, balance, pool, pay, wildId, scatterId, specialIds, gameSlug, onBet, betMode, autoStats, autoConfig, freeActive, freeGames, bonusFeature]);

  return (
    <div className="max-w-2xl mx-auto select-none">
      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowRules(false)}>
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
              className="bg-[#0f0f1a] border-2 rounded-2xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" style={{ borderColor: accentColor }}
              onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-black mb-4 text-center" style={{ color: accentColor }}>{titleEmoji} {title} RULES</h2>
              <div className="space-y-2 text-sm text-gray-200">
                <p><strong style={{ color: accentColor }}>Grid:</strong> 6×4, 20 Win-Lines. Match 3+ left-to-right.</p>
                <p><strong style={{ color: accentColor }}>Wild:</strong> Substitutes for all regular symbols.</p>
                <p><strong style={{ color: accentColor }}>Respin:</strong> ~28% chance after any win — best symbol locks, remaining reels re-spin.</p>
                {scatterId && <p><strong style={{ color: accentColor }}>Scatter:</strong> 4/5/6 = 8/12/16 Free Games.</p>}
                {bonusFeature && <p><strong style={{ color: accentColor }}>{bonusFeature.name}:</strong> {bonusFeature.description}</p>}
                <p><strong style={{ color: accentColor }}>Max Win:</strong> 25,000× bet.</p>
                <div className="mt-3">
                  <p className="font-bold mb-1" style={{ color: accentColor }}>Paytable (×bet | 3/4/5/6):</p>
                  {Object.entries(pay).map(([s, pays]) => {
                    const sym = Object.values(symbols).find(x => x.id === s);
                    return sym ? (
                      <div key={s} className="flex justify-between text-xs py-0.5">
                        <span>{sym.emoji} {sym.label}</span>
                        <span style={{ color: accentColor }}>{pays.join('/')}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <button onClick={() => setShowRules(false)} className="mt-4 w-full py-2 font-black rounded-xl text-black" style={{ background: accentColor }}>CLOSE</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Machine */}
      <div className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 ${borderColor}`} style={{ background: bgGradient }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <button onClick={() => setShowRules(true)} className="p-2 rounded-lg bg-black/30 hover:bg-black/50" style={{ color: accentColor }}>
            <Info className="w-4 h-4" />
          </button>
          <div className="text-center">
            <div className="text-xl font-black tracking-wide" style={{ color: accentColor, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
              {titleEmoji} {title}
            </div>
            {freeActive && <div className="text-sm font-black text-yellow-300 animate-pulse">⭐ FREE GAMES: {freeGames} LEFT</div>}
            {respinActive && <div className="text-xs font-black text-yellow-300 animate-pulse">🔒 RESPIN — {lockedSym}</div>}
          </div>
          <div className="w-8" />
        </div>

        {/* Grid */}
        <div className={`mx-3 mb-2 rounded-xl overflow-hidden border-2 ${borderColor} relative`} style={{ background: '#050510' }}>
          {/* Win overlay */}
          <AnimatePresence>
            {showWin && lastWin > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 cursor-pointer" onClick={() => setShowWin(false)}>
                <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}
                  className="text-5xl font-black" style={{ color: accentColor, textShadow: `0 0 25px ${accentColor}` }}>
                  +{lastWin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </motion.div>
                <div className="text-lg font-bold text-white mt-1">{winLabel || '✨ WIN!'}</div>
                <div className="text-xs text-gray-400 mt-1">Tap to continue</div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Bonus anim */}
          <AnimatePresence>
            {bonusAnim && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 0.45 }}
                  className="text-4xl font-black text-center px-4 py-2 rounded-xl bg-black/50" style={{ color: accentColor }}>
                  {bonusAnim}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-0.5 p-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {Array(COLS).fill(null).map((_, col) => (
              <div key={col} className="flex flex-col gap-0.5">
                {Array(ROWS).fill(null).map((_, row) => {
                  const key = `${col},${row}`;
                  const symId = grid[col]?.[row] || Object.values(symbols)[0].id;
                  const sym = Object.values(symbols).find(s => s.id === symId);
                  const isWin = winCells.has(key);
                  const isLocked = lockedCells.has(key);
                  return (
                    <motion.div key={row} className="h-11"
                      animate={
                        exiting[col] ? { y: 55, opacity: 0 }
                          : dropping[col] ? { y: [-55, 0], opacity: [0, 1] }
                          : { y: 0, opacity: 1 }
                      }
                      transition={{ duration: 0.3, ease: 'easeOut', delay: dropping[col] ? row * 0.025 : 0 }}>
                      <div className={`w-full h-full flex flex-col items-center justify-center rounded-md border transition-all
                        ${isLocked ? 'ring-2 ring-yellow-400' : ''}
                        ${isWin ? 'brightness-125' : ''}`}
                        style={{
                          background: isLocked ? 'rgba(255,220,0,0.2)' : 'rgba(255,255,255,0.04)',
                          borderColor: isWin ? accentColor : 'rgba(255,255,255,0.08)',
                          boxShadow: isLocked ? '0 0 8px 2px rgba(255,220,0,0.4)' : undefined,
                        }}>
                        <span className="text-xl leading-none">{sym?.emoji || '?'}</span>
                        {sym?.special && <span className="text-[7px] font-bold mt-0.5" style={{ color: accentColor }}>{sym.label}</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="px-3 pb-3">
          {/* Stats */}
          <div className="flex justify-between text-xs mb-2 bg-black/30 rounded-lg px-3 py-1.5">
            <div><div className="text-[9px] font-bold opacity-60">COINS</div><div className="font-bold text-white">{balance.toLocaleString()}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold opacity-60">WIN</div><div className={`font-black text-base ${lastWin > 0 ? '' : 'text-white'}`} style={{ color: lastWin > 0 ? accentColor : undefined }}>{lastWin > 0 ? lastWin.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}</div></div>
            <div className="text-right"><div className="text-[9px] font-bold opacity-60">SPIN</div><div className="font-bold text-white">{bet.toFixed(2)}</div></div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-black/40 rounded-xl p-1 mb-2">
            {['manual', 'auto'].map(m => (
              <button key={m} onClick={() => setBetMode(m)}
                className="flex-1 py-1.5 rounded-lg font-bold text-sm capitalize transition-all"
                style={{ background: betMode === m ? accentColor : 'transparent', color: betMode === m ? '#000' : accentColor }}>
                {m}
              </button>
            ))}
          </div>

          {betMode === 'auto' && (
            <div className="bg-black/40 rounded-xl p-2 mb-2 space-y-1">
              <div className="grid grid-cols-3 gap-2">
                {[['numGames', 'GAMES', 'parseInt'], ['stopOnWin', 'STOP WIN', 'parseFloat'], ['stopOnLoss', 'STOP LOSS', 'parseFloat']].map(([k, lbl, fn]) => (
                  <div key={k}>
                    <label className="text-[9px] font-bold mb-0.5 block" style={{ color: accentColor }}>{lbl}</label>
                    <input type="number" value={autoConfig[k]}
                      onChange={e => setAutoConfig(p => ({ ...p, [k]: (fn === 'parseInt' ? parseInt : parseFloat)(e.target.value) || 0 }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-white text-xs" />
                  </div>
                ))}
              </div>
              {isAutoRunning && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Played: {autoStats.gamesPlayed}</span>
                  <span className="text-green-400">+{autoStats.totalWon.toFixed(2)}</span>
                  <span className="text-red-400">-{autoStats.totalLost.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Bet controls */}
          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.10"
                step="0.10"
                value={bet}
                onChange={(e) => setBet(Math.max(0.1, Math.min(balance, parseFloat(e.target.value) || 0.1)))}
                disabled={spinning}
                className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {BET_PRESETS.map(p => (
                <button key={p} onClick={() => setBet(p)} disabled={spinning}
                  className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
                  style={{ background: bet === p ? accentColor : 'rgba(255,255,255,0.06)', color: bet === p ? '#000' : accentColor }}>
                  {p.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* Spin / Auto */}
          {betMode === 'auto' ? (
            <Button onClick={() => { if (isAutoRunning) { autoRef.current = false; setIsAutoRunning(false); } else { autoRef.current = true; setIsAutoRunning(true); setAutoStats({ gamesPlayed: 0, totalWon: 0, totalLost: 0 }); playRound(); } }}
              disabled={spinning && !isAutoRunning}
              className={`w-full h-12 text-base font-black rounded-xl ${isAutoRunning ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-black'}`}
              style={!isAutoRunning ? { background: accentColor } : {}}>
              {isAutoRunning ? '⛔ STOP AUTO' : '🔄 START AUTO'}
            </Button>
          ) : (
            <Button onClick={playRound} disabled={spinning || bet > balance}
              className="w-full h-12 text-base font-black rounded-xl text-black"
              style={{ background: spinning ? '#555' : spinBtnStyle || accentColor, boxShadow: spinning ? 'none' : `0 4px 20px ${accentColor}55` }}>
              {spinning
                ? <><RotateCcw className="w-5 h-5 animate-spin mr-2" />SPINNING...</>
                : freeActive ? <><Star className="w-4 h-4 mr-1" />FREE SPIN ({freeGames})</>
                : <>{titleEmoji} SPIN</>}
            </Button>
          )}
        </div>
      </div>

      {/* Paytable */}
      <div className="mt-3 p-3 rounded-xl border" style={{ background: 'rgba(0,0,0,0.5)', borderColor: `${accentColor}33` }}>
        <h3 className="text-xs font-black mb-2 text-center" style={{ color: accentColor }}>{titleEmoji} PAYTABLE — 3× / 4× / 5× / 6× on 20 lines</h3>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(pay).map(([symId, pays]) => {
            const sym = Object.values(symbols).find(s => s.id === symId);
            return sym ? (
              <div key={symId} className="flex items-center justify-between px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-xs text-white">{sym.emoji} {sym.label}</span>
                <span className="text-xs font-bold" style={{ color: accentColor }}>{pays.join('/')}</span>
              </div>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}