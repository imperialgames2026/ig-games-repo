import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Target } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';

export default function DiceZoneGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [zoneStart, setZoneStart] = useState(25);
  const [zoneEnd, setZoneEnd] = useState(75);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(null);
  const [history, setHistory] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const zoneSize = zoneEnd - zoneStart;
  const winChance = zoneSize;
  const multiplier = (100 / winChance * 0.96).toFixed(2);

  const handleRoll = async () => {
    if (betAmount > balance || rolling) return;

    setRolling(true);

    const response = await base44.functions.invoke('generateDiceZoneOutcomeSSRCR', {
      bet_amount: betAmount,
      zone_start: Math.round(zoneStart),
      zone_end: Math.round(zoneEnd),
      currency,
    });
    const data = response.data;

    await new Promise(resolve => setTimeout(resolve, 800));

    setLastSeed(data.seed);
    setLastHash(data.hash);
    setLastRoll({ value: data.roll, isWin: data.is_win });
    setHistory(prev => [{ value: data.roll, isWin: data.is_win }, ...prev.slice(0, 9)]);

    await onBet(betAmount, data.win_amount, 'dice-zone');
    setRolling(false);
  };

  const handleBarDrag = (e, side) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || e.touches?.[0]?.clientX;
    const percent = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
    
    if (side === 'start') {
      setZoneStart(Math.max(0, Math.min(percent, zoneEnd - 10)));
    } else {
      setZoneEnd(Math.max(zoneStart + 10, Math.min(100, percent)));
    }
  };

  const halfBet = () => setBetAmount(prev => Math.max(0.01, prev / 2));
  const doubleBet = () => setBetAmount(prev => Math.min(balance, prev * 2));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1c1c2e] rounded-2xl p-6">
        {/* Number Display */}
        <div className="relative h-80 bg-[#1A1A2E] rounded-xl mb-6 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
          
          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div
                key="rolling"
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.2, 0.8] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-8xl font-black text-blue-400"
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
                  {lastRoll.isWin ? `🎯 Won ${(betAmount * multiplier).toFixed(2)} ${currency}!` : '💔 Missed!'}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <Target className="w-20 h-20 text-gray-500 mb-4 mx-auto" />
                <p className="text-gray-400">Set your target zone</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Zone Bar at bottom */}
          <div className="absolute bottom-4 left-4 right-4 h-12 bg-gray-700 rounded-lg overflow-hidden">
            <div 
              className="absolute top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-600"
              style={{ left: `${zoneStart}%`, right: `${100 - zoneEnd}%` }}
            />
            {lastRoll && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-0 bottom-0 w-1 bg-white"
                style={{ left: `${lastRoll.value}%` }}
              />
            )}
          </div>
        </div>

        {/* History */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {history.map((roll, i) => (
            <div
              key={i}
              className={`min-w-[60px] h-12 rounded-lg flex items-center justify-center font-bold ${
                roll.isWin ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {roll.value}
            </div>
          ))}
        </div>

        {/* Zone Slider */}
        <div className="bg-[#252538] rounded-xl p-4 mb-4">
          <div className="text-gray-400 text-sm mb-3">Drag to set your target zone</div>
          
          <div 
            className="relative h-16 bg-gray-700 rounded-lg cursor-pointer mb-3"
            onMouseMove={(e) => handleBarDrag(e, dragging)}
            onTouchMove={(e) => handleBarDrag(e, dragging)}
            onMouseUp={() => setDragging(null)}
            onTouchEnd={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            <div 
              className="absolute top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-600"
              style={{ left: `${zoneStart}%`, right: `${100 - zoneEnd}%` }}
            />
            
            {/* Start handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-14 bg-white rounded-lg cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center"
              style={{ left: `${zoneStart}%`, transform: 'translate(-50%, -50%)' }}
              onMouseDown={() => setDragging('start')}
              onTouchStart={() => setDragging('start')}
            >
              <div className="text-xs font-bold text-gray-700">{Math.round(zoneStart)}</div>
            </div>
            
            {/* End handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-14 bg-white rounded-lg cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center"
              style={{ left: `${zoneEnd}%`, transform: 'translate(-50%, -50%)' }}
              onMouseDown={() => setDragging('end')}
              onTouchStart={() => setDragging('end')}
            >
              <div className="text-xs font-bold text-gray-700">{Math.round(zoneEnd)}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-[#1c1c2e] text-center">
              <div className="text-xs text-gray-400 mb-1">Zone Size</div>
              <div className="text-lg font-bold text-white">{zoneSize}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#1c1c2e] text-center">
              <div className="text-xs text-gray-400 mb-1">Win Chance</div>
              <div className="text-lg font-bold text-green-400">{winChance}%</div>
            </div>
            <div className="p-3 rounded-lg bg-[#1c1c2e] text-center">
              <div className="text-xs text-gray-400 mb-1">Multiplier</div>
              <div className="text-lg font-bold text-yellow-400">{multiplier}x</div>
            </div>
          </div>
        </div>

        {lastHash && <div className="mb-4"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

        {/* Bet Controls */}
        <div className="bg-[#252538] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Bet Amount</span>
            <span className="text-gray-400 text-sm">Payout: {(betAmount * multiplier).toFixed(2)} {currency}</span>
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
            disabled={rolling || betAmount > balance}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {rolling ? '🎲 Rolling...' : '🎯 Roll Dice'}
          </Button>
        </div>
      </div>
    </div>
  );
}