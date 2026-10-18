import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROUND_DURATION = 18;

const LOW_MULTIPLIERS = [
  1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09,
  1.1, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19,
  1.2, 1.21, 1.23, 1.25, 1.27, 1.29, 1.31, 1.33, 1.35, 1.38,
  1.4, 1.43, 1.46, 1.5, 1.53, 1.57, 1.61, 1.66, 1.71, 1.76,
  1.8, 1.85, 1.9, 1.95, 2.0,
];

const MID_MULTIPLIERS = [
  2.12, 2.26, 2.44, 2.57, 2.78, 2.96, 3.07, 3.42, 3.75, 4.12,
  4.43, 4.79, 5.25, 5.88, 6.14, 6.6, 7.06, 7.28, 8.18, 9.42,
  10.37, 11.84, 12.62, 13.91, 15.48, 17.22, 18.76,
];

const HIGH_MULTIPLIER_BUCKETS = [
  { values: [22.57, 27.39], count: 2 },
  { values: [41.22, 44.68, 48.9], count: 4 },
  { values: [52.14, 56.47, 59.81], count: 4 },
  { values: [61.35, 66.94, 68.22], count: 4 },
  { values: [71.08, 76.42, 79.55], count: 4 },
  { values: [82.14, 88.63], count: 4 },
  { values: [104.28, 112.76, 126.44, 138.9], count: 4 },
  { values: [204.82, 228.67], count: 2 },
  { values: [301.17, 358.86], count: 2 },
];

const HIGHLIGHT_MULTIPLIERS = [358.86, 228.67, 112.76, 27.39];

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildLowCluster() {
  const clusterLength = 4 + Math.floor(Math.random() * 2);
  return Array.from({ length: clusterLength }, () => pickRandom(LOW_MULTIPLIERS));
}

function buildHighPool() {
  return HIGH_MULTIPLIER_BUCKETS.flatMap((bucket) => {
    const shuffled = shuffleArray(bucket.values);
    return Array.from({ length: bucket.count }, (_, index) => shuffled[index % shuffled.length]);
  });
}

function buildTrack() {
  const highPool = shuffleArray(buildHighPool());
  const midPool = shuffleArray([...MID_MULTIPLIERS, ...MID_MULTIPLIERS, ...MID_MULTIPLIERS]);
  const values = [];

  highPool.forEach((highValue, index) => {
    values.push(...buildLowCluster());
    if (midPool.length > 0) values.push(midPool.pop());
    values.push(...buildLowCluster());
    values.push(highValue);
    values.push(...buildLowCluster());
    if (index % 2 === 0 && midPool.length > 0) values.push(midPool.pop());
  });

  while (midPool.length > 0) {
    values.push(...buildLowCluster());
    values.push(midPool.pop());
  }

  values.push(...buildLowCluster(), ...buildLowCluster());

  return values.map((value, index) => ({ id: `${value}-${index}`, value }));
}

function getTileStyle(value, active) {
  const base = active
    ? 'border-[#2f4655] bg-gradient-to-b from-[#213746] to-[#172b38]'
    : 'border-[#17303f] bg-gradient-to-b from-[#172d3a] to-[#112532]';

  if (value >= 20) {
    return `${base} text-[#f6c14a]`;
  }

  return `${base} text-[#d7e3ec]`;
}

function getTileBarStyle(value, active) {
  if (value >= 20) {
    return active ? 'bg-gradient-to-r from-[#f6c14a] to-[#7b5200]' : 'bg-gradient-to-r from-[#aa7a12] to-[#4a3300]';
  }
  return active ? 'bg-gradient-to-r from-[#f3f5f8] to-[#b5bdc7]' : 'bg-gradient-to-r from-[#7f8e9d] to-[#536170]';
}

