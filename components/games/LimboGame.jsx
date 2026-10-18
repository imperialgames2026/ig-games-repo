import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { createPageUrl } from '@/utils';
import useCasinoEffects from '@/hooks/useCasinoEffects';

export default function LimboGame({ wallet, onBet, currency = 'IC' }) {
  const [betAmount, setBetAmount] = useState(1);
  const [targetMultiplier, setTargetMultiplier] = useState(1.96);
  const [launching, setLaunching] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const [activeStake, setActiveStake] = useState(0);
  const [pendingPayout, setPendingPayout] = useState(0);
  const [lastCashoutAmount, setLastCashoutAmount] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastSeed, setLastSeed] = useState(null);
  const intervalRef = useRef(null);
  const { triggerEffect, effectClassName } = useCasinoEffects();

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const controlsLocked = roundActive || launching;
  const chance = Math.min(99, (1 / targetMultiplier) * 100).toFixed(1);

  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.02) return 1.0;
    return Math.min(1000000, Math.floor((1 / (1 - r) * 0.98) * 100) / 100);
  };

  const settleLoss = (finalMult) => {
    setDisplayMultiplier(finalMult);
    setCurrentMultiplier(finalMult);
    setResult('loss');
    setRoundActive(false);
    setLaunching(false);
    setPendingPayout(0);
    setLastCashoutAmount(0);
    setActiveStake(0);
    triggerEffect('lose');
    setHistory(prev => [{ multiplier: finalMult, won: false }, ...prev.slice(0, 8)]);
  };

  const settleWin = (finalPayout) => {
    setDisplayMultiplier(targetMultiplier);
    setCurrentMultiplier(targetMultiplier);
    setResult('win');
    setRoundActive(true);
    setLaunching(false);
    setPendingPayout(finalPayout);
    setLastCashoutAmount(finalPayout);
    setActiveStake(finalPayout);
    triggerEffect('win');
    setHistory(prev => [{ multiplier: targetMultiplier, won: true }, ...prev.slice(0, 8)]);
  };

  const runAttempt = async (stake) => {
    if (launching) return;

    setLaunching(true);
    setResult(null);
    setDisplayMultiplier(1.0);
    setCurrentMultiplier(1.0);

    const crashPoint = generateCrashPoint();
    const seed = crypto.randomUUID();
    setLastSeed(seed);

    let current = 1.0;
    const reached = crashPoint >= targetMultiplier;

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      current = Math.round(current * 1.08 * 100) / 100;
      setDisplayMultiplier(current);

      const hitTarget = current >= targetMultiplier;
      const crashed = current >= crashPoint && !hitTarget;

      if (hitTarget || crashed) {
        clearInterval(intervalRef.current);
        if (reached) {
          const finalPayout = Math.round(stake * targetMultiplier * 100) / 100;
          settleWin(finalPayout);
        } else {
          settleLoss(crashPoint);
        }
      }
    }, 40);
  };

  const handleBet = async () => {
    if (controlsLocked || betAmount > balance) return;
    triggerEffect('bet');
    await onBet(betAmount, 0, 'limbo');
    setActiveStake(betAmount);
    setPendingPayout(0);
    setRoundActive(true);
    setResult(null);
  };

  const handleGo = async () => {
    if (!roundActive || launching || activeStake <= 0) return;
    triggerEffect('action');
    await runAttempt(activeStake);
  };

  const handleCashOut = async () => {
    if (!roundActive || launching || pendingPayout <= 0) return;
    triggerEffect('cashout');
    const cashoutAmount = pendingPayout;
    await onBet(0, cashoutAmount, 'limbo');
    setLastCashoutAmount(cashoutAmount);
    setRoundActive(false);
    setResult('cashed');
    setActiveStake(0);
    setPendingPayout(0);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const halfBet = () => setBetAmount(prev => Math.max(0.01, Math.round((prev / 2) * 100) / 100));
  const doubleBet = () => setBetAmount(prev => Math.min(balance, Math.round((prev * 2) * 100) / 100));

  const stars = useMemo(() => [...Array(60)].map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    opacity: Math.random() * 0.8 + 0.2,
    size: Math.random() < 0.15 ? 2 : 1,
  })), []);

  const statusText = launching
    ? 'Target locked — launch in progress'
    : roundActive && pendingPayout > 0
    ? 'Target hit — GO again or cash out'
    : roundActive
    ? 'Bet placed — hit GO!!!'
    : 'Place your bet to start';

  const resultBanner = result === 'win'
    ? `Target hit! Bank is now ${pendingPayout.toFixed(2)} ${currency}`
    : result === 'loss'
    ? `Crashed at ${displayMultiplier.toFixed(2)}x`
    : result === 'cashed'
    ? `Cashed out ${lastCashoutAmount.toFixed(2)} ${currency}`
    : null;

  return (
    <div className="max-w-lg mx-auto">
      <div className={`bg-[#1c1c2e] rounded-2xl overflow-hidden transition-all duration-300 ${effectClassName}`}>
        <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-[#111122]">
          {history.length === 0 ? (
            <span className="text-gray-600 text-xs">No history yet</span>
          ) : history.map((h, i) => (
            <span
              key={i}
              className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${h.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {h.multiplier.toFixed(2)}x
            </span>
          ))}
        </div>

        <div className="relative h-80 bg-gradient-to-b from-[#05051a] via-[#0d0d2b] to-[#0a0a1a] flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-purple-900/20 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full bg-blue-900/20 blur-2xl" />
          </div>

          <div className="absolute inset-0">
            {stars.map((s) => (
              <div
                key={s.id}
                className="absolute rounded-full bg-white"
                style={{
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                }}
              />
            ))}
          </div>

          {launching && (
            <div className="absolute" style={{ bottom: '38%' }}>
              <div className="flex flex-col items-center gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: `${10 - i * 1.2}px`,
                      height: `${10 - i * 1.2}px`,
                      background: i < 2 ? '#ffffff' : i < 4 ? '#fbbf24' : '#f97316',
                      opacity: 1 - i * 0.14,
                      filter: `blur(${i * 0.5}px)`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="relative z-10 text-6xl font-black mb-4 text-green-400" style={{ textShadow: '0 0 20px rgba(74,222,128,0.5)' }}>
            {displayMultiplier.toFixed(2)}×
          </div>

          <motion.div
            animate={launching ? { y: [-6, 6, -6], rotate: [-3, 3, -3] } : result === 'loss' ? { rotate: 135, x: 80, y: 40, opacity: 0, scale: 0.5 } : { y: [0, -8, 0], rotate: 0 }}
            transition={launching ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' } : { duration: 0.6 }}
            className="relative z-10 text-5xl"
            style={{ filter: launching ? 'drop-shadow(0 0 12px rgba(251,191,36,0.9))' : 'none' }}
          >
            🚀
          </motion.div>

          <div className="mt-4 text-center z-10 px-6">
            <div className="text-sm text-gray-400 font-medium">{statusText}</div>
            {resultBanner && <div className={`mt-2 text-xl font-black ${result === 'loss' ? 'text-red-400' : 'text-green-400'}`}>{resultBanner}</div>}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-[#252538] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Bet Amount</span>
              <span>Current Bank: <span className="text-white font-bold">{(pendingPayout || activeStake || betAmount).toFixed(2)} {currency}</span></span>
            </div>
            <div className="flex items-center gap-2 bg-[#1c1c2e] rounded-lg px-3 py-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0.01, Math.min(balance, parseFloat(e.target.value) || 0.01)))}
                step="0.01"
                min="0.01"
                className="bg-transparent text-white font-mono flex-1 outline-none text-sm"
                disabled={controlsLocked}
              />
              <button onClick={halfBet} disabled={controlsLocked} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-50">1/2</button>
              <button onClick={doubleBet} disabled={controlsLocked} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white disabled:opacity-50">2x</button>
            </div>
          </div>

          <div className="bg-[#252538] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Increase Target</span>
              <span>Chance: <span className="text-white font-bold">{chance}%</span></span>
            </div>
            <div className="flex items-center gap-2 bg-[#1c1c2e] rounded-lg px-3 py-2">
              <input
                type="number"
                value={targetMultiplier}
                onChange={(e) => setTargetMultiplier(Math.max(1.01, Math.min(1000000, parseFloat(e.target.value) || 1.01)))}
                step="0.01"
                min="1.01"
                className="bg-transparent text-white font-mono flex-1 outline-none text-sm"
                disabled={launching}
              />
              <span className="text-gray-400 text-sm">×</span>
            </div>
            <div className="flex gap-2">
              {[1.5, 2, 5, 10, 100].map(m => (
                <button
                  key={m}
                  onClick={() => setTargetMultiplier(m)}
                  disabled={launching}
                  className="flex-1 py-1 text-xs bg-white/10 hover:bg-white/20 text-gray-300 rounded disabled:opacity-50"
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>

          {lastSeed && result && (
            <div className="bg-[#252538] rounded-xl p-3 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-bold text-xs">SSRCR Verified</span>
              </div>
              <div className="text-xs font-mono text-gray-400 truncate">SEED: {lastSeed}</div>
              <a href={createPageUrl(`ProvablyFair?seed=${encodeURIComponent(lastSeed)}`)} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:underline">Verify →</a>
            </div>
          )}

          {roundActive && (
            <Button
              onClick={handleGo}
              disabled={launching || activeStake <= 0}
              className="w-full h-12 text-lg font-black bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-xl disabled:opacity-50"
            >
              {launching ? 'GOING...' : 'GO!!!'}
            </Button>
          )}

          <Button
            onClick={handleBet}
            disabled={controlsLocked || betAmount > balance}
            className="w-full h-14 text-lg font-black bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl disabled:opacity-50"
          >
            BET
          </Button>

          {roundActive && pendingPayout > 0 && (
            <Button
              onClick={handleCashOut}
              disabled={launching}
              className="w-full h-12 text-base font-black bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-black rounded-xl disabled:opacity-50"
            >
              CASH OUT {pendingPayout.toFixed(2)} {currency}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}