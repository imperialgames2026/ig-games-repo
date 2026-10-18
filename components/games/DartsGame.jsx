import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const DIFFICULTIES = {
  easy: [
    { mult: 0.5, weight: 34, color: '#64748b' },
    { mult: 0.8, weight: 26, color: '#94a3b8' },
    { mult: 1.2, weight: 18, color: '#f59e0b' },
    { mult: 1.5, weight: 12, color: '#fb923c' },
    { mult: 2.7, weight: 7, color: '#f43f5e' },
    { mult: 8.5, weight: 3, color: '#22c55e' },
  ],
  medium: [
    { mult: 0.4, weight: 35, color: '#64748b' },
    { mult: 0.6, weight: 25, color: '#94a3b8' },
    { mult: 1.3, weight: 18, color: '#f59e0b' },
    { mult: 3.1, weight: 12, color: '#fb923c' },
    { mult: 6, weight: 7, color: '#f43f5e' },
    { mult: 16, weight: 3, color: '#22c55e' },
  ],
  hard: [
    { mult: 0.2, weight: 38, color: '#64748b' },
    { mult: 0.5, weight: 24, color: '#94a3b8' },
    { mult: 2.5, weight: 17, color: '#f59e0b' },
    { mult: 3.6, weight: 11, color: '#fb923c' },
    { mult: 8.8, weight: 7, color: '#f43f5e' },
    { mult: 63, weight: 3, color: '#22c55e' },
  ],
  expert: [
    { mult: 0.1, weight: 40, color: '#64748b' },
    { mult: 0.5, weight: 25, color: '#94a3b8' },
    { mult: 4.8, weight: 16, color: '#f59e0b' },
    { mult: 9.6, weight: 10, color: '#fb923c' },
    { mult: 42, weight: 7, color: '#f43f5e' },
    { mult: 500, weight: 2, color: '#22c55e' },
  ],
};

function pickWeighted(values) {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of values) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return values[0];
}

export default function DartsGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [difficulty, setDifficulty] = useState('easy');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const options = DIFFICULTIES[difficulty];
  const boardRings = useMemo(() => options.map((option, index) => ({ ...option, index })), [options]);

  const handlePlay = async () => {
    if (playing || betAmount <= 0 || betAmount > balance) return;

    setPlaying(true);
    setResult(null);
    triggerEffect('bet');
    await onBet(betAmount, 0, 'darts');

    await new Promise(resolve => setTimeout(resolve, 1200));

    const hit = pickWeighted(options);
    const payout = Math.round(betAmount * hit.mult * 100) / 100;
    const isWin = payout > betAmount;

    setResult({ ...hit, payout, isWin });
    setHistory(prev => [{ mult: hit.mult, payout, isWin }, ...prev.slice(0, 7)]);
    triggerEffect(isWin ? 'win' : 'lose');

    if (payout > 0) {
      await onBet(0, payout, 'darts');
    }

    setPlaying(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className={`rounded-[28px] border border-white/10 bg-[#142838] p-5 md:p-7 shadow-[0_0_40px_rgba(236,72,153,0.08)] ${effectClassName}`}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="relative mx-auto mb-6 flex aspect-square max-w-[360px] items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[10px] border-[#2a4354]" />
              <div className="absolute inset-[16px] rounded-full border-[8px] border-[#203847]" />
              <div className="absolute inset-[42px] rounded-full bg-[#102433]" />

              <AnimatePresence>
                {playing && (
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.4, 1.05, 0.92], opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    className="absolute h-3 w-3 rounded-full bg-lime-400 shadow-[0_0_18px_rgba(132,204,22,0.95)]"
                  />
                )}
              </AnimatePresence>

              {!playing && result && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute h-3 w-3 rounded-full bg-lime-400 shadow-[0_0_18px_rgba(132,204,22,0.95)]"
                  style={{
                    top: `${18 + result.mult * 0.08}%`,
                    left: `${48 + (result.mult % 2 === 0 ? -6 : 6)}%`,
                  }}
                />
              )}

              <div className="absolute inset-[30px] rounded-full overflow-hidden">
                {boardRings.map((ring, index) => {
                  const size = 100 - index * 14;
                  return (
                    <div
                      key={ring.mult}
                      className="absolute left-1/2 top-1/2 rounded-full border-[6px]"
                      style={{
                        width: `${size}%`,
                        height: `${size}%`,
                        transform: 'translate(-50%, -50%)',
                        borderColor: ring.color,
                        opacity: 0.95,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {options.map((option) => (
                <div key={option.mult} className="rounded-xl bg-[#314a5b] px-3 py-3 text-center border-b-4" style={{ borderColor: option.color }}>
                  <div className="text-lg font-bold text-white">{option.mult}x</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Button onClick={handlePlay} disabled={playing || betAmount > balance || betAmount <= 0} className="h-14 w-full rounded-xl bg-[#2b7fe4] text-lg font-bold text-white hover:bg-[#1f74da]">
              {playing ? 'Throwing...' : 'Play'}
            </Button>

            <div className="rounded-2xl bg-[#203847] p-4 space-y-4 border border-white/5">
              <div>
                <div className="mb-2 text-sm text-slate-300">Amount</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
                    min="0.01"
                    step="0.01"
                    className="bg-[#132836] border-white/10 text-white"
                  />
                  <Button type="button" variant="outline" className="border-white/10 bg-[#314a5b] text-white hover:bg-[#3a5568]" onClick={() => setBetAmount((v) => Math.max(0.01, v / 2))}>½</Button>
                  <Button type="button" variant="outline" className="border-white/10 bg-[#314a5b] text-white hover:bg-[#3a5568]" onClick={() => setBetAmount((v) => Math.min(balance, v * 2))}>2×</Button>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm text-slate-300">Difficulty</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(DIFFICULTIES).map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`rounded-xl px-3 py-3 text-sm font-bold capitalize transition-colors ${difficulty === level ? 'bg-[#2f4657] text-white ring-1 ring-white/20' : 'bg-[#132836] text-slate-300 hover:bg-[#183142]'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#203847] p-4 border border-white/5">
              <div className="mb-2 text-sm text-slate-300">Latest Result</div>
              <div className="text-2xl font-black text-white">
                {result ? `${result.mult}x` : 'Waiting...'}
              </div>
              <div className={`mt-2 text-sm font-semibold ${result ? (result.isWin ? 'text-green-400' : 'text-amber-300') : 'text-slate-400'}`}>
                {result ? `Payout: ${result.payout.toFixed(2)} ${currency}` : 'Lower values hit more often'}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {history.map((item, index) => (
                <div key={`${item.mult}-${index}`} className={`rounded-xl px-3 py-2 text-sm font-bold ${item.isWin ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-slate-300'}`}>
                  {item.mult}x
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}