export default function SlideGame({ wallet, onBet, currency = 'IC' }) {
  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const [betAmount, setBetAmount] = useState('0.00');
  const [targetMultiplier, setTargetMultiplier] = useState('3.00');
  const [countdown, setCountdown] = useState(ROUND_DURATION);
  const [phase, setPhase] = useState('betting');
  const [participants, setParticipants] = useState(0);
  const [tiles, setTiles] = useState(() => buildTrack());
  const [activeIndex, setActiveIndex] = useState(0);
  const [centerValue, setCenterValue] = useState(tiles[0]?.value || 1);
  const [highlights, setHighlights] = useState(HIGHLIGHT_MULTIPLIERS);
  const [queuedBets, setQueuedBets] = useState([]);
  const [betResults, setBetResults] = useState([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, netGain: 0, amount: 0 });
  const timersRef = useRef([]);

  const visibleTiles = useMemo(() => {
    const total = tiles.length;
    return [-2, -1, 0, 1, 2].map((offset) => {
      const index = (activeIndex + offset + total) % total;
      return { ...tiles[index], offset };
    });
  }, [tiles, activeIndex]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (phase !== 'betting') return prev;
        if (prev <= 1) {
          setPhase('spinning');
          return 0;
        }
        return Number((prev - 0.1).toFixed(1));
      });
    }, 100);

    return () => {
      clearInterval(interval);
      clearTimers();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'spinning') return;

    const roundTiles = buildTrack();
    const winningIndex = Math.floor(Math.random() * roundTiles.length);
    const winningValue = roundTiles[winningIndex].value;
    setTiles(roundTiles);
    setHighlights(roundTiles.slice(winningIndex, winningIndex + 4).map((tile) => tile.value));

    const steps = 28 + Math.floor(Math.random() * 18);
    const base = 65;
    let currentStep = 0;

    const runStep = () => {
      currentStep += 1;
      const progress = currentStep / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const simulatedIndex = Math.floor(eased * winningIndex);
      setActiveIndex(simulatedIndex);
      setCenterValue(roundTiles[simulatedIndex]?.value || 1);

      if (currentStep < steps) {
        const delay = base + progress * 160;
        const timer = setTimeout(runStep, delay);
        timersRef.current.push(timer);
      } else {
        setActiveIndex(winningIndex);
        setCenterValue(winningValue);
        const settledParticipants = queuedBets.length + Math.floor(Math.random() * 16);
        setParticipants(settledParticipants);

        const results = queuedBets.map((bet) => {
          const target = Number(bet.target);
          const won = winningValue >= target;
          const payout = won ? Number((bet.amount * target).toFixed(2)) : 0;
          return { ...bet, won, payout, winningValue };
        });

        results.forEach((result) => {
          if (result.won) {
            onBet(0, result.payout, 'slide');
          }
        });

        if (results.length > 0) {
          const winCount = results.filter((result) => result.won).length;
          const lossCount = results.length - winCount;
          const totalReturned = results.reduce((sum, result) => sum + result.payout, 0);
          const totalStaked = results.reduce((sum, result) => sum + result.amount, 0);
          setBetResults(results.slice(0, 6));
          setStats((prev) => ({
            wins: prev.wins + winCount,
            losses: prev.losses + lossCount,
            netGain: Number((prev.netGain + totalReturned - totalStaked).toFixed(2)),
            amount: Number((prev.amount + totalStaked).toFixed(2)),
          }));
        } else {
          setBetResults([]);
        }

        const resetTimer = setTimeout(() => {
          setQueuedBets([]);
          setPhase('betting');
          setCountdown(ROUND_DURATION);
          setParticipants(Math.floor(Math.random() * 16));
          setHighlights(HIGHLIGHT_MULTIPLIERS);
        }, 1500);
        timersRef.current.push(resetTimer);
      }
    };

    runStep();
  }, [phase]);

  const handlePlay = async () => {
    const amount = Number(betAmount);
    const target = Number(targetMultiplier);
    if (!amount || amount <= 0 || amount > balance || phase !== 'betting') return;

    await onBet(amount, 0, 'slide');
    setQueuedBets((prev) => [{ amount, target, id: crypto.randomUUID() }, ...prev].slice(0, 12));
    setParticipants((prev) => prev + 1);
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-[#102737] border-white/10 overflow-hidden shadow-2xl">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {highlights.map((value, index) => (
              <div
                key={`${value}-${index}`}
                className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold ${
                  index === 1 || index === 2 ? 'bg-[#eef1f5] text-[#172633]' : 'bg-[#243c4d] text-white'
                }`}
              >
                {value.toFixed(2)}×
              </div>
            ))}
            <div className="shrink-0 w-11 h-11 rounded-full bg-[#243c4d] flex items-center justify-center text-white text-lg">↻</div>
          </div>

          <div className="relative rounded-2xl bg-[#0a1f2b] border border-[#163141] px-4 pt-6 pb-4 overflow-hidden min-h-[430px]">
            <div className="absolute left-1/2 top-[160px] bottom-[72px] w-[3px] -translate-x-1/2 bg-[#f3f5f7] rounded-full z-20" />
            <div className="absolute left-1/2 bottom-[62px] h-[18px] w-[18px] -translate-x-1/2 rounded-full bg-[#f3f5f7] z-20" />

            <div className="grid grid-cols-5 gap-2 items-end h-[300px] mt-4">
              {visibleTiles.map((tile) => {
                const isActive = tile.offset === 0;
                return (
                  <motion.div
                    key={tile.id}
                    animate={{ scale: 1, opacity: Math.abs(tile.offset) > 1 ? 0.22 : tile.offset === 0 ? 1 : 0.92 }}
                    className={`rounded-[6px] border flex flex-col items-center justify-between h-[180px] md:h-[188px] pt-7 ${getTileStyle(tile.value, isActive)}`}
                  >
                    <div className="w-16 h-16 relative flex items-center justify-center text-[13px] font-medium">
                      <div className="absolute inset-0 bg-[#102432] [clip-path:polygon(50%_0%,88%_22%,88%_78%,50%_100%,12%_78%,12%_22%)] border border-[#1a3343]" />
                      <span className="relative z-10">{tile.value.toFixed(2)}×</span>
                    </div>
                    <div className={`h-7 w-full rounded-b-[6px] ${getTileBarStyle(tile.value, isActive)}`} />
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-8 text-white text-sm font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff0f6d]" />
              Participants: {participants}
            </div>

            <div className="mt-6">
              <Progress value={phase === 'betting' ? ((ROUND_DURATION - countdown) / ROUND_DURATION) * 100 : 100} className="h-3 rounded-none bg-[#446275] [&>div]:bg-[#6c8799]" />
            </div>
          </div>

          <Button
            onClick={handlePlay}
            disabled={phase !== 'betting' || Number(betAmount) > balance}
            className="w-full h-12 text-[15px] font-semibold bg-[#2b7de7] hover:bg-[#246fd0] rounded-xl"
          >
            Play (Next Round)
          </Button>

          <div className="space-y-4">
            <div>
              <label className="text-[#c7d5df] text-sm mb-2 block">Amount</label>
              <div className="flex items-stretch rounded-xl overflow-hidden border border-[#426072] bg-[#294251]">
                <div className="flex-1 relative">
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="h-12 bg-[#1b2f3c] border-0 text-white shadow-none rounded-none pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ffcc14] font-bold">G</span>
                </div>
                <button onClick={() => setBetAmount((prev) => Math.max(0, Number(prev || 0) / 2).toFixed(2))} className="px-5 text-white text-sm border-l border-[#426072]">½</button>
                <button onClick={() => setBetAmount((prev) => Math.min(balance, Number(prev || 0) * 2).toFixed(2))} className="px-5 text-white text-sm border-l border-[#426072]">2×</button>
              </div>
            </div>

            <div>
              <label className="text-[#c7d5df] text-sm mb-2 block">Target Multiplier</label>
              <Select value={targetMultiplier} onValueChange={setTargetMultiplier}>
                <SelectTrigger className="bg-[#1b2f3c] border-[#426072] text-white h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1.01, 1.1, 1.18, 1.24, 1.34, 1.4, 1.52, 1.89, 2.08, 2.61, 3.0, 3.77, 4.99, 10.04, 22.57, 112.76, 358.86].map((value) => (
                    <SelectItem key={value} value={value.toFixed(2)}>{value.toFixed(2)}×</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <Card className="bg-[#0b1d2a] border-white/5">
              <CardContent className="p-4 space-y-2">
                <div className="text-slate-300 text-sm">Rules</div>
                <ol className="text-slate-100/90 text-sm space-y-1 list-decimal list-inside">
                  <li>Choose a target multiplier before the timer ends.</li>
                  <li>If the result lands on your target or higher, you win that multiplier of your amount.</li>
                  <li>You can place multiple bets in different rounds.</li>
                  <li>The lowest result is 1.00x and the top result can be extremely high.</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="bg-[#0b1d2a] border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>Net Gain</span>
                  <span className={stats.netGain >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.netGain.toLocaleString()} {currency}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>Wins</span>
                  <span className="text-green-400">{stats.wins}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
                  <span>Losses</span>
                  <span className="text-red-400">{stats.losses}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Amount</span>
                  <span className="text-white">{stats.amount.toLocaleString()} {currency}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <AnimatePresence>
            {betResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                {betResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between rounded-xl bg-[#0b1d2a] border border-white/5 px-4 py-3 text-sm">
                    <span className="text-slate-300">Bet {result.amount.toFixed(2)} at {result.target.toFixed(2)}x</span>
                    <span className={result.won ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                      {result.won ? `Won ${result.payout.toFixed(2)} ${currency}` : `Lost on ${result.winningValue.toFixed(2)}x`}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}