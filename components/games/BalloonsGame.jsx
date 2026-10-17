import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, Settings, BarChart3, ShieldCheck } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    balloonClass: 'from-lime-500 to-green-600',
    dotClass: 'bg-lime-400',
    safeChance: 0.84,
    growth: [1.02, 1.07, 1.11, 1.17, 1.23, 1.29, 1.36, 1.44, 1.53, 1.63, 1.75, 1.88, 2.04, 2.23, 2.45, 2.72, 3.06, 3.50, 4.08, 4.90, 6.13, 8.17, 12.25, 24.50],
  },
  normal: {
    label: 'Normal',
    balloonClass: 'from-red-500 to-pink-600',
    dotClass: 'bg-red-400',
    safeChance: 0.58,
    growth: [1.11, 1.27, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03, 4.95, 6.19, 7.88, 10.25, 13.66, 18.78, 26.83, 40.46, 65.74, 112.70, 206.62, 413.23, 929.77, 2479.40, 8677.90, 52067.40],
  },
  hard: {
    label: 'Hard',
    balloonClass: 'from-fuchsia-500 to-pink-700',
    dotClass: 'bg-fuchsia-400',
    safeChance: 0.34,
    growth: [1.23, 1.55, 1.98, 2.56, 3.36, 4.48, 6.08, 8.41, 11.92, 17.34, 26.01, 40.99, 69.18, 127.73, 270.90, 677.25, 2031.75, 8127.00, 48762.00],
  },
  expert: {
    label: 'Expert',
    balloonClass: 'from-pink-500 to-rose-700',
    dotClass: 'bg-pink-400',
    safeChance: 0.2,
    growth: [1.23, 1.66, 2.33, 3.50, 6.13, 12.25, 30.63, 107.21, 562.86, 5065.74, 96249.06],
  },
};

function formatMultiplier(value) {
  return `${value.toFixed(2)}×`;
}

