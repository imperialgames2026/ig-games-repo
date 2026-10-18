import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { touchTargetClasses } from '@/components/mobile/TouchOptimized';
import { RotateCcw, Zap, Crown, Minus, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { slotThemePersonalities, defaultSlotPersonality } from './slotThemes';

const SYMBOLS = ['👑', '💎', '💰', '🏆', '⭐', '🎰', '🔔'];
const SYMBOL_HEIGHT = 64;
const VISIBLE_SYMBOLS = 3;

// Paylines visualization overlay
const PAYLINE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181',
  '#AA96DA', '#FCBAD3', '#A8D8EA', '#FFD93D', '#6BCB77',
  '#4D96FF', '#FF8FB1', '#FFC93C', '#86C232', '#FF6B9D',
  '#7FD8BE', '#FF9F9F', '#FFB830', '#8EC5FC', '#FF6B9D'
];

export default function RealisticSlotMachine({ 
  wallet, 
  onBet,
  onFreeSpinUsed,
  currency = 'IC',
  slotType = 'imperial-gold',
  theme = {
    primary: 'from-yellow-500 to-yellow-600',
    secondary: 'from-yellow-900 via-yellow-800 to-yellow-900',
    border: 'border-yellow-500',
    text: 'text-yellow-300',
    title: 'IMPERIAL GOLD',
    icon: Crown,
  }
}) {
  const [bet, setBet] = useState(0.1); // per-line bet
  const [lines, setLines] = useState(20);
  const [spinning, setSpinning] = useState(false);
  const [reelsSpinning, setReelsSpinning] = useState([false, false, false, false, false]);
  const [totalWin, setTotalWin] = useState(0);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [activePaylines, setActivePaylines] = useState([]);
  const [lastWins, setLastWins] = useState([]);
  // Each reel shows exactly 3 symbols
  const [reelSymbols, setReelSymbols] = useState([
    [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    [SYMBOLS[1], SYMBOLS[2], SYMBOLS[3]],
    [SYMBOLS[2], SYMBOLS[3], SYMBOLS[4]],
    [SYMBOLS[3], SYMBOLS[4], SYMBOLS[5]],
    [SYMBOLS[4], SYMBOLS[5], SYMBOLS[6]]
  ]);
  const Icon = theme.icon;
  const personality = slotThemePersonalities[slotType] || defaultSlotPersonality;
  const layoutClassMap = {
    ornate: 'rounded-[2.5rem] border-double px-4 pt-4 pb-3',
    velvet: 'rounded-[1.75rem] border px-3 pt-6 pb-3 before:absolute before:inset-x-6 before:top-3 before:h-px before:bg-rose-300/30',
    cosmic: 'rounded-[2rem] border px-3 pt-5 pb-3 shadow-[0_0_60px_rgba(168,85,247,0.16)]',
    crystal: 'rounded-[1.5rem] border px-2 pt-4 pb-2',
    garden: 'rounded-[2.25rem] border px-3 pt-5 pb-4',
    inferno: 'rounded-[1.75rem] border px-3 pt-4 pb-3 shadow-[inset_0_0_40px_rgba(249,115,22,0.12)]',
    tide: 'rounded-[2rem] border px-3 pt-4 pb-5',
    storm: 'rounded-[1.5rem] border px-3 pt-4 pb-3',
    neon: 'rounded-[1.5rem] border px-3 pt-4 pb-3 shadow-[0_0_50px_rgba(217,70,239,0.18)]',
    lucky: 'rounded-[2rem] border px-3 pt-5 pb-4',
    forest: 'rounded-[2.25rem] border px-3 pt-5 pb-4',
    dragon: 'rounded-[2rem] border px-4 pt-5 pb-3',
    temple: 'rounded-[1.25rem] border px-3 pt-5 pb-3',
    default: 'rounded-[2rem] border px-3 pt-4 pb-3',
  };

  const freeSpins = (wallet?.free_spin_game === 'slots' || !wallet?.free_spin_game) ? (wallet?.free_spins || 0) : 0;
  const freeSpinBet = wallet?.free_spin_bet_amount || 0;

  // Speed: 0 = normal, 1 = fast, 2 = turbo
  const [speed, setSpeed] = useState(0);
  // Auto spin: null = off, number = remaining (Infinity = infinite)
  const [autoSpins, setAutoSpins] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoStopRef = useRef(false);

  const SPEED_CONFIG = {
    0: { spinWait: 2500, reelDelay: 250, afterDelay: 400 },
    1: { spinWait: 800,  reelDelay: 80,  afterDelay: 150 },
    2: { spinWait: 200,  reelDelay: 30,  afterDelay: 50  },
  };

  const cycleSpeed = () => setSpeed(prev => (prev + 1) % 3);

  const spinReels = useCallback(async (isFreeSpin = false) => {
    const activeBet = isFreeSpin ? freeSpinBet : bet * lines;
    const lineBet = isFreeSpin ? freeSpinBet : bet;
    if (spinning) return;
    if (!isFreeSpin && activeBet > (currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0))) return;
    if (isFreeSpin) onFreeSpinUsed?.();

    const cfg = SPEED_CONFIG[speed];

    setSpinning(true);
    setShowWinAnimation(false);
    setLastWins([]);
    setTotalWin(0);
    setActivePaylines([]);
    setReelsSpinning([true, true, true, true, true]);

    try {
      const { data: outcome } = await base44.functions.invoke('generateSlotOutcome', {
        bet_amount: lineBet,
        slot_type: slotType,
        lines: isFreeSpin ? 1 : lines,
        currency: currency,
      });

      if (!outcome.success) throw new Error('Failed to generate outcome');

      await new Promise(resolve => setTimeout(resolve, cfg.spinWait));

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, cfg.reelDelay));
        setReelsSpinning(prev => { const n = [...prev]; n[i] = false; return n; });
        setReelSymbols(prev => { const n = [...prev]; n[i] = outcome.grid[i]; return n; });
      }

      await new Promise(resolve => setTimeout(resolve, cfg.afterDelay));

      if (outcome.wins.length > 0) {
        setLastWins(outcome.wins);
        setTotalWin(outcome.total_win);
        setShowWinAnimation(true);
        setActivePaylines(outcome.wins.map(w => w.line));
      }

      await onBet(activeBet, outcome.total_win, `${slotType}-slot`, Math.floor(activeBet));

    } catch (error) {
      console.error('Slot spin error:', error);
    } finally {
      setSpinning(false);
      setReelsSpinning([false, false, false, false, false]);
    }
  }, [spinning, bet, lines, currency, wallet, speed, slotType, onBet]);

  // Auto spin engine
  useEffect(() => {
    if (!autoRunning || autoStopRef.current) return;
    if (autoSpins !== null && autoSpins !== Infinity && autoSpins <= 0) {
      setAutoRunning(false);
      setAutoSpins(null);
      return;
    }
    if (!spinning) {
      spinReels().then(() => {
        if (!autoStopRef.current) {
          setAutoSpins(prev => prev === Infinity ? Infinity : (prev > 0 ? prev - 1 : 0));
        }
      });
    }
  }, [autoRunning, spinning]);

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

  const adjustBet = (amount) => {
    const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
    const maxBetPerLine = balance / lines;
    setBet(prev => parseFloat(Math.max(0.1, Math.min(maxBetPerLine, prev + amount)).toFixed(2)));
  };



  return (
    <div className="touch-manipulation" style={{ touchAction: 'manipulation' }}>
      <div className={`relative overflow-hidden bg-gradient-to-br ${theme.secondary} ${personality.frameClass} ${layoutClassMap[personality.layout] || layoutClassMap.default} border-2 ${theme.border} shadow-2xl`}>
        <div className={`absolute inset-0 pointer-events-none ${personality.overlayClass}`} />
        <div className="absolute inset-x-4 top-3 flex items-center justify-between pointer-events-none">
          <div className={`text-[12px] uppercase tracking-[0.35em] ${theme.text} opacity-80`}>{personality.titleBadge}</div>
          <div className={`text-[12px] uppercase tracking-[0.3em] ${theme.text} opacity-60`}>{slotType.replace(/-/g, ' ')}</div>
        </div>

        {personality.layout === 'ornate' && <div className="absolute inset-x-8 top-1 h-2 rounded-b-full bg-gradient-to-r from-transparent via-yellow-300/45 to-transparent pointer-events-none" />}
        {personality.layout === 'velvet' && <div className="absolute inset-y-10 left-2 w-2 rounded-full bg-rose-400/20 pointer-events-none" />}
        {personality.layout === 'cosmic' && <div className="absolute right-3 top-10 text-4xl opacity-30 pointer-events-none">🪐</div>}
        {personality.layout === 'crystal' && <div className="absolute inset-x-6 top-4 h-4 bg-[linear-gradient(90deg,transparent,rgba(103,232,249,0.35),transparent)] skew-x-[-30deg] pointer-events-none" />}
        {personality.layout === 'garden' && <div className="absolute inset-x-5 bottom-2 h-6 rounded-full bg-green-400/10 blur-lg pointer-events-none" />}
        {personality.layout === 'inferno' && <div className="absolute inset-x-6 bottom-2 h-8 bg-gradient-to-t from-orange-500/20 to-transparent blur-lg pointer-events-none" />}
        {personality.layout === 'tide' && <div className="absolute inset-x-4 bottom-0 h-10 rounded-t-[2rem] bg-cyan-300/10 pointer-events-none" />}
        {personality.layout === 'storm' && <div className="absolute right-4 top-4 text-blue-200/40 text-3xl pointer-events-none">⚡</div>}
        {personality.layout === 'neon' && <div className="absolute inset-y-6 right-2 w-[3px] bg-fuchsia-400/40 shadow-[0_0_20px_rgba(217,70,239,0.65)] pointer-events-none" />}
        {personality.layout === 'lucky' && <div className="absolute left-3 top-14 text-3xl opacity-30 pointer-events-none">🍀</div>}
        {personality.layout === 'forest' && <div className="absolute left-2 top-16 text-3xl opacity-25 pointer-events-none">🌿</div>}
        {personality.layout === 'dragon' && (
          <>
            <motion.div animate={{ x: [-30, 8, -30], y: [0, -6, 0], rotate: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute -left-3 top-16 text-5xl pointer-events-none opacity-40">🐉</motion.div>
            <div className="absolute right-2 top-12 text-4xl opacity-30 pointer-events-none">🐲</div>
            {showWinAnimation && totalWin > 0 && <motion.div initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: [0, 0.9, 0], scaleX: [0.6, 1.2, 1.6] }} transition={{ duration: 0.9 }} className="absolute left-10 top-24 h-6 w-36 bg-gradient-to-r from-orange-500/80 via-yellow-300/70 to-transparent blur-md pointer-events-none" />}
          </>
        )}
        {personality.layout === 'temple' && <div className="absolute inset-x-4 top-3 h-3 bg-amber-400/10 rounded-sm pointer-events-none" />}
        {personality.ambient === 'ocean' && (
          <motion.div animate={{ x: ['-10%', '10%', '-10%'] }} transition={{ duration: 6, repeat: Infinity }} className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-r from-cyan-400/10 via-blue-400/20 to-cyan-400/10 blur-xl pointer-events-none" />
        )}
        {personality.ambient === 'neon' && (
          <motion.div animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 1.8, repeat: Infinity }} className="absolute inset-0 border border-fuchsia-400/30 shadow-[0_0_40px_rgba(217,70,239,0.25)] rounded-[2rem] pointer-events-none" />
        )}
        {personality.ambient === 'forest' && (
          <>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute left-2 bottom-10 text-3xl opacity-30 pointer-events-none">🍃</motion.div>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.6 }} className="absolute right-3 top-24 text-3xl opacity-30 pointer-events-none">✨</motion.div>
          </>
        )}
        {personality.ambient === 'phoenix' && (
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.35, 0.2] }} transition={{ duration: 2, repeat: Infinity }} className="absolute right-0 top-10 text-6xl pointer-events-none">🔥</motion.div>
        )}
        {personality.ambient === 'storm' && showWinAnimation && totalWin > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1, 0] }} transition={{ duration: 0.8 }} className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/30 to-transparent pointer-events-none" />
        )}

        {/* Title */}
        <div className="text-center mb-2 pt-5">
          <span className="text-sm font-black text-white flex items-center justify-center gap-2">
            <Icon className="w-4 h-4" />
            {theme.title}
          </span>
        </div>

        {/* Slot Machine Frame */}
        <div className="mb-3 relative">
          <div className={`relative bg-black/80 p-2 border-2 border-white/20 ${personality.layout === 'temple' ? 'rounded-md' : personality.layout === 'crystal' ? 'rounded-[1.25rem]' : personality.layout === 'velvet' ? 'rounded-[1.5rem]' : 'rounded-xl'}`}>
            
            {/* Spinning Reels Container */}
            <div className={`grid grid-cols-5 ${personality.layout === 'crystal' ? 'gap-0.5' : personality.layout === 'tide' ? 'gap-2' : personality.layout === 'ornate' ? 'gap-1' : 'gap-1.5'}`}>
              {reelSymbols.map((symbols, reelIndex) => (
                <div key={reelIndex} className={`relative h-[192px] rounded-lg border overflow-hidden ${personality.reelClass}`}>
                  {reelsSpinning[reelIndex] ? (
                    // Blur + scroll animation while spinning
                    <div className="h-full flex flex-col animate-pulse">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[64px] w-full flex items-center justify-center text-3xl border-b border-yellow-500/20 blur-sm select-none">
                          {SYMBOLS[(reelIndex + i) % SYMBOLS.length]}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Static outcome symbols
                    <div className="h-full flex flex-col">
                      {symbols.map((symbol, rowIdx) => (
                        <div key={rowIdx} className="h-[64px] w-full flex items-center justify-center text-3xl font-bold border-b border-yellow-500/20">
                          {symbol}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Center indicator line */}
                  <div className={`absolute top-1/3 left-0 right-0 h-[64px] pointer-events-none ${personality.layout === 'neon' ? 'border-t-2 border-b-2 border-fuchsia-400/70 bg-fuchsia-400/10 shadow-[0_0_18px_rgba(217,70,239,0.25)]' : personality.layout === 'storm' ? 'border-t-2 border-b-2 border-blue-300/70 bg-blue-300/10' : personality.layout === 'tide' ? 'border-t-2 border-b-2 border-cyan-300/60 bg-cyan-300/10' : 'border-t-2 border-b-2 border-yellow-400/60 bg-yellow-400/5'}`} />
                  
                  {/* Top/bottom fade */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/40" />
                </div>
              ))}
            </div>

            {/* Win Line Overlays */}
            {showWinAnimation && activePaylines.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {activePaylines.map((lineIndex, i) => (
                  <motion.div
                    key={lineIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(90deg, ${PAYLINE_COLORS[lineIndex]}33, ${PAYLINE_COLORS[lineIndex]}66, ${PAYLINE_COLORS[lineIndex]}33)`,
                      mixBlendMode: 'screen',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Win Display */}
        <AnimatePresence>
          {showWinAnimation && totalWin > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative mb-2 overflow-hidden p-2 bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500 rounded-xl text-center"
            >
              {personality.winEffect === 'royalPulse' && <motion.div animate={{ scale: [0.8, 1.2], opacity: [0.35, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="absolute inset-0 rounded-xl border border-yellow-300/40" />}
              {personality.winEffect === 'rubyFlash' && <motion.div animate={{ x: ['-120%', '120%'] }} transition={{ duration: 0.9, repeat: Infinity }} className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg]" />}
              {personality.winEffect === 'lightningSweep' && <motion.div animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 0.7, repeat: Infinity }} className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(191,219,254,0.45),transparent)]" />}
              {personality.winEffect === 'waveCrash' && <motion.div animate={{ y: [14, -6, 14] }} transition={{ duration: 1.4, repeat: Infinity }} className="absolute inset-x-0 bottom-0 h-8 bg-cyan-300/20 blur-md" />}
              {personality.winEffect === 'dragonFlare' && <motion.div animate={{ opacity: [0, 0.8, 0], scaleX: [0.6, 1.3, 1.6] }} transition={{ duration: 0.8, repeat: Infinity }} className="absolute left-4 top-1/2 h-5 w-28 -translate-y-1/2 bg-gradient-to-r from-orange-500/70 via-yellow-300/60 to-transparent blur-md" />}
              <div className="relative text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500">
                +{totalWin.toFixed(2)} {currency}
              </div>
              <div className={`relative text-sm ${theme.text} font-bold`}>
                {lastWins.length} WIN{lastWins.length > 1 ? 'S' : ''}!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls - compact 2-col layout */}
        <div className={`space-y-2 ${personality.layout === 'dragon' ? 'border-t border-amber-400/20 pt-3' : personality.layout === 'velvet' ? 'bg-rose-950/20 rounded-2xl p-2' : personality.layout === 'garden' ? 'bg-emerald-950/20 rounded-2xl p-2' : ''}`}>
          <div className="grid grid-cols-2 gap-2">
            {/* Bet Amount */}
            <div className="bg-black/40 rounded-lg p-2">
              <div className="text-xs mb-1 flex justify-between">
                <span className={theme.text}>Bet/Line</span>
                <span className={`font-bold ${theme.text}`}>{bet.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button onClick={() => adjustBet(-0.1)} disabled={spinning} variant="outline" size="icon" className={`${touchTargetClasses} h-11 w-11 p-0`}>
                  <Minus className="w-3 h-3" />
                </Button>
                <input
                  type="number"
                  value={bet}
                  onChange={(e) => {
                    const val = parseFloat(parseFloat(e.target.value || '0.10').toFixed(2)) || 0.1;
                    const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
                    setBet(parseFloat(Math.max(0.1, Math.min(balance / lines, val)).toFixed(2)));
                  }}
                  step="0.10"
                  disabled={spinning}
                  className="flex-1 bg-black/60 rounded px-1 py-1 text-white font-mono text-center outline-none text-sm w-0"
                />
                <Button onClick={() => adjustBet(0.1)} disabled={spinning} variant="outline" size="icon" className={`${touchTargetClasses} h-11 w-11 p-0`}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Lines */}
            <div className="bg-black/40 rounded-lg p-2">
              <div className="text-xs mb-1 flex justify-between">
                <span className={theme.text}>Lines</span>
                <span className={`font-bold ${theme.text}`}>{lines}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {[1, 5, 10, 20].map((lineCount) => (
                  <button
                    key={lineCount}
                    onClick={() => setLines(lineCount)}
                    disabled={spinning}
                    className={`${touchTargetClasses} flex-1 py-1 rounded text-sm font-bold transition-all ${
                      lines === lineCount
                        ? `bg-gradient-to-r ${theme.primary} text-white`
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    } disabled:opacity-50`}
                  >
                    {lineCount}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Speed + Auto + Spin row */}
          <div className="flex gap-2 items-stretch">
            {/* Speed toggle */}
            <button
              onClick={cycleSpeed}
              disabled={spinning && !autoRunning}
              title={speed === 0 ? 'Normal speed' : speed === 1 ? 'Fast speed' : 'Turbo speed'}
              className={`${touchTargetClasses} px-3 rounded-lg border-2 font-black text-sm flex items-center gap-1 transition-all ${
                speed === 0 ? 'border-gray-600 bg-gray-800 text-gray-400'
                : speed === 1 ? 'border-yellow-400 bg-yellow-900/40 text-yellow-300'
                : 'border-cyan-400 bg-cyan-900/40 text-cyan-300 animate-pulse'
              }`}
            >
              <Zap className="w-4 h-4" />
              {speed === 0 ? '' : speed === 1 ? '⚡' : '⚡⚡'}
            </button>

            {/* Auto spin dropdown */}
            {autoRunning ? (
              <button
                onClick={stopAuto}
                className="px-3 rounded-lg border-2 border-red-500 bg-red-900/40 text-red-300 font-black text-xs flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                {autoSpins === Infinity ? '∞' : autoSpins} STOP
              </button>
            ) : (
              <div className="relative group">
                <button
                  className={`${touchTargetClasses} px-3 h-full rounded-lg border-2 border-purple-500 bg-purple-900/40 text-purple-300 font-black text-sm flex items-center gap-1`}
                >
                  AUTO ▾
                </button>
                <div className="absolute bottom-full mb-1 left-0 hidden group-hover:flex flex-col bg-gray-900 border border-purple-500 rounded-lg overflow-hidden z-20 shadow-xl min-w-[90px]">
                  {[10, 20, 30, 'Infinite'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => startAuto(opt === 'Infinite' ? Infinity : opt)}
                      className="min-h-[44px] px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 text-left whitespace-nowrap"
                    >
                      {opt === 'Infinite' ? '∞ Infinite' : `${opt} Spins`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Spin Button */}
            <Button
              onClick={() => spinReels(false)}
              disabled={spinning || autoRunning || bet * lines > (currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0))}
              className={`flex-1 h-10 font-black bg-gradient-to-r ${theme.primary} hover:opacity-90 rounded-lg`}
            >
              {spinning ? (
                <><RotateCcw className="w-4 h-4 animate-spin mr-2" />SPINNING...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />SPIN — {(bet * lines).toFixed(2)} {currency}</>
              )}
            </Button>
          </div>

          {/* Free Spins */}
          {freeSpins > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-pink-500/20 border border-pink-500/40">
                <span className="text-pink-300 font-bold text-xs">🎟️ {freeSpins} Free Spin{freeSpins !== 1 ? 's' : ''} Available</span>
                <span className="text-gray-400 text-xs">{freeSpinBet} bet each</span>
              </div>
              <Button
                onClick={() => spinReels(true)}
                disabled={spinning || autoRunning}
                className="w-full h-9 text-sm font-bold bg-pink-500 hover:bg-pink-400 rounded-lg text-white"
              >
                🎟️ Use Free Spin
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}