import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PlinkoBoard from './PlinkoBoard';
import useCasinoEffects from '@/hooks/useCasinoEffects';

export default function PlinkoGame({ wallet, onBet, currency = 'IC' }) {
  const [gameMode, setGameMode] = useState('regular');
  const [rows, setRows] = useState(10);
  const [bet, setBet] = useState(0.01);
  const [isDropping, setIsDropping] = useState(false);
  const [balls, setBalls] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  // Multipliers based on game mode and rows (rows+1 buckets)
  const multipliers = {
    regular: {
      8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
      9: [6, 2.1, 1.5, 1, 0.7, 0.7, 1, 1.5, 2.1, 6],
      10: [8.7, 3, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 3, 8.7],
      11: [9, 3.8, 2.1, 1.4, 1, 0.6, 0.6, 1, 1.4, 2.1, 3.8, 9],
      12: [11, 3, 2, 1.4, 1.1, 1, 0.4, 1, 1.1, 1.4, 2, 3, 11],
      13: [17, 4, 3.5, 2, 1.1, 1, 0.6, 1, 1.1, 2, 3.5, 4, 17],
      14: [10, 5, 3, 1.4, 1.2, 1.1, 0.5, 0.5, 0.5, 1.1, 1.2, 1.4, 3, 5, 10],
      15: [20, 8, 4, 2.5, 1.5, 1.2, 1.1, 0.5, 0.5, 1.1, 1.2, 1.5, 2.5, 4, 8, 20],
      16: [100, 10, 3, 1.6, 1.4, 1.2, 1.1, 1, 0.4, 1, 1.1, 1.2, 1.4, 1.6, 3, 10, 100],
    },
    high: {
      8: [24.4, 3, 1.6, 0.5, 0.2, 0.5, 1.6, 3, 24.4],
      9: [45.3, 7, 2.1, 0.5, 0.2, 0.2, 0.5, 2.1, 7, 45.3],
      10: [76, 12, 4, 1, 0.3, 0.2, 0.3, 1, 4, 12, 76],
      11: [120, 18, 6, 1.5, 0.5, 0.2, 0.2, 0.2, 0.5, 1.5, 6, 18, 120],
      12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
      13: [260, 35, 12, 3, 1, 0.3, 0.2, 0.2, 0.3, 1, 3, 12, 35, 260],
      14: [420, 55, 18, 5, 1.5, 0.5, 0.2, 0.2, 0.5, 1.5, 5, 18, 55, 420],
      15: [620, 88, 24, 8, 2, 0.7, 0.3, 0.2, 0.3, 0.7, 2, 8, 24, 88, 620],
      16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
    },
    nightmare: {
      8: [24.4, 3, 1.6, 0.5, 0.2, 0.5, 1.6, 3, 24.4],
      9: [45.3, 7, 2.1, 0.5, 0.2, 0.2, 0.5, 2.1, 7, 45.3],
      10: [253, 10, 1.3, 0.5, 0.2, 0.2, 0.5, 1.3, 10, 253],
      11: [300, 15, 2, 0.5, 0.3, 0.1, 0.1, 0.3, 0.5, 2, 15, 300],
      12: [420, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 420],
      13: [520, 35, 12, 3, 1, 0.3, 0.2, 0.2, 0.3, 1, 3, 12, 35, 520],
      14: [820, 55, 18, 5, 1.5, 0.5, 0.2, 0.2, 0.5, 1.5, 5, 18, 55, 820],
      15: [1200, 88, 24, 8, 2, 0.7, 0.3, 0.2, 0.3, 0.7, 2, 8, 24, 88, 1200],
      16: [1800, 180, 26, 9, 4, 2, 1, 0.2, 0.2, 1, 2, 4, 9, 26, 180, 1800],
    },
  };

  const currentMultipliers = multipliers[gameMode][rows];
  const bucketCount = currentMultipliers.length;

  const dropBall = async () => {
    if (isDropping || bet > (wallet?.tokens || 0)) return;

    setIsDropping(true);
    setResult(null);
    triggerEffect('bet');

    try {
      const { data: outcome } = await base44.functions.invoke('generatePlinkoOutcome', {
        bet_amount: bet,
        game_mode: gameMode,
        rows: rows,
        currency: currency,
      });

      if (!outcome.success) throw new Error('Failed to generate outcome');

      const ballId = Date.now();
      const targetBucket = outcome.bucket_index;

      // Build a path of left/right decisions that lands on targetBucket.
      // At each row r there are (r+2) pegs; the ball starts at the centre slot.
      // We need exactly `rows` decisions, each ±1 column, ending at targetBucket.
      const buildPath = (numRows, target) => {
        const decisions = [];
        let slot = Math.floor(numRows / 2);

        for (let r = 0; r < numRows; r++) {
          const remaining = numRows - r - 1;
          const canGoLeft = slot > 0;
          const canGoRight = slot < numRows;

          let step;
          if (!canGoLeft) {
            step = 1;
          } else if (!canGoRight) {
            step = -1;
          } else {
            const leftReachable = Math.abs(target - (slot - 1)) <= remaining;
            const rightReachable = Math.abs(target - (slot + 1)) <= remaining;

            if (leftReachable && !rightReachable) {
              step = -1;
            } else if (!leftReachable && rightReachable) {
              step = 1;
            } else if (leftReachable && rightReachable) {
              if (slot === target) {
                step = Math.random() < 0.5 ? -1 : 1;
              } else {
                step = target < slot ? -1 : 1;
              }
            } else {
              step = target < slot ? -1 : 1;
            }
          }

          decisions.push(step);
          slot += step;
        }

        return decisions;
      };

      const decisions = buildPath(rows, targetBucket);

      // Animate peg-by-peg
      let slot = Math.floor(rows / 2);
      for (let r = 0; r < rows; r++) {
        const totalCols = rows;
        const xFrac = totalCols === 0 ? 0.5 : slot / totalCols;
        setBalls([{ id: ballId, xFrac, row: r, active: true }]);
        await new Promise(res => setTimeout(res, 140));
        slot += decisions[r];
      }

      // Final position at bucket row
      const xFrac = rows === 0 ? 0.5 : slot / rows;
      setBalls([{ id: ballId, xFrac, row: rows, active: true, done: true }]);
      await new Promise(res => setTimeout(res, 550));

      setResult({
        bucket: targetBucket,
        multiplier: outcome.multiplier,
        winAmount: outcome.win_amount,
        seed: outcome.seed,
        hash: outcome.hash,
      });
      triggerEffect(outcome.win_amount > 0 ? 'win' : 'lose');
      setHistory(prev => [outcome.multiplier, ...prev.slice(0, 9)]);
      await onBet(bet, outcome.win_amount, 'plinko');

      await new Promise(res => setTimeout(res, 1500));
      setBalls([]);
    } catch (error) {
      console.error('Drop ball error:', error);
      alert('Failed to drop ball. Please try again.');
    } finally {
      setIsDropping(false);
    }
  };

  const getBucketColor = (mult) => {
    if (mult >= 100) return 'from-yellow-500 to-yellow-600';
    if (mult >= 10) return 'from-orange-500 to-orange-600';
    if (mult >= 2) return 'from-green-500 to-green-600';
    if (mult >= 1) return 'from-blue-500 to-blue-600';
    return 'from-red-500 to-red-600';
  };

  return (
    <div className="max-w-5xl mx-auto w-full overflow-hidden">
      <div className={`bg-white dark:bg-[#1A1528] rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row gap-4 transition-all duration-300 overflow-hidden ${effectClassName}`}>

        {/* Controls - left sidebar on desktop, top on mobile */}
        <div className="lg:w-56 flex-shrink-0 space-y-3 order-first">
          <div>
            <div className="flex items-center justify-between text-gray-900 dark:text-white mb-1 text-sm">
              <span>Bet Amount</span>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-[#252538] rounded-lg px-3 py-2 flex items-center justify-between border border-gray-200 dark:border-white/10">
              <input
                type="number"
                value={bet}
                onChange={(e) => setBet(Math.max(0.01, Math.min(wallet?.tokens || 1, parseFloat(e.target.value) || 0.01)))}
                step="0.01"
                min="0.01"
                max={wallet?.tokens || 1}
                disabled={isDropping}
                className="bg-transparent text-gray-900 dark:text-white font-mono w-full outline-none"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setBet(prev => Math.max(0.01, prev / 2))}
                  disabled={isDropping}
                  className="px-2 py-1 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded text-xs text-gray-900 dark:text-white disabled:opacity-50 select-none"
                  style={{ WebkitTouchCallout: 'none' }}
                >
                  1/2
                </button>
                <button
                  onClick={() => setBet(prev => Math.min(wallet?.tokens || 1, prev * 2))}
                  disabled={isDropping}
                  className="px-2 py-1 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded text-xs text-gray-900 dark:text-white disabled:opacity-50 select-none"
                  style={{ WebkitTouchCallout: 'none' }}
                >
                  2x
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Game Mode</label>
            <Select value={gameMode} onValueChange={setGameMode} disabled={isDropping}>
              <SelectTrigger className="bg-gray-100 dark:bg-[#252538] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#252538] border-gray-200 dark:border-white/10">
                <SelectItem value="regular" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10">Regular</SelectItem>
                <SelectItem value="high" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10">High</SelectItem>
                <SelectItem value="nightmare" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10">Nightmare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Rows</label>
            <Select value={rows.toString()} onValueChange={(v) => setRows(parseInt(v))} disabled={isDropping}>
              <SelectTrigger className="bg-gray-100 dark:bg-[#252538] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#252538] border-gray-200 dark:border-white/10">
                {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((num) => (
                  <SelectItem key={num} value={num.toString()} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10">
                    {num} Rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={dropBall}
            disabled={isDropping || bet > (wallet?.tokens || 0)}
            className="w-full font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
          >
            {isDropping ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                DROPPING...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                DROP BALL
              </>
            )}
          </Button>

          {/* History */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">History</label>
            <div className="flex flex-wrap gap-1">
              {history.map((mult, i) => (
                <div
                  key={i}
                  className={`px-2 py-0.5 rounded bg-gradient-to-r ${getBucketColor(mult)} text-white font-bold text-xs`}
                >
                  {mult.toFixed(2)}x
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plinko Board */}
        <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
          <PlinkoBoard
            rows={rows}
            bucketCount={bucketCount}
            currentMultipliers={currentMultipliers}
            balls={balls}
            result={result}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}