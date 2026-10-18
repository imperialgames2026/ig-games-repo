import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import useCasinoEffects from '@/hooks/useCasinoEffects';

export default function DiceGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const handleRoll = async () => {
    if (!prediction || betAmount > balance || rolling) return;

    setRolling(true);
    triggerEffect('bet');
    // Deduct bet immediately
    await onBet(betAmount, 0, 'dice');

    // Small delay for animation effect
    await new Promise(r => setTimeout(r, 600));

    const response = await base44.functions.invoke('generateDiceOutcomeSSRCR', {
      bet_amount: betAmount,
      prediction,
      currency,
    });
    const data = response.data;
    const roll = data.roll;
    const isWin = data.is_win;
    const winAmount = data.win_amount;

    setLastSeed(data.seed);
    setLastHash(data.hash);
    setLastRoll({ value: roll, isWin });
    triggerEffect(isWin ? 'win' : 'lose');
    setHistory(prev => [{ value: roll, isWin, prediction }, ...prev.slice(0, 9)]);

    if (winAmount > 0) await onBet(0, winAmount, 'dice');
    setRolling(false);
  };

  const halfBet = () => setBetAmount(prev => Math.max(0.01, prev / 2));
  const doubleBet = () => setBetAmount(prev => Math.min(balance, prev * 2));

  return (
    <div className="max-w-4xl mx-auto">
      <div className={`bg-[#1c1c2e] rounded-2xl p-6 transition-all duration-300 ${effectClassName}`}>
        {/* Number Display */}
        <div className="relative h-80 bg-[#1A1A2E] rounded-xl mb-6 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
          
          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div
                key="rolling"
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.2, 0.8] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-8xl font-black text-purple-400"
              >
                ?
              </motion.div>
            ) : lastRoll ? (
              <motion.div
                key="result"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className={`text-9xl font-black mb-4 ${lastRoll.isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {lastRoll.value}
                </div>
                <div className={`text-3xl font-bold ${lastRoll.isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {lastRoll.isWin ? `🎉 Won ${(betAmount * 1.96).toFixed(2)} ${currency}!` : '💔 Try Again'}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Dices className="w-20 h-20 text-gray-500 mb-4 mx-auto" />
                <p className="text-gray-400">Choose Over or Under 50</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 50 Line Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-sm">
            ━━━ 50 ━━━
          </div>
        </div>

        {/* History */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {history.map((roll, i) => (
            <div
              key={i}
              className={`min-w-[70px] h-14 rounded-lg flex flex-col items-center justify-center font-bold ${
                roll.isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              <div className="text-lg">{roll.value}</div>
              <div className="text-xs opacity-70">{roll.prediction}</div>
            </div>
          ))}
        </div>

        {/* Prediction Buttons */}
        <div className="bg-[#252538] rounded-xl p-4 mb-4">
          <div className="text-gray-400 text-sm mb-3">Select Prediction</div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPrediction('under')}
              className={`py-6 rounded-lg font-bold text-white text-xl transition-all ${
                prediction === 'under'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 ring-2 ring-white'
                  : 'bg-red-500/50 hover:bg-red-500/70'
              }`}
            >
              🔻 Under 50
              <div className="text-sm mt-1 opacity-80">1.96x</div>
            </button>
            <button
              onClick={() => setPrediction('over')}
              className={`py-6 rounded-lg font-bold text-white text-xl transition-all ${
                prediction === 'over'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 ring-2 ring-white'
                  : 'bg-green-500/50 hover:bg-green-500/70'
              }`}
            >
              🔺 Over 50
              <div className="text-sm mt-1 opacity-80">1.96x</div>
            </button>
          </div>
        </div>

        {/* Provably Fair */}
        {lastHash && <div className="mb-4"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

        {/* Bet Controls */}
        <div className="bg-[#252538] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Bet Amount</span>
            <span className="text-gray-400 text-sm">Payout: {(betAmount * 1.96).toFixed(2)} {currency}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 bg-[#1c1c2e] rounded-lg px-4 py-3 flex items-center justify-between">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
                step="0.01"
                min="0.01"
                max={balance}
                className="bg-transparent text-white font-mono w-full outline-none"
              />
              <div className="flex gap-1">
                <button
                  onClick={halfBet}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white"
                >
                  1/2
                </button>
                <button
                  onClick={doubleBet}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white"
                >
                  2x
                </button>
              </div>
            </div>
          </div>

          <Button
            onClick={handleRoll}
            disabled={rolling || !prediction || betAmount > balance}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {rolling ? '🎲 Rolling...' : !prediction ? 'Select Over or Under' : '🎲 Roll Dice'}
          </Button>
        </div>
      </div>
    </div>
  );
}