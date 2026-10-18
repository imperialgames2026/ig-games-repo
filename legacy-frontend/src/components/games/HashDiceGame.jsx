import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';

export default function HashDiceGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [prediction, setPrediction] = useState(null); // 'low' or 'high'
  const [spinning, setSpinning] = useState(false);
  const [displayValue, setDisplayValue] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastSeed, setLastSeed] = useState(null);
  const [multiplier, setMultiplier] = useState(1.96);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);

  const payout = (betAmount * multiplier).toFixed(2);

  const handleSpin = async () => {
    if (!prediction || betAmount > balance || spinning) return;
    setSpinning(true);
    setDisplayValue(null);

    // Deduct bet immediately
    await onBet(betAmount, 0, 'hashdice');

    // Animate slot machine rolling
    const interval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 100000).toString().padStart(5, '0'));
    }, 80);

    await new Promise(r => setTimeout(r, 1200));
    clearInterval(interval);

    const roll = Math.floor(Math.random() * 100000);
    const isWin = prediction === 'low' ? roll < 50000 : roll > 49999;
    const winAmount = isWin ? parseFloat(payout) : 0;
    const seed = crypto.randomUUID();

    setLastSeed(seed);
    setDisplayValue(roll.toString().padStart(5, '0'));
    setLastResult({ value: roll, isWin });
    setHistory(prev => [{ value: roll, isWin, prediction }, ...prev.slice(0, 9)]);

    if (winAmount > 0) await onBet(0, winAmount, 'hashdice');
    setSpinning(false);
  };

  const halfBet = () => setBetAmount(prev => Math.max(0.01, Math.round(prev / 2 * 100) / 100));
  const doubleBet = () => setBetAmount(prev => Math.min(balance, Math.round(prev * 2 * 100) / 100));

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-[#1c1c2e] rounded-2xl p-6 space-y-4">
        {/* Game Header */}
        <div className="text-center mb-2">
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400 italic tracking-widest">Hashdice</span>
          {lastResult?.isWin && (
            <div className="mt-1 text-yellow-400 font-bold text-sm animate-pulse">★★ BIGWIN ★★</div>
          )}
        </div>

        {/* Slot Machine Display */}
        <div className="bg-[#111122] border-2 border-purple-500/30 rounded-xl p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-transparent" />
          <div className="relative">
            <AnimatePresence mode="wait">
              {spinning ? (
                <motion.div
                  key="spinning"
                  className="font-mono text-5xl font-black tracking-widest text-white"
                >
                  {displayValue || '00000'}
                </motion.div>
              ) : displayValue !== null ? (
                <motion.div
                  key="result"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`font-mono text-5xl font-black tracking-widest ${lastResult?.isWin ? 'text-green-400' : 'text-red-400'}`}
                >
                  {displayValue}
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="font-mono text-5xl font-black tracking-widest text-gray-500"
                >
                  00000
                </motion.div>
              )}
            </AnimatePresence>
            <div className="text-xs text-gray-500 mt-2 uppercase tracking-widest">HASHDICE WORLD</div>
          </div>
        </div>

        {/* Result */}
        {lastResult && !spinning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center font-bold text-lg ${lastResult.isWin ? 'text-green-400' : 'text-red-400'}`}
          >
            {lastResult.isWin ? `🎉 Won ${payout} ${currency}!` : '💔 Try Again!'}
          </motion.div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((h, i) => (
              <div
                key={i}
                className={`min-w-[70px] h-12 rounded-lg flex flex-col items-center justify-center font-mono text-xs font-bold shrink-0 ${
                  h.isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                <div>{h.value.toString().padStart(5, '0')}</div>
                <div className="text-[10px] opacity-60">{h.prediction}</div>
              </div>
            ))}
          </div>
        )}

        {/* Low / High Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPrediction('low')}
            className={`py-4 rounded-xl font-bold text-white transition-all ${
              prediction === 'low'
                ? 'bg-gradient-to-r from-red-500 to-red-600 ring-2 ring-white/50 scale-105'
                : 'bg-red-500/40 hover:bg-red-500/60'
            }`}
          >
            <div className="text-lg">Low Button</div>
            <div className="text-sm opacity-80">&lt; 49999</div>
            <div className="text-xs opacity-60">1.96x</div>
          </button>
          <button
            onClick={() => setPrediction('high')}
            className={`py-4 rounded-xl font-bold text-white transition-all ${
              prediction === 'high'
                ? 'bg-gradient-to-r from-green-500 to-green-600 ring-2 ring-white/50 scale-105'
                : 'bg-green-500/40 hover:bg-green-500/60'
            }`}
          >
            <div className="text-lg">High Button</div>
            <div className="text-sm opacity-80">&gt; 50000</div>
            <div className="text-xs opacity-60">1.96x</div>
          </button>
        </div>

        {/* Bet Controls */}
        <div className="bg-[#252538] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Amount</span>
            <span>Payout: <span className="text-white font-bold">{payout} {currency}</span></span>
          </div>
          <div className="flex items-center gap-2 bg-[#1c1c2e] rounded-lg px-3 py-2">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
              step="0.01"
              min="0.01"
              max={balance}
              className="bg-transparent text-white font-mono flex-1 outline-none text-sm"
            />
            <button onClick={halfBet} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white">1/2</button>
            <button onClick={doubleBet} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white">2x</button>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Chance 50%</span>
            <span>House Edge 2%</span>
          </div>
        </div>

        {/* SSRCR Verification */}
        {lastSeed && <ProvablyFairBadge seed={lastSeed} hash={null} />}

        {/* Spin Button */}
        <Button
          onClick={handleSpin}
          disabled={spinning || !prediction || betAmount > balance}
          className="w-full h-14 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl disabled:opacity-50"
        >
          {spinning ? '🎰 Spinning...' : !prediction ? 'Select Low or High' : '🎰 Spin'}
        </Button>
      </div>
    </div>
  );
}