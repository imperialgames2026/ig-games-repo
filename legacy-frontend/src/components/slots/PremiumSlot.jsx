import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { touchTargetClasses } from '@/components/mobile/TouchOptimized';
import { Zap, Volume2, VolumeX, RotateCcw } from 'lucide-react';

export default function PremiumSlot({ wallet, onWin, bet: initialBet = 0.1 }) {
  const [reels, setReels] = useState([
    ['💎', '👑', '🏆'],
    ['💰', '🎯', '⭐'],
    ['💎', '👑', '🏆'],
    ['💰', '🎯', '⭐'],
    ['💎', '👑', '🏆'],
  ]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [bet, setBet] = useState(initialBet);
  const [winAmount, setWinAmount] = useState(0);
  const [showWin, setShowWin] = useState(false);
  const [accumulator, setAccumulator] = useState(0);
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusSymbols, setBonusSymbols] = useState([]);
  const [sound, setSound] = useState(true);
  const audioRef = useRef(new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='));

  const playSound = () => {
    if (sound && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const spin = async () => {
    if (isSpinning || bet > wallet.tokens) return;

    setIsSpinning(true);
    setWinAmount(0);
    setShowWin(false);

    try {
      const response = await base44.functions.invoke('generatePremiumSlotOutcome', {
        bet,
        accumulator,
      });

      const { grid, winAmount: win, newAccumulator, bonusTriggered } = response.data;

      // Animate reels
      await new Promise(resolve => {
        let frame = 0;
        const animateReels = () => {
          frame++;
          if (frame < 60) {
            setReels(grid.map(() => [
              ['💎', '👑', '🏆', '💰', '🎯', '⭐'][Math.floor(Math.random() * 6)],
              ['💎', '👑', '🏆', '💰', '🎯', '⭐'][Math.floor(Math.random() * 6)],
              ['💎', '👑', '🏆', '💰', '🎯', '⭐'][Math.floor(Math.random() * 6)],
            ]));
            requestAnimationFrame(animateReels);
          } else {
            setReels(grid);
            resolve();
          }
        };
        animateReels();
      });

      playSound();

      setAccumulator(newAccumulator);

      if (win > 0) {
        setWinAmount(win);
        setShowWin(true);
        onWin?.(bet, win, 'premium-slot');
      } else {
        onWin?.(bet, 0, 'premium-slot');
      }

      if (bonusTriggered) {
        setBonusActive(true);
      }
    } catch (error) {
      console.error('Spin failed:', error);
    }

    setIsSpinning(false);
  };

  const revealBonus = (id) => {
    setBonusSymbols(prev =>
      prev.map(s => (s.id === id ? { ...s, revealed: true } : s))
    );
    playSound();
  };

  useEffect(() => {
    if (!bonusActive) return;
    playSound();
    setBonusSymbols([
      { id: 0, symbol: '💼', revealed: false },
      { id: 1, symbol: '💎', revealed: false },
      { id: 2, symbol: '👑', revealed: false },
      { id: 3, symbol: '🏆', revealed: false },
      { id: 4, symbol: '💰', revealed: false },
      { id: 5, symbol: '🎯', revealed: false },
      { id: 6, symbol: '⭐', revealed: false },
      { id: 7, symbol: '💼', revealed: false },
      { id: 8, symbol: '💎', revealed: false },
    ]);
  }, [bonusActive]);

  const completeBonus = () => {
    setBonusActive(false);
    setAccumulator(0);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-4 space-y-3 border border-purple-500/50 touch-manipulation" style={{ touchAction: 'manipulation' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
          ⚡ PREMIUM SLOT
        </h2>
        <span className="text-xs text-gray-400 bg-black/30 px-2 py-1 rounded-full">Accumulator: {accumulator}/5</span>
      </div>

      {/* Reels */}
      <div className="bg-black/50 rounded-xl p-3 border border-purple-500/30">
        <div className="grid grid-cols-5 gap-1.5">
          {reels.map((reel, i) => (
            <motion.div
              key={i}
              className="aspect-square bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-purple-400/30 flex items-center justify-center overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {isSpinning ? (
                  <motion.div key="spinning" animate={{ y: [0, -60] }} transition={{ duration: 0.1, repeat: Infinity }} className="text-3xl">
                    {reel[0]}
                  </motion.div>
                ) : (
                  <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl">
                    {reel[0]}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Win Display */}
      <AnimatePresence>
        {showWin && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-3 text-center"
          >
            <p className="text-white font-black text-xl">{winAmount.toFixed(2)} IC WIN!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonus Mode */}
      <AnimatePresence>
        {bonusActive && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div className="bg-gradient-to-br from-purple-900 to-slate-900 rounded-2xl p-6 max-w-sm w-full border border-pink-500"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            >
              <h3 className="text-xl font-black text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">BONUS ROUND</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {bonusSymbols.map(item => (
                  <motion.button key={item.id} onClick={() => !item.revealed && revealBonus(item.id)}
                    className={`${touchTargetClasses} aspect-square bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-pink-400 flex items-center justify-center text-3xl disabled:opacity-50`}
                    disabled={item.revealed} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    {item.revealed ? item.symbol : '?'}
                  </motion.button>
                ))}
              </div>
              <Button onClick={completeBonus} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold">
                Collect Bonus
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-bold text-gray-300">Bet:</label>
        <input
          type="number" min="0.10" step="0.10" max={wallet.tokens} value={bet}
          onChange={e => setBet(Math.max(0.1, Math.min(wallet.tokens, parseFloat(e.target.value) || 0.1)))}
          disabled={isSpinning}
          className="flex-1 bg-slate-800 text-white px-3 py-2 rounded-lg border border-purple-500/50 focus:outline-none focus:border-purple-400 text-sm"
        />
        <span className="text-sm text-gray-400">IC</span>
      </div>

      <Button onClick={spin} disabled={isSpinning || bet > wallet.tokens}
        className="w-full h-10 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black"
      >
        <Zap className="w-4 h-4 mr-2" />
        {isSpinning ? 'SPINNING...' : `SPIN — ${bet} IC`}
      </Button>

      <p className="text-sm text-gray-500 text-center">Collect 5 💼 to trigger bonus • 93% RTP</p>
    </div>
  );
}