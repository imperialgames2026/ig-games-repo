import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ProvablyFairBadge from '@/components/casino/ProvablyFairBadge';
import { toast } from 'sonner';

// Gem types: emerald (green), ruby (red), diamond (purple), rock (gray filler)
const GEMS = ['💚', '🔴', '💎', '🪨'];
const GEM_COLORS = { '💚': '#22c55e', '🔴': '#ef4444', '💎': '#a855f7', '🪨': '#6b7280' };
const GEM_MULTIPLIERS = {
  '💚': 1.0,  // emerald
  '🔴': 2.5,  // ruby
  '💎': 5.0,  // diamond
  '🪨': 0,    // rock (no value)
};

const SKULL = '💀';

function getRandomGem() {
  // 20% skull, 80% gems (emerald/ruby/diamond/rock equally distributed)
  if (Math.random() < 0.2) return SKULL;
  const randomGem = GEMS[Math.floor(Math.random() * GEMS.length)];
  return randomGem;
}

function toRad(deg) { return (deg - 90) * Math.PI / 180; }

function arcPath(cx, cy, r1, r2, sd, ed) {
  const s = toRad(sd), e = toRad(ed);
  const x1 = cx + r2 * Math.cos(s), y1 = cy + r2 * Math.sin(s);
  const x2 = cx + r2 * Math.cos(e), y2 = cy + r2 * Math.sin(e);
  const x3 = cx + r1 * Math.cos(e), y3 = cy + r1 * Math.sin(e);
  const x4 = cx + r1 * Math.cos(s), y4 = cy + r1 * Math.sin(s);
  const large = (ed - sd) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`;
}

const CX = 150, CY = 150, GAP = 2.5;

// Three concentric rings: outer (green), middle (red), inner (purple)
const RING_COLORS = [
  { name: 'green', bg: '#0d2518', active: '#22c55e' },  // outer ring
  { name: 'red',   bg: '#2d1415', active: '#ef4444' },  // middle ring
  { name: 'purple', bg: '#1a0830', active: '#a855f7' }, // inner ring
];

function TwistWheel({ spinning, spinAngle, stackedGems, centerDisplay }) {
  const gemAngleRad = (spinAngle - 90) * Math.PI / 180;
  const gemX = CX + 123 * Math.cos(gemAngleRad);
  const gemY = CY + 123 * Math.sin(gemAngleRad);

  // Display center: spinning indicator or stacked gems or skull reset
  let centerContent = '✨';
  if (spinning) centerContent = '⌛';
  else if (centerDisplay) centerContent = centerDisplay;

  return (
    <svg viewBox="0 0 300 300" className="w-full">
      <defs>
        <radialGradient id="twistBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1040" />
          <stop offset="100%" stopColor="#080612" />
        </radialGradient>
        <filter id="twistGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <circle cx={CX} cy={CY} r="148" fill="url(#twistBg)" />
      
      {/* Three concentric rings */}
      {/* Outer ring - GREEN */}
      <circle cx={CX} cy={CY} r="138" fill="none" stroke={RING_COLORS[0].bg} strokeWidth="28" opacity="0.6" />
      
      {/* Middle ring - RED */}
      <circle cx={CX} cy={CY} r="104" fill="none" stroke={RING_COLORS[1].bg} strokeWidth="28" opacity="0.6" />
      
      {/* Inner ring - PURPLE */}
      <circle cx={CX} cy={CY} r="68" fill="none" stroke={RING_COLORS[2].bg} strokeWidth="28" opacity="0.6" />

      {/* Spinning gem indicator */}
      {spinning && (
        <>
          <circle cx={gemX} cy={gemY} r={7} fill="#e0f2fe" filter="url(#twistGlow)" />
          <circle cx={gemX} cy={gemY} r={4} fill="#ffffff" />
        </>
      )}

      {/* Center backing */}
      <circle cx={CX} cy={CY} r="33" fill="#080612" />
      <circle cx={CX} cy={CY} r="31" fill="none" stroke="#2a1a4a" strokeWidth="1.5" />

      {/* Center display */}
      <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize="26">
        {centerContent}
      </text>
    </svg>
  );
}

export default function TwistGame({ wallet, currency, onBet, onWin, onLoss }) {
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [stackedGems, setStackedGems] = useState([]);
  const [stackedMultiplier, setStackedMultiplier] = useState(0);
  const [history, setHistory] = useState([]);
  const [centerDisplay, setCenterDisplay] = useState(null);
  const [lastSeed, setLastSeed] = useState(null);
  const [lastHash, setLastHash] = useState(null);
  const rafRef = useRef(null);
  const spinStartRef = useRef(null);

  const balance = currency === 'IC' ? (wallet?.tokens || 0) : (wallet?.cat_dollars || 0);
  const SPIN_DURATION = 2600;

  // Animate spin angle with RAF
  useEffect(() => {
    if (!spinning) return;

    const startAngle = spinAngle;
    const targetDelta = 1080 + Math.random() * 360;
    spinStartRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - spinStartRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);
      // Ease out cubic
      const t = 1 - Math.pow(1 - progress, 3);
      setSpinAngle(startAngle + t * targetDelta);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spinning]);

  const handleBet = () => {
    if (spinning) return;
    if (betAmount > balance) { toast.error('Insufficient balance'); return; }

    setSpinning(true);
    onBet(betAmount);

    const response = base44.functions.invoke('generateTwistOutcomeSSRCR', {
      bet_amount: betAmount,
      currency,
    });

    setTimeout(async () => {
      setSpinning(false);
      const { data } = await response;
      setLastSeed(data.seed);
      setLastHash(data.hash);
      const firstOutcome = data.outcomes[0];

      if (!firstOutcome || firstOutcome.type === 'skull' || data.skull_hit) {
        toast.error('💀 Skull! All stacked gems reset!');
        setStackedGems([]);
        setStackedMultiplier(0);
        setCenterDisplay('💀');
        setHistory(prev => [{ gem: SKULL }, ...prev].slice(0, 5));
        setTimeout(() => setCenterDisplay(null), 1500);
        onLoss(betAmount);
      } else {
        const gemValue = firstOutcome.multiplier;
        const gem = gemValue >= 3 ? '💎' : gemValue >= 2 ? '🔴' : '💚';
        const newStack = [...stackedGems, gem];
        const newMultiplier = stackedMultiplier + gemValue;

        setStackedGems(newStack);
        setStackedMultiplier(newMultiplier);
        setCenterDisplay(gem);

        toast.success(`${gem} +${gemValue}x = ${newMultiplier.toFixed(1)}x total`);
        setHistory(prev => [{ gem, multiplier: newMultiplier }, ...prev].slice(0, 5));

        setTimeout(() => setCenterDisplay(null), 1000);
      }
    }, SPIN_DURATION + 100);
  };

  const handleCashOut = () => {
    if (stackedMultiplier <= 0) return;
    const payout = betAmount * stackedMultiplier;
    onWin(payout);
    toast.success(`Cashed out ${payout.toFixed(2)}!`);
    setStackedGems([]);
    setStackedMultiplier(0);
    setCenterDisplay(null);
  };

  return (
    <div className="flex flex-col items-center px-4 py-4 bg-[#0f0b1e]">
      {/* History badges */}
      <div className="flex gap-2 mb-4 w-full max-w-sm justify-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const h = history[i];
          return (
            <div key={i} className={`flex-1 py-1.5 rounded text-xs font-bold text-center ${
              !h ? 'bg-[#1a1a2e] text-gray-600' :
              h.gem === SKULL ? 'bg-red-900 text-red-200' :
              'bg-purple-800 text-purple-200'
            }`}>
              {h ? h.gem || '—' : '—'}
            </div>
          );
        })}
      </div>

      {/* Wheel */}
      <div className="w-full max-w-[290px] mx-auto mb-2">
        <TwistWheel
          spinning={spinning}
          spinAngle={spinAngle}
          stackedGems={stackedGems}
          centerDisplay={centerDisplay}
        />
      </div>

      {/* Stacked multiplier display */}
      <div className="text-center mb-4 text-sm">
        <div className="text-gray-400 mb-1">Stacked Gems</div>
        <div className="flex gap-1 justify-center mb-2 min-h-[24px]">
          {stackedGems.map((g, i) => (
            <span key={i} className="text-lg">{g}</span>
          ))}
        </div>
        <span className={stackedMultiplier > 0 ? 'text-green-400 font-bold text-lg' : 'text-gray-500'}>
          {stackedMultiplier.toFixed(1)}x multiplier
        </span>
      </div>

      {lastHash && <div className="w-full max-w-sm mb-4"><ProvablyFairBadge seed={lastSeed} hash={lastHash} /></div>}

      {/* Spin button */}
      <Button
        className="w-full max-w-sm h-12 bg-green-500 hover:bg-green-600 active:bg-green-700 text-black font-bold text-lg mb-4 rounded-xl"
        onClick={handleBet}
        disabled={spinning}
      >
        {spinning ? 'Spinning...' : 'Spin'}
      </Button>

      {/* Amount control */}
      <div className="w-full max-w-sm bg-[#1a1a2e] rounded-xl p-3 mb-3">
        <div className="text-xs text-gray-400 mb-2">Bet Amount</div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-[#0d0d1f] rounded-lg px-3 py-2">
            <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(Math.max(1, parseFloat(e.target.value) || 1))}
              className="bg-transparent text-white text-sm w-full outline-none"
              min="1"
              disabled={stackedGems.length > 0}
            />
          </div>
          <button
            onClick={() => setBetAmount(p => Math.max(1, Math.floor(p / 2)))}
            className="px-3 py-2 bg-[#0d0d1f] text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
            disabled={stackedGems.length > 0}
          >½</button>
          <button
            onClick={() => setBetAmount(p => p * 2)}
            className="px-3 py-2 bg-[#0d0d1f] text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
            disabled={stackedGems.length > 0}
          >2×</button>
        </div>
      </div>

      {/* Cash out button */}
      <Button
        className="w-full max-w-sm bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl"
        onClick={handleCashOut}
        disabled={stackedMultiplier <= 0 || spinning}
      >
        Cash Out — {(betAmount * stackedMultiplier).toFixed(2)}
      </Button>
    </div>
  );
}