function MultiplierRail({ items, activeIndex, status }) {
  const centerValue = status === 'idle' ? 1 : items[Math.max(0, activeIndex)] || items[0];

  return (
    <div className="px-5 pb-4">
      <div className="overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex gap-1.5 min-w-max pr-5">
          <div className={`w-[122px] shrink-0 rounded-xl py-3 text-center font-bold text-[15px] ${status === 'idle' ? 'bg-[#4d6577] text-white' : 'bg-[#4d6577] text-white/85'}`}>
            {formatMultiplier(1)}
          </div>
          {items.map((value, index) => {
            const isActive = Math.abs(value - centerValue) < 0.0001 && status !== 'idle';
            const isPopped = status === 'popped' && isActive;
            const isPast = status !== 'idle' && index < activeIndex;
            return (
              <div
                key={value}
                className={`w-[122px] shrink-0 rounded-xl py-3 text-center font-bold text-[15px] ${
                  isPopped
                    ? 'bg-rose-600 text-white'
                    : isActive
                      ? 'bg-green-700 text-white'
                      : isPast
                        ? 'bg-[#4d6577] text-white/75'
                        : 'bg-[#4d6577] text-white'
                }`}
              >
                {formatMultiplier(value)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BalloonDisplay({ difficulty, status, activeMultiplier, pumpCount }) {
  const config = DIFFICULTIES[difficulty];
  const scale = 1 + Math.min(pumpCount, 8) * 0.05;

  return (
    <div className="relative rounded-t-2xl bg-[#142c3a] pt-10">
      <div className="relative h-[260px] flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {status === 'popped' ? (
            <motion.div
              key="popped"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-[58px] leading-none font-black text-rose-500">{formatMultiplier(activeMultiplier)}</div>
              <div className="mt-3 inline-block px-4 py-2 rounded-lg bg-black/10 text-white text-xl">Pop</div>
            </motion.div>
          ) : (
            <motion.div
              key={`${difficulty}-${pumpCount}-${status}`}
              animate={{ scale, y: -Math.min(pumpCount, 10) * 4 }}
              transition={{ type: 'spring', stiffness: 140, damping: 16 }}
              className="relative flex flex-col items-center"
            >
              <div className={`relative w-[110px] h-[138px] rounded-[50%] bg-gradient-to-b ${config.balloonClass} shadow-[0_0_35px_rgba(0,0,0,0.18)]`}>
                <div className="absolute inset-x-0 top-[38%] -translate-y-1/2 text-center text-white font-black text-[28px] drop-shadow-md">
                  {formatMultiplier(activeMultiplier)}
                </div>
                <div className="absolute top-3 right-4 w-5 h-3 rounded-full bg-white/70 rotate-[26deg]" />
              </div>
              <div className={`w-4 h-5 -mt-2 bg-gradient-to-b ${config.balloonClass}`} />
              <div className="w-[6px] h-9 bg-[#203845] rounded-full -mt-1" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-7 left-7 right-7 h-12">
          <div className="absolute left-0 bottom-1 w-[120px] h-8 rounded-t-[24px] bg-[#2b4553]" />
          <div className="absolute left-[110px] bottom-1 w-[44px] h-18 h-9 rounded-t-xl bg-[#2b4553]" />
          <div className="absolute left-[146px] right-[20px] bottom-[11px] h-[8px] rounded-full bg-[#2b4553]" />
          <div className="absolute left-[42px] bottom-[17px] flex gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#182833]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#182833]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#182833]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BalloonsGame({ wallet, onBet, currency = 'IC' }) {
  const [difficulty, setDifficulty] = useState('easy');
  const [betAmount, setBetAmount] = useState('0.00');
  const [status, setStatus] = useState('idle');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [lastResultMultiplier, setLastResultMultiplier] = useState(1);
  const [mode, setMode] = useState('manual');
  const [autoPumps, setAutoPumps] = useState(3);
  const [autoRunning, setAutoRunning] = useState(false);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const config = DIFFICULTIES[difficulty];
  const canPlay = Number(betAmount) > 0 && Number(betAmount) <= balance;

  const displayedMultiplier = status === 'popped' ? lastResultMultiplier : activeMultiplier;
  const nextActiveIndex = Math.min(activeIndex + 1, config.growth.length - 1);

  const handleStart = async () => {
    if (!canPlay) return;
    await onBet(Number(betAmount), 0, 'balloons');
    setStatus('active');
    setActiveIndex(0);
    setActiveMultiplier(1);
    setLastResultMultiplier(1);
  };

  const runPumpStep = () => {
    const survives = Math.random() < config.safeChance;
    const upcoming = config.growth[nextActiveIndex];

    if (!survives) {
      setLastResultMultiplier(upcoming);
      setStatus('popped');
      setActiveIndex(nextActiveIndex);
      return false;
    }

    setActiveIndex(nextActiveIndex);
    setActiveMultiplier(upcoming);
    return true;
  };

  const handlePump = () => {
    if (status !== 'active') return;
    runPumpStep();
  };

  const handleCashout = async () => {
    if (status !== 'active') return;
    await onBet(0, Number((Number(betAmount) * activeMultiplier).toFixed(2)), 'balloons');
    setLastResultMultiplier(activeMultiplier);
    setStatus('cashed');
  };

  const resetRound = () => {
    setStatus('idle');
    setActiveIndex(0);
    setActiveMultiplier(1);
    setLastResultMultiplier(1);
    setAutoRunning(false);
  };

  const handleAutoRun = async () => {
    if (!canPlay || autoRunning) return;
    setAutoRunning(true);
    await handleStart();

    let currentRoundActive = true;
    for (let step = 0; step < autoPumps; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      currentRoundActive = runPumpStep();
      if (!currentRoundActive) break;
    }

    if (currentRoundActive) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      await onBet(0, Number((Number(betAmount) * (config.growth[Math.max(0, Math.min(autoPumps - 1, config.growth.length - 1))] || 1)).toFixed(2)), 'balloons');
      setLastResultMultiplier(config.growth[Math.max(0, Math.min(autoPumps - 1, config.growth.length - 1))] || 1);
      setStatus('cashed');
    }

    setAutoRunning(false);
  };

  return (
    <Card className="bg-[#223d4c] border-0 shadow-2xl overflow-hidden rounded-[22px]">
      <CardContent className="p-0">
        <BalloonDisplay
          difficulty={difficulty}
          status={status}
          activeMultiplier={displayedMultiplier}
          pumpCount={activeIndex}
        />

        <MultiplierRail items={config.growth} activeIndex={activeIndex} status={status} />

        <div className="px-3 pb-4 space-y-4 bg-[#294451]">
          <Button
            onClick={status === 'idle' || status === 'popped' || status === 'cashed' ? (mode === 'auto' ? handleAutoRun : handleStart) : handleCashout}
            disabled={(status === 'idle' || status === 'popped' || status === 'cashed') ? (!canPlay || autoRunning) : false}
            className="w-full h-12 rounded-xl bg-[#2d7bda] hover:bg-[#2469bc] text-white font-black text-[17px]"
          >
            {status === 'active' ? 'Cashout' : autoRunning ? 'Running...' : 'Play'}
          </Button>

          <div>
            <label className="text-[#c7d8e3] text-sm mb-2 block">Amount</label>
            <div className="flex items-stretch rounded-xl overflow-hidden border border-white/10 bg-[#1d313c]">
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={status === 'active'}
                className="h-11 bg-transparent border-0 text-white rounded-none shadow-none text-[18px]"
              />
              <div className="flex items-center px-3 text-yellow-400 font-black">G</div>
              <button
                onClick={() => setBetAmount((prev) => Math.max(0, Number(prev || 0) / 2).toFixed(2))}
                disabled={status === 'active'}
                className="px-4 text-white/80 border-l border-white/10 font-semibold"
              >
                ½
              </button>
              <button
                onClick={() => setBetAmount((prev) => Math.min(balance, Number(prev || 0) * 2).toFixed(2))}
                disabled={status === 'active'}
                className="px-4 text-white/80 border-l border-white/10 font-semibold"
              >
                2×
              </button>
            </div>
          </div>

          <Button
            onClick={status === 'active' ? handlePump : resetRound}
            disabled={status !== 'active' || mode === 'auto'}
            className="w-full h-12 rounded-xl bg-[#3d5665] hover:bg-[#486476] text-white font-black text-[17px] disabled:opacity-100 disabled:bg-[#3d5665] disabled:text-white/50"
          >
            Pump
          </Button>

          {mode === 'auto' && status !== 'active' && (
            <div className="rounded-xl border border-white/10 bg-[#1d313c] p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-[#c7d8e3]">
                <span>Auto pumps</span>
                <span className="font-bold text-white">{autoPumps}</span>
              </div>
              <Slider
                value={[autoPumps]}
                min={1}
                max={Math.min(12, config.growth.length)}
                step={1}
                onValueChange={(value) => setAutoPumps(value[0])}
                className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white/40 [&_[data-orientation=horizontal]]:bg-white/15 [&_.bg-primary]:bg-pink-500"
              />
              <div className="text-xs text-white/70">
                Auto will run quickly until pump {autoPumps} or stop early if it pops.
                Target multiplier: {formatMultiplier(config.growth[Math.max(0, Math.min(autoPumps - 1, config.growth.length - 1))] || 1)}
              </div>
            </div>
          )}

          <div>
            <label className="text-[#c7d8e3] text-sm mb-2 block">Total Net Gain ({displayedMultiplier.toFixed(2)}×)</label>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1d313c] px-3 h-12 text-white text-[18px]">
              <span>{status === 'active' || status === 'cashed' ? (Number(betAmount || 0) * displayedMultiplier).toFixed(2) : '0.00'}</span>
              <span className="text-yellow-400 font-black">G</span>
            </div>
          </div>

          <div>
            <label className="text-[#c7d8e3] text-sm mb-2 block">Difficulty</label>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1d313c] px-4 h-12 text-white text-[16px]">
              <span>{config.label}</span>
              <ChevronDown className="w-5 h-5 text-white/80" />
            </div>
            {status !== 'active' && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {Object.entries(DIFFICULTIES).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`rounded-xl py-2 text-sm font-bold ${difficulty === key ? 'bg-[#4d6577] text-white' : 'bg-[#1d313c] text-white/70'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[26px] bg-[#1a2d37] p-1 flex">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 h-12 rounded-[22px] font-bold ${mode === 'manual' ? 'bg-[#4d6577] text-white' : 'text-white'}`}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('auto')}
              className={`flex-1 h-12 rounded-[22px] font-bold ${mode === 'auto' ? 'bg-[#4d6577] text-white' : 'text-white'}`}
            >
              Auto
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 bg-[#294451]">
          <div className="rounded-2xl bg-[#223d4c] p-3 flex items-center justify-between">
            <button className="w-11 h-11 rounded-xl bg-transparent flex items-center justify-center text-white/80">
              <Settings className="w-5 h-5" />
            </button>
            <button className="w-11 h-11 rounded-xl bg-transparent flex items-center justify-center text-white/80">
              <BarChart3 className="w-5 h-5" />
            </button>
            <button className="h-11 px-5 rounded-xl bg-[#4d6577] text-white font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Fairness
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}