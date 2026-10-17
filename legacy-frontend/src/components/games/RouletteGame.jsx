import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import RouletteWheelVisual from './RouletteWheelVisual';
import { rouletteNumbers, boardNumbers } from './rouletteData';

const DEFAULT_BOARD = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/f1c1d3180_1860760b8_generated_image.png';
const DEFAULT_WHEEL = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/510d4508f_50da35acb_generated_image.png';

export default function RouletteGame({ wallet, onBet, currency = 'IC', boardImage = DEFAULT_BOARD, wheelImage = DEFAULT_WHEEL }) {
  const [betAmount, setBetAmount] = useState(1);
  const [bets, setBets] = useState({});
  const [betHistory, setBetHistory] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [winningIndex, setWinningIndex] = useState(0);

  const totalBet = useMemo(() => Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0), [bets]);

  const placeBet = (betType, value) => {
    if (spinning) return;
    const betKey = `${betType}-${value}`;
    setBetHistory(prev => [...prev, { betKey, betType, value, amount: betAmount }]);
    setBets(prev => ({
      ...prev,
      [betKey]: { type: betType, value, amount: (prev[betKey]?.amount || 0) + betAmount }
    }));
  };

  const clearBets = () => {
    setBets({});
    setBetHistory([]);
    setResult(null);
  };

  const undoLastBet = () => {
    if (betHistory.length === 0 || spinning) return;
    const lastBet = betHistory[betHistory.length - 1];
    setBetHistory(prev => prev.slice(0, -1));
    setBets(prev => {
      const next = { ...prev };
      const current = next[lastBet.betKey];
      if (!current) return prev;
      if (current.amount <= lastBet.amount) delete next[lastBet.betKey];
      else next[lastBet.betKey] = { ...current, amount: current.amount - lastBet.amount };
      return next;
    });
  };

  const checkWin = (bet, winNum, winColor) => {
    switch (bet.type) {
      case 'straight':
        return bet.value === winNum ? bet.amount * 35 : 0;
      case 'red':
        return winColor === 'red' ? bet.amount * 2 : 0;
      case 'black':
        return winColor === 'black' ? bet.amount * 2 : 0;
      case 'even':
        return winNum !== 0 && winNum % 2 === 0 ? bet.amount * 2 : 0;
      case 'odd':
        return winNum !== 0 && winNum % 2 === 1 ? bet.amount * 2 : 0;
      case 'low':
        return winNum >= 1 && winNum <= 18 ? bet.amount * 2 : 0;
      case 'high':
        return winNum >= 19 && winNum <= 36 ? bet.amount * 2 : 0;
      case 'dozen':
        if (bet.value === 1 && winNum >= 1 && winNum <= 12) return bet.amount * 3;
        if (bet.value === 2 && winNum >= 13 && winNum <= 24) return bet.amount * 3;
        if (bet.value === 3 && winNum >= 25 && winNum <= 36) return bet.amount * 3;
        return 0;
      default:
        return 0;
    }
  };

  const currentBalance = currency === 'ID' ? (wallet?.cat_dollars || 0) : (wallet?.tokens || 0);

  const spin = async () => {
    if (totalBet === 0 || spinning || totalBet > currentBalance) return;

    setSpinning(true);
    setResult(null);

    const winningNumber = rouletteNumbers[Math.floor(Math.random() * rouletteNumbers.length)];
    const winIndex = rouletteNumbers.findIndex(n => n.num === winningNumber.num);
    const segmentAngle = 360 / rouletteNumbers.length;
    const normalizedTarget = (360 - (winIndex * segmentAngle)) % 360;
    setWinningIndex(winIndex);
    setWheelRotation((prev) => prev + 360 * 5 + normalizedTarget);
    setBallRotation((prev) => prev - 360 * 8 - normalizedTarget);

    await new Promise(resolve => setTimeout(resolve, 4800));

    let totalWin = 0;
    Object.values(bets).forEach(bet => {
      totalWin += checkWin(bet, winningNumber.num, winningNumber.color);
    });

    setResult({
      number: winningNumber.num,
      color: winningNumber.color,
      totalWin,
      net: totalWin - totalBet,
    });

    if (onBet) await onBet(totalBet, totalWin);
    setSpinning(false);
  };

  const chipTotal = (key) => bets[key]?.amount || 0;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#1a1010] to-[#0A0612] p-4 shadow-[0_0_30px_rgba(236,72,153,0.12)]">
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-black/30 p-3 pt-[22%]">
          <RouletteWheelVisual wheelRotation={wheelRotation} ballRotation={ballRotation} winningIndex={winningIndex} spinning={spinning} wheelImage={wheelImage} />
          <img src={boardImage} alt="Roulette board" className="w-full rounded-xl object-contain" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-12 grid-rows-[auto_repeat(3,1fr)_auto_auto] gap-1 p-[10.5%_21%_8.5%_24%] sm:p-[10.5%_20%_8.5%_24%]">
            <div className="col-span-12 grid grid-cols-12 gap-1 opacity-0">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} />)}
            </div>
            {boardNumbers.map((row, rowIdx) => (
              <React.Fragment key={rowIdx}>
                {row.map((num) => (
                  <button
                    key={num}
                    onClick={() => placeBet('straight', num)}
                    className="pointer-events-auto relative rounded-md"
                  >
                    {chipTotal(`straight-${num}`) > 0 && (
                      <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-[10px] font-black text-white shadow-lg">
                        {chipTotal(`straight-${num}`).toFixed(0)}
                      </span>
                    )}
                  </button>
                ))}
              </React.Fragment>
            ))}
            <div className="col-span-4">
              <button onClick={() => placeBet('dozen', 1)} className="pointer-events-auto relative h-full w-full rounded-md">
                {chipTotal('dozen-1') > 0 && <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-[10px] font-black text-white shadow-lg">{chipTotal('dozen-1').toFixed(0)}</span>}
              </button>
            </div>
            <div className="col-span-4">
              <button onClick={() => placeBet('dozen', 2)} className="pointer-events-auto relative h-full w-full rounded-md">
                {chipTotal('dozen-2') > 0 && <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-[10px] font-black text-white shadow-lg">{chipTotal('dozen-2').toFixed(0)}</span>}
              </button>
            </div>
            <div className="col-span-4">
              <button onClick={() => placeBet('dozen', 3)} className="pointer-events-auto relative h-full w-full rounded-md">
                {chipTotal('dozen-3') > 0 && <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-[10px] font-black text-white shadow-lg">{chipTotal('dozen-3').toFixed(0)}</span>}
              </button>
            </div>
            {[
              ['low-low', 'low'],
              ['even-even', 'even'],
              ['red-red', 'red'],
              ['black-black', 'black'],
              ['odd-odd', 'odd'],
              ['high-high', 'high'],
            ].map(([key, type]) => (
              <div key={key} className="col-span-2">
                <button onClick={() => placeBet(type, type)} className="pointer-events-auto relative h-full w-full rounded-md">
                  {chipTotal(`${type}-${type}`) > 0 && <span className="absolute inset-0 m-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-pink-500 text-[10px] font-black text-white shadow-lg">{chipTotal(`${type}-${type}`).toFixed(0)}</span>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>


      {result && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="mb-2 text-sm text-gray-400">Winning Number</div>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black text-white"
            style={{ backgroundColor: result.color === 'red' ? '#dc2626' : result.color === 'black' ? '#111827' : '#16a34a' }}>
            {result.number}
          </div>
          <div className={`text-xl font-black ${result.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {result.net >= 0 ? '+' : ''}{result.net.toFixed(2)} {currency}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <span className="text-sm font-bold text-gray-300">Chip Value</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(1, Math.min(1000, parseFloat(e.target.value) || 1)))}
              min="1"
              max="1000"
              disabled={spinning}
              className="ml-auto w-28 bg-transparent text-right text-lg font-black text-white outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 25, 100].map(v => (
              <Button key={v} variant="outline" onClick={() => setBetAmount(v)} disabled={spinning} className="border-white/10 bg-black/20 text-white hover:bg-white/10">
                {v}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className="text-sm font-bold text-gray-300">Total Bet</span>
          <span className="text-xl font-black text-amber-300">{totalBet.toFixed(2)} {currency}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button onClick={undoLastBet} disabled={spinning || betHistory.length === 0} variant="outline" className="border-white/10 bg-black/20 text-white hover:bg-white/10">
            Undo
          </Button>
          <Button onClick={clearBets} disabled={spinning || totalBet === 0} variant="outline" className="border-white/10 bg-black/20 text-white hover:bg-white/10">
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button onClick={spin} disabled={spinning || totalBet === 0 || totalBet > currentBalance} className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:from-amber-500 hover:to-yellow-500">
            {spinning ? 'Spinning...' : 'Spin'}
          </Button>
        </div>

        {totalBet > currentBalance && (
          <p className="text-center text-sm text-red-400">Insufficient balance</p>
        )}
      </div>
    </div>
  );
}