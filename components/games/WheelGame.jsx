import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import { toast } from 'sonner';
import useCasinoEffects from '@/hooks/useCasinoEffects';

const SEGMENT_COUNTS = [10, 20, 30, 40, 50];

const SEGMENT_PRESETS = {
  low: {
    10: [0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18],
    20: [0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18],
    30: [0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18],
    40: [0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48],
    50: [0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0, 1.48, 1.18, 1.18, 1.18, 1.18, 0, 1.18, 1.18, 1.18, 1.18, 0]
  },
  medium: {
    10: [0, 1.48, 1.88, 1.97, 2.96, 0, 1.48, 1.88, 1.97, 2.96],
    20: [0, 1.48, 1.88, 1.97, 2.96, 0, 1.48, 1.88, 1.97, 2.96, 0, 1.48, 1.88, 1.97, 2.96, 0, 1.48, 1.88, 1.97, 2.96],
    30: [0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96],
    40: [0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96],
    50: [0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 4.94, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 4.94, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48, 1.58, 1.97, 2.96, 4.94, 0, 1.48, 1.58, 1.97, 2.96, 0, 1.48]
  },
  high: {
    10: [0, 0, 0, 0, 9.8, 0, 0, 0, 0, 0],
    20: [0, 0, 0, 0, 0, 19.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    30: [0, 0, 0, 0, 0, 0, 29.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    40: [0, 0, 0, 0, 0, 0, 0, 0, 39.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    50: [0, 0, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
};

const MULTIPLIER_COLORS = {
  0: '#ffffff',
  1.18: '#3b82f6',
  1.48: '#3b82f6',
  1.58: '#22c55e',
  1.88: '#22c55e',
  1.97: '#f59e0b',
  2.96: '#a855f7',
  4.94: '#ef4444',
  9.8: '#3b82f6',
  19.6: '#ef4444',
  29.4: '#ef4444',
  39.2: '#ef4444',
  49: '#ef4444'
};

function buildSegments(risk, count) {
  return SEGMENT_PRESETS[risk][count].map((mult) => ({
    mult,
    color: MULTIPLIER_COLORS[mult]
  }));
}

export default function WheelGame({ wallet, currency, onBet, onWin, onLoss, onFreeSpinUsed }) {
  const freeSpins = wallet?.free_spins || 0;
  const freeSpinBet = wallet?.free_spin_bet_amount || 0;
  const [betAmount, setBetAmount] = useState(10);
  const [risk, setRisk] = useState('low');
  const [segCount, setSegCount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const { triggerEffect, effectClassName } = useCasinoEffects();
  const segments = useMemo(() => buildSegments(risk, segCount), [risk, segCount]);
  const sliceAngle = 360 / segments.length;

  const uniqueMults = useMemo(() => {
    const seen = new Set();
    return segments
      .filter(s => { if (seen.has(s.mult)) return false; seen.add(s.mult); return true; })
      .sort((a, b) => a.mult - b.mult);
  }, [segments]);

  const handleBet = (isFreeSpin = false) => {
    const amt = isFreeSpin ? freeSpinBet : parseFloat(betAmount);
    if (!isFreeSpin && (!amt || amt <= 0 || amt > balance)) { toast.error('Invalid bet amount'); return; }
    if (spinning) return;

    triggerEffect('bet');
    if (isFreeSpin) {
      onFreeSpinUsed?.();
      toast.info(`🎟️ Using free spin! Bet: ${freeSpinBet.toLocaleString()}`);
    } else {
      onBet(amt);
    }
    setSpinning(true);
    setResult(null);

    const response = base44.functions.invoke('generateWheelOutcomeSSRCR', {
      bet_amount: amt,
      risk,
      segment_count: segCount,
      currency,
    });

    setTimeout(async () => {
      const { data } = await response;
      const winIndex = data.segment_index;
      const targetRotation = 360 * 6 + (360 - winIndex * sliceAngle - sliceAngle / 2);
      setRotation(prev => prev + targetRotation);
      setLastSeed(data.seed);
      setLastHash(data.hash);
      const serverResult = {
        mult: Number(data.multiplier || 0),
        color: MULTIPLIER_COLORS[Number(data.multiplier || 0)] || '#ffffff'
      };
      setResult(serverResult);
      setSpinning(false);
      if (serverResult.mult > 0) {
        triggerEffect('win');
        const payout = Math.floor(Number(data.win_amount || 0));
        onWin(payout, amt);
        toast.success(`🎉 ${serverResult.mult}x — Won ${payout.toLocaleString()} ${currency}!`);
      } else {
        triggerEffect('lose');
        onLoss(amt);
        toast.error('💀 0.00x — Better luck next time!');
      }
    }, 4500);
  };

  // SVG ring segment path
  const ringPath = (i) => {
    const toRad = d => (d * Math.PI) / 180;
    const cx = 100, cy = 100, r1 = 96, r2 = 68;
    const start = i * sliceAngle - 90;
    const end = (i + 1) * sliceAngle - 90;
    const large = sliceAngle > 180 ? 1 : 0;
    const x1o = cx + r1 * Math.cos(toRad(start)), y1o = cy + r1 * Math.sin(toRad(start));
    const x2o = cx + r1 * Math.cos(toRad(end)),   y2o = cy + r1 * Math.sin(toRad(end));
    const x1i = cx + r2 * Math.cos(toRad(end)),   y1i = cy + r2 * Math.sin(toRad(end));
    const x2i = cx + r2 * Math.cos(toRad(start)), y2i = cy + r2 * Math.sin(toRad(start));
    return `M ${x1o} ${y1o} A ${r1} ${r1} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${r2} ${r2} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };

  return (
    <div className={`min-h-screen bg-[#0f0b1e] text-white flex flex-col items-center px-4 pt-6 pb-8 transition-all duration-300 ${effectClassName}`}>
      <p className="text-gray-400 text-sm mb-6">Game result will be displayed</p>

      {/* Wheel */}
      <div className="relative w-64 h-64 mb-6">
        {/* Pointer / mascot */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 text-2xl" style={{ marginTop: '-4px' }}>
          😈
        </div>

        <motion.div
          className="w-full h-full"
          animate={{ rotate: rotation }}
          transition={{ duration: 4.5, ease: [0.17, 0.67, 0.12, 0.99] }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {/* Ring segments */}
            {segments.map((seg, i) => (
              <path key={i} d={ringPath(i)} fill={seg.color} stroke="#0f0b1e" strokeWidth="0.8" />
            ))}
            {/* White thin inner border */}
            <circle cx="100" cy="100" r="68" fill="none" stroke="#ffffff20" strokeWidth="1" />
            {/* Dark center */}
            <circle cx="100" cy="100" r="67" fill="#1a1628" />
            {/* Subtle center radial lines */}
            {segments.map((_, i) => {
              const toRad = d => (d * Math.PI) / 180;
              const angle = i * sliceAngle - 90;
              const x1 = 100 + 20 * Math.cos(toRad(angle));
              const y1 = 100 + 20 * Math.sin(toRad(angle));
              const x2 = 100 + 65 * Math.cos(toRad(angle));
              const y2 = 100 + 65 * Math.sin(toRad(angle));
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff08" strokeWidth="0.5" />;
            })}
            {/* Small center dot */}
            <circle cx="100" cy="100" r="6" fill="#2a2040" stroke="#3a3060" strokeWidth="1" />
          </svg>
        </motion.div>
      </div>

      {/* Multiplier display tabs */}
      <div className="flex gap-1 mb-6 flex-wrap justify-center max-w-sm">
        {uniqueMults.map((m, i) => (
          <div
            key={i}
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{
              backgroundColor: m.mult === 0 ? '#ffffff22' : m.color + '22',
              borderBottom: `2px solid ${m.mult === 0 ? '#ffffff' : m.color}`,
              color: m.mult === 0 ? '#ffffff' : m.color,
            }}
          >
            {m.mult === 0 ? '0.00x' : `${m.mult.toFixed(2)}x`}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="w-full max-w-sm space-y-5">
        {/* Amount */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-400 text-sm">Amount</span>
            <span className="text-gray-500 text-xs">Balance: {balance.toLocaleString()} {currency}</span>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(parseFloat(e.target.value) || 0)}
              className="bg-white/5 border-white/10 text-white flex-1"
              min={1}
            />
            <button onClick={() => setBetAmount(v => Math.max(1, Math.floor(v / 2)))} className="px-3 py-2 bg-white/10 rounded text-sm font-bold hover:bg-white/20 transition-colors">½</button>
            <button onClick={() => setBetAmount(v => Math.min(balance, v * 2))} className="px-3 py-2 bg-white/10 rounded text-sm font-bold hover:bg-white/20 transition-colors">2×</button>
          </div>
        </div>

        {/* Segments slider */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400 text-sm">Segments</span>
            <span className="text-white text-sm font-bold">{segCount}</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            value={SEGMENT_COUNTS.indexOf(segCount)}
            onChange={e => setSegCount(SEGMENT_COUNTS[parseInt(e.target.value)])}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10</span><span>50</span>
          </div>
        </div>

        {/* Risk Level */}
        <div>
          <span className="text-gray-400 text-sm block mb-2">Risk Level</span>
          <div className="grid grid-cols-3 gap-2">
            {['Low', 'Medium', 'High'].map(r => (
              <button
                key={r}
                onClick={() => setRisk(r.toLowerCase())}
                className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  risk === r.toLowerCase()
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Free Spins Banner */}
        {freeSpins > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-pink-500/20 border border-pink-500/40">
            <span className="text-pink-300 font-bold text-sm">🎟️ {freeSpins} Free Spin{freeSpins !== 1 ? 's' : ''} Available</span>
            <span className="text-gray-400 text-xs">{freeSpinBet.toLocaleString()} per spin</span>
          </div>
        )}

        {lastHash && <div className="mb-4"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

        {/* Bet Button */}
        <button
          onClick={() => handleBet(false)}
          disabled={spinning}
          className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-lg transition-colors"
        >
          {spinning ? 'Spinning...' : 'Bet'}
        </button>

        {freeSpins > 0 && (
          <button
            onClick={() => handleBet(true)}
            disabled={spinning}
            className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors"
          >
            {spinning ? 'Spinning...' : `🎟️ Use Free Spin (${freeSpinBet.toLocaleString()} bet)`}
          </button>
        )}
      </div>

      {/* Result Banner */}
      {result && !spinning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-5 w-full max-w-sm p-4 rounded-xl text-center border ${
            result.mult > 0
              ? 'bg-green-900/30 border-green-500/40 text-green-300'
              : 'bg-red-900/30 border-red-500/40 text-red-300'
          }`}
        >
          <p className="font-bold text-lg">
            {result.mult > 0
              ? `${result.mult.toFixed(2)}x — You won ${Math.floor((result.mult || 0) * betAmount).toLocaleString()} ${currency}!`
              : 'No win — Try again!'}
          </p>
        </motion.div>
      )}
    </div>
  );
}