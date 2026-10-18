import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Zap, Volume2, VolumeX } from 'lucide-react';
import { shouldPlayerWin, calculateWinProbability } from '@/components/casino/HouseEdge';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🔔', '⭐'];
const PAYOUTS = {
  '🍒🍒🍒': 5,
  '🍋🍋🍋': 10,
  '🍊🍊🍊': 15,
  '🍇🍇🍇': 20,
  '🔔🔔🔔': 25,
  '⭐⭐⭐': 50,
  '💎💎💎': 100,
  '7️⃣7️⃣7️⃣': 250,
};

export default function SlotsGame({ wallet, onBet, onFreeSpinUsed, currency = 'IC' }) {
  const freeSpins = (wallet?.free_spin_game === 'slots' || !wallet?.free_spin_game) ? (wallet?.free_spins || 0) : 0;
  const freeSpinBet = wallet?.free_spin_bet_amount || 0;
  const [reels, setReels] = useState(['🍒', '🍋', '🍊']);
  const [spinning, setSpinning] = useState(false);
  const [bet, setBet] = useState(0.01);
  const [lastWin, setLastWin] = useState(0);
  const [showWin, setShowWin] = useState(false);
  
  const [betMode, setBetMode] = useState('manual');
  const [autoConfig, setAutoConfig] = useState({
    numGames: 0,
    stopOnWin: 0,
    stopOnLoss: 0,
  });
  const [autoStats, setAutoStats] = useState({
    gamesPlayed: 0,
    totalWon: 0,
    totalLost: 0,
  });
  const [isAutoRunning, setIsAutoRunning] = useState(false);

  const spinReels = async (isFreeSpin = false) => {
    const activeBet = isFreeSpin ? freeSpinBet : bet;
    if (spinning) return;
    if (!isFreeSpin && activeBet > (wallet?.tokens || 0)) return;

    if (isFreeSpin) onFreeSpinUsed?.();

    setSpinning(true);
    setShowWin(false);
    setLastWin(0);

    // Animate reels
    const spinDuration = 2000;
    const intervalId = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
    }, 100);

    // Determine result
    await new Promise(resolve => setTimeout(resolve, spinDuration));
    clearInterval(intervalId);

    // Dynamic house edge based on bet size
    const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
    const willWin = shouldPlayerWin(activeBet, balance, 0.40); // 40% base win chance for slots
    
    let finalReels;
    if (willWin) {
      // Give winning combination
      const winningCombos = Object.keys(PAYOUTS);
      const combo = winningCombos[Math.floor(Math.random() * winningCombos.length)];
      finalReels = [combo[0], combo[2], combo[4]];
    } else {
      // Give losing combination
      const weightedSymbols = [
        ...Array(35).fill('🍒'),
        ...Array(25).fill('🍋'),
        ...Array(20).fill('🍊'),
        ...Array(10).fill('🍇'),
        ...Array(5).fill('🔔'),
        ...Array(3).fill('⭐'),
        ...Array(1).fill('💎'),
        ...Array(1).fill('7️⃣'),
      ];
      
      // Ensure non-matching reels
      do {
        finalReels = [
          weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)],
          weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)],
          weightedSymbols[Math.floor(Math.random() * weightedSymbols.length)],
        ];
      } while (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]);
    }
    setReels(finalReels);

    // Check for win
    const combo = finalReels.join('');
    const multiplier = PAYOUTS[combo] || 0;
    const winAmount = activeBet * multiplier;

    setSpinning(false);

    if (winAmount > 0) {
      setLastWin(winAmount);
      setShowWin(true);
      await onBet(activeBet, winAmount, 'slots');
    } else {
      await onBet(activeBet, 0, 'slots');
    }
    
    if (betMode === 'auto' && isAutoRunning) {
      const profit = winAmount - bet;
      const newStats = {
        gamesPlayed: autoStats.gamesPlayed + 1,
        totalWon: autoStats.totalWon + (profit > 0 ? profit : 0),
        totalLost: autoStats.totalLost + (profit < 0 ? Math.abs(profit) : 0),
      };
      setAutoStats(newStats);

      if (autoConfig.numGames > 0 && newStats.gamesPlayed >= autoConfig.numGames) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnWin > 0 && newStats.totalWon >= autoConfig.stopOnWin) {
        setIsAutoRunning(false);
        return;
      }
      if (autoConfig.stopOnLoss > 0 && newStats.totalLost >= autoConfig.stopOnLoss) {
        setIsAutoRunning(false);
        return;
      }

      setTimeout(() => spinReels(), 1000);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Slot Machine */}
      <div className="relative bg-gradient-to-br from-[#2A1F3D] to-[#1A1528] rounded-3xl p-8 border border-pink-500/30 shadow-2xl">
        {/* Top Decoration */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-8 py-2 bg-gradient-to-r from-pink-500 to-pink-600 rounded-full">
          <span className="text-lg font-black text-white">MEGA SLOTS</span>
        </div>

        {/* Reels Display */}
        <div className="mt-8 mb-8 p-6 bg-black/40 rounded-2xl border-4 border-pink-500/50">
          <div className="flex justify-center gap-4">
            {reels.map((symbol, index) => (
              <motion.div
                key={index}
                animate={spinning ? { y: [0, -20, 0] } : {}}
                transition={{ repeat: spinning ? Infinity : 0, duration: 0.2 }}
                className="w-24 h-24 bg-gradient-to-br from-white to-gray-100 rounded-xl flex items-center justify-center shadow-inner"
              >
                <span className="text-5xl">{symbol}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Win Display */}
        <AnimatePresence>
          {showWin && lastWin > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl z-10"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-500"
                >
                  +{lastWin.toLocaleString()}
                </motion.div>
                <div className="text-xl text-white mt-2">WINNER!</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual/Auto Toggle */}
        <div className="flex gap-2 bg-black/40 rounded-xl p-1 mb-4">
          <button
            onClick={() => setBetMode('manual')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              betMode === 'manual' ? 'bg-green-500 text-white' : 'text-gray-400'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setBetMode('auto')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              betMode === 'auto' ? 'bg-blue-500 text-white' : 'text-gray-400'
            }`}
          >
            Auto
          </button>
        </div>

        {betMode === 'auto' && (
          <div className="bg-black/40 rounded-xl p-4 space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Games (0=∞)</label>
                <input
                  type="number"
                  value={autoConfig.numGames}
                  onChange={(e) => setAutoConfig({...autoConfig, numGames: parseInt(e.target.value) || 0})}
                  className="w-full bg-black/60 rounded-lg px-2 py-1 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Stop Win</label>
                <input
                  type="number"
                  value={autoConfig.stopOnWin}
                  onChange={(e) => setAutoConfig({...autoConfig, stopOnWin: parseFloat(e.target.value) || 0})}
                  className="w-full bg-black/60 rounded-lg px-2 py-1 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Stop Loss</label>
                <input
                  type="number"
                  value={autoConfig.stopOnLoss}
                  onChange={(e) => setAutoConfig({...autoConfig, stopOnLoss: parseFloat(e.target.value) || 0})}
                  className="w-full bg-black/60 rounded-lg px-2 py-1 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Games: {autoStats.gamesPlayed}</span>
              <span className="text-green-400">+{autoStats.totalWon.toFixed(2)}</span>
              <span className="text-red-400">-{autoStats.totalLost.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Bet Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Bet Amount</span>
            <span className="text-2xl font-bold text-pink-400">{bet.toFixed(2)} CC</span>
          </div>
          <Slider
            value={[bet]}
            onValueChange={(v) => setBet(v[0])}
            min={0.01}
            max={Math.min(1000, wallet?.tokens || 1)}
            step={0.01}
            className="py-2"
          />
          <div className="flex gap-2">
            {[0.01, 0.10, 1, 10, 100].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setBet(Math.min(amount, wallet?.tokens || 0))}
                disabled={amount > (wallet?.tokens || 0)}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                {amount}
              </Button>
            ))}
          </div>
        </div>

        {/* Free Spins Banner */}
        {freeSpins > 0 && (
          <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-pink-500/20 border border-pink-500/40">
            <span className="text-pink-300 font-bold text-sm">🎟️ {freeSpins} Free Spin{freeSpins !== 1 ? 's' : ''} Available</span>
            <span className="text-gray-400 text-xs">{freeSpinBet.toLocaleString()} bet each</span>
          </div>
        )}

        {/* Spin Button */}
        {betMode === 'auto' ? (
          <Button
            onClick={() => {
              if (isAutoRunning) {
                setIsAutoRunning(false);
              } else {
                setIsAutoRunning(true);
                setAutoStats({ gamesPlayed: 0, totalWon: 0, totalLost: 0 });
                spinReels(false);
              }
            }}
            disabled={spinning}
            className={`w-full h-16 mt-6 text-xl font-black rounded-xl ${
              isAutoRunning 
                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}
          >
            {isAutoRunning ? 'STOP AUTO' : 'START AUTO'}
          </Button>
        ) : (
          <div className="space-y-2 mt-6">
            <Button
              onClick={() => spinReels(false)}
              disabled={spinning || bet > (wallet?.tokens || 0)}
              className="w-full h-16 text-xl font-black bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 rounded-xl"
            >
              {spinning ? (
                <RotateCcw className="w-6 h-6 animate-spin mr-2" />
              ) : (
                <Zap className="w-6 h-6 mr-2" />
              )}
              {spinning ? 'SPINNING...' : 'SPIN'}
            </Button>
            {freeSpins > 0 && (
              <Button
                onClick={() => spinReels(true)}
                disabled={spinning}
                className="w-full h-12 text-base font-bold bg-pink-500 hover:bg-pink-400 rounded-xl text-white"
              >
                🎟️ Use Free Spin ({freeSpinBet.toLocaleString()} bet)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Paytable */}
      <div className="mt-6 p-4 bg-white/5 rounded-xl">
        <h3 className="text-sm font-bold text-gray-400 mb-3">PAYTABLE</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(PAYOUTS).map(([combo, multiplier]) => (
            <div key={combo} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
              <span>{combo}</span>
              <span className="text-pink-400 font-bold">{multiplier}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}