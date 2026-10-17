import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Crown, Star, Zap, Gift } from 'lucide-react';

const TIERS = [
  {
    key: 'luck',
    name: 'LUCK WIN',
    label: 'Luck Win',
    minLevel: 1,
    minVIPLevel: 1,
    jackpot: '1 BTC',
    bgColor: 'from-green-600 to-green-800',
    borderColor: 'border-green-400',
    glowColor: 'shadow-green-500/60',
    centerColor: '#16a34a',
    badgeColor: 'bg-green-600',
  },
  {
    key: 'super',
    name: 'SUPER WIN',
    label: 'Super Win',
    minLevel: 38,
    minVIPLevel: 38,
    jackpot: '3 BTC',
    bgColor: 'from-orange-500 to-amber-700',
    borderColor: 'border-amber-400',
    glowColor: 'shadow-amber-500/60',
    centerColor: '#d97706',
    badgeColor: 'bg-amber-600',
  },
  {
    key: 'mega',
    name: 'MEGA WIN',
    label: 'Mega Win',
    minLevel: 70,
    minVIPLevel: 70,
    jackpot: '5 BTC',
    bgColor: 'from-purple-600 to-purple-900',
    borderColor: 'border-purple-400',
    glowColor: 'shadow-purple-500/60',
    centerColor: '#7c3aed',
    badgeColor: 'bg-purple-600',
  },
];

const DEFAULT_SLOTS = {
  luck:  [
    { label: '0.5 ID', color: '#16a34a', weight: 30 },
    { label: '100 ID', color: '#15803d', weight: 15 },
    { label: 'XP x10', color: '#166534', weight: 25 },
    { label: '20 ID', color: '#16a34a', weight: 30 },
    { label: 'Free Spin', color: '#15803d', weight: 20 },
    { label: '10 ID', color: '#166534', weight: 30 },
    { label: 'Freebet', color: '#16a34a', weight: 20 },
    { label: '2 ID', color: '#15803d', weight: 30 },
    { label: '5 ID', color: '#166534', weight: 25 },
    { label: '1 BTC', color: '#facc15', weight: 0, is_jackpot: true },
  ],
  super: [
    { label: '10 ID', color: '#d97706', weight: 30 },
    { label: '500 ID', color: '#b45309', weight: 10 },
    { label: 'XP x10', color: '#92400e', weight: 25 },
    { label: '100 ID', color: '#d97706', weight: 20 },
    { label: 'Free Spin 30', color: '#b45309', weight: 20 },
    { label: '50 ID', color: '#92400e', weight: 30 },
    { label: 'Freebet', color: '#d97706', weight: 20 },
    { label: '20 ID', color: '#b45309', weight: 30 },
    { label: '30 ID', color: '#92400e', weight: 25 },
    { label: '3 BTC', color: '#facc15', weight: 0, is_jackpot: true },
  ],
  mega: [
    { label: '20 ID', color: '#7c3aed', weight: 30 },
    { label: '999 ID', color: '#6d28d9', weight: 8 },
    { label: 'XP x10', color: '#5b21b6', weight: 25 },
    { label: '200 ID', color: '#7c3aed', weight: 15 },
    { label: 'Free Spin 50', color: '#6d28d9', weight: 20 },
    { label: '150 ID', color: '#5b21b6', weight: 25 },
    { label: 'Freebet', color: '#7c3aed', weight: 20 },
    { label: '50 ID', color: '#6d28d9', weight: 30 },
    { label: '100 ID', color: '#5b21b6', weight: 25 },
    { label: '5 BTC', color: '#facc15', weight: 0, is_jackpot: true },
  ],
};

function SpinWheelCanvas({ slots, spinning, targetIndex, onSpinEnd, tier }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const currentAngleRef = useRef(0);
  const [displayAngle, setDisplayAngle] = useState(0);

  const slotCount = slots.length;
  const arcSize = (2 * Math.PI) / slotCount;

  useEffect(() => {
    drawWheel(currentAngleRef.current);
  }, [slots]);

  useEffect(() => {
    if (!spinning) return;
    
    // Calculate target angle - land on targetIndex
    // Each slot is arcSize radians, index 0 is at top
    const slotAngle = (arcSize * targetIndex);
    const fullRotations = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
    const targetTotal = fullRotations * 2 * Math.PI + (2 * Math.PI - slotAngle - arcSize / 2);
    
    const startAngle = currentAngleRef.current % (2 * Math.PI);
    const totalDelta = targetTotal;
    const duration = 5000;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const angle = startAngle + totalDelta * eased;
      currentAngleRef.current = angle;
      drawWheel(angle);
      setDisplayAngle(angle);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onSpinEnd();
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, targetIndex]);

  function drawWheel(angle) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 10;

    ctx.clearRect(0, 0, size, size);

    // Outer ring glow
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = tier === 'luck' ? '#22c55e' : tier === 'super' ? '#f59e0b' : '#a855f7';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, 2 * Math.PI);
    ctx.strokeStyle = tier === 'luck' ? '#4ade80' : tier === 'super' ? '#fbbf24' : '#c084fc';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();

    // Draw slots
    slots.forEach((slot, i) => {
      const startAngle = angle + i * arcSize - Math.PI / 2;
      const endAngle = startAngle + arcSize;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Alternating lighter/darker shades
      const baseColor = slot.color || '#7c3aed';
      ctx.fillStyle = i % 2 === 0 ? baseColor : adjustBrightness(baseColor, -20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Label
      ctx.save();
      const labelAngle = angle + i * arcSize + arcSize / 2 - Math.PI / 2;
      const labelRadius = radius * 0.65;
      ctx.translate(cx + labelRadius * Math.cos(labelAngle), cy + labelRadius * Math.sin(labelAngle));
      ctx.rotate(labelAngle + Math.PI / 2);
      ctx.fillStyle = slot.is_jackpot ? '#facc15' : '#ffffff';
      ctx.font = `bold ${slot.is_jackpot ? 11 : 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = slot.is_jackpot ? 8 : 0;
      ctx.shadowColor = '#facc15';
      // Word wrap for long labels
      const words = slot.label.split(' ');
      if (words.length > 1) {
        ctx.fillText(words[0], 0, -6);
        ctx.fillText(words.slice(1).join(' '), 0, 8);
      } else {
        ctx.fillText(slot.label, 0, 4);
      }
      ctx.restore();

      // Dot on rim
      ctx.save();
      const dotAngle = angle + i * arcSize - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + (radius - 2) * Math.cos(dotAngle), cy + (radius - 2) * Math.sin(dotAngle), 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    });

    // Center circle
    const tierColor = tier === 'luck' ? '#16a34a' : tier === 'super' ? '#d97706' : '#7c3aed';
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 55);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, tierColor);
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fbbf24';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const tierNames = { luck: ['LUCK', 'WIN'], super: ['SUPER', 'WIN'], mega: ['MEGA', 'WIN'] };
    const [line1, line2] = tierNames[tier];
    ctx.fillText(line1, cx, cy - 4);
    ctx.fillText(line2, cx, cy + 12);

    // Pointer arrow at top
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius - 2);
    ctx.lineTo(cx - 10, cy - radius + 16);
    ctx.lineTo(cx + 10, cy - radius + 16);
    ctx.closePath();
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function adjustBrightness(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  return <canvas ref={canvasRef} width={320} height={320} className="w-full max-w-[320px]" />;
}

export default function LuckySpinWheel({ wallet, userVIPLevel }) {
  const queryClient = useQueryClient();
  const [activeTier, setActiveTier] = useState('luck');
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [wonPrize, setWonPrize] = useState(null);
  const [showWin, setShowWin] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: dailyWagers = [] } = useQuery({
    queryKey: ['daily-wager', wallet?.user_email, today],
    queryFn: () => base44.entities.DailyWager.filter({ user_email: wallet?.user_email, date: today }),
    enabled: !!wallet?.user_email,
  });

  const { data: wheelRewards = [] } = useQuery({
    queryKey: ['wheel-rewards'],
    queryFn: () => base44.entities.WheelReward.filter({ is_active: true }),
  });

  const { data: wheelConfigs = [] } = useQuery({
    queryKey: ['wheel-config'],
    queryFn: () => base44.entities.WheelConfig.list(),
  });

  const dailyWager = dailyWagers[0];
  const totalWagered = dailyWager?.total_wagered || 0;
  const spinsEarned = dailyWager?.spins_earned || 0;
  const spinsUsed = dailyWager?.spins_used || 0;
  const spinsAvailable = spinsEarned - spinsUsed;
  const progressToNext = totalWagered % 8000;
  const globalSpinCount = wheelConfigs.find(c => c.key === 'global_spin_count')?.value || 0;

  const tierInfo = TIERS.find(t => t.key === activeTier);

  // Build slots for this tier from DB or defaults
  const dbSlots = wheelRewards.filter(r => r.tier === activeTier).sort((a, b) => a.slot_number - b.slot_number);
  const slots = dbSlots.length >= 8
    ? dbSlots.map(s => ({ label: s.label, color: s.color, weight: s.weight ?? 10, is_jackpot: s.is_jackpot ?? false, id: s.id, reward_type: s.reward_type, ic_amount: s.ic_amount, id_amount: s.id_amount, free_spin_count: s.free_spin_count, free_spin_game: s.free_spin_game, free_spin_bet_amount: s.free_spin_bet_amount }))
    : DEFAULT_SLOTS[activeTier].map((s, i) => ({ ...s, slot_number: i + 1 }));

  const spinMutation = useMutation({
    mutationFn: async () => {
      // Get global spin count
      const configs = await base44.entities.WheelConfig.filter({ key: 'global_spin_count' });
      let configRecord = configs[0];
      const newGlobalCount = (configRecord?.value || 0) + 1;
      
      // Check if jackpot spin
      const isJackpot = newGlobalCount === 500000;

      // Pick winner slot
      let chosenIndex;
      if (isJackpot) {
        chosenIndex = slots.findIndex(s => s.is_jackpot);
        if (chosenIndex === -1) chosenIndex = 0;
      } else {
        // Weighted random, exclude jackpot slot
        const eligible = slots.map((s, i) => ({ ...s, i })).filter(s => !s.is_jackpot);
        const totalWeight = eligible.reduce((sum, s) => sum + (s.weight || 10), 0);
        let rand = Math.random() * totalWeight;
        chosenIndex = eligible[0].i;
        for (const s of eligible) {
          rand -= (s.weight || 10);
          if (rand <= 0) { chosenIndex = s.i; break; }
        }
      }

      const won = slots[chosenIndex];

      // Update global spin count
      if (configRecord) {
        await base44.entities.WheelConfig.update(configRecord.id, { value: newGlobalCount });
      } else {
        await base44.entities.WheelConfig.create({ key: 'global_spin_count', value: 1 });
      }

      // Deduct spin from daily wager
      if (dailyWager) {
        await base44.entities.DailyWager.update(dailyWager.id, { spins_used: spinsUsed + 1 });
      }

      // Award prize
      if (won.reward_type === 'IC' || won.ic_amount > 0) {
        await base44.entities.UserWallet.update(wallet.id, { tokens: (wallet.tokens || 0) + (won.ic_amount || 0) });
      }
      if (won.reward_type === 'ID' || won.id_amount > 0) {
        await base44.entities.UserWallet.update(wallet.id, { cat_dollars: (wallet.cat_dollars || 0) + (won.id_amount || 0) });
      }
      if (won.reward_type === 'free_spin') {
        const spinsToAdd = won.free_spin_count || 1;
        await base44.entities.UserWallet.update(wallet.id, {
          free_spins: (wallet.free_spins || 0) + spinsToAdd,
          free_spin_game: won.free_spin_game || 'wheel',
          free_spin_bet_amount: won.free_spin_bet_amount || 0,
        });
      }

      // Record spin
      await base44.entities.WheelSpin.create({
        user_email: wallet.user_email,
        tier: activeTier,
        reward_label: won.label,
        reward_type: won.reward_type || 'other',
        ic_amount: won.ic_amount || 0,
        id_amount: won.id_amount || 0,
        global_spin_number: newGlobalCount,
        is_jackpot: isJackpot,
      });

      return { chosenIndex, won, isJackpot };
    },
    onSuccess: ({ chosenIndex, won, isJackpot }) => {
      setTargetIndex(chosenIndex);
      setWonPrize({ ...won, isJackpot });
    },
    onError: (err) => console.error('Spin error:', err),
  });

  const handleSpin = () => {
    if (spinning || spinsAvailable <= 0) return;
    setShowWin(false);
    setSpinning(true);
    spinMutation.mutate();
  };

  const handleSpinEnd = () => {
    setSpinning(false);
    setShowWin(true);
    queryClient.invalidateQueries({ queryKey: ['daily-wager'] });
    queryClient.invalidateQueries({ queryKey: ['wheel-config'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const availableTiers = TIERS.filter(t => userVIPLevel >= t.minLevel);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Tier selector */}
      <div className="flex gap-3 mb-2">
        {TIERS.map((t) => {
          const unlocked = userVIPLevel >= t.minLevel;
          const isActive = activeTier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => unlocked && setActiveTier(t.key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                isActive ? `${t.borderColor} bg-white/10` : 'border-white/10 opacity-40'
              } ${!unlocked ? 'cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.bgColor} flex items-center justify-center text-white text-xs font-bold`}>
                {t.key === 'luck' ? '🍀' : t.key === 'super' ? '⭐' : '👑'}
              </div>
              <span className="text-white text-xs font-bold">{t.label}</span>
              {!unlocked && <span className="text-gray-500 text-[9px]">LV {t.minLevel}+</span>}
            </button>
          );
        })}
      </div>

      {/* Tier badge */}
      <div className={`px-5 py-2 rounded-full ${tierInfo.badgeColor} text-white font-bold text-sm flex items-center gap-2`}>
        <Crown className="w-4 h-4" />
        {tierInfo.label} — LV {tierInfo.minLevel} or Above
      </div>

      {/* Wheel */}
      <div className={`relative p-3 rounded-full bg-gradient-to-br ${tierInfo.bgColor} shadow-2xl ${tierInfo.glowColor} shadow-xl`}>
        <SpinWheelCanvas
          slots={slots}
          spinning={spinning}
          targetIndex={targetIndex}
          onSpinEnd={handleSpinEnd}
          tier={activeTier}
        />
      </div>

      {/* Jackpot banner */}
      <div className={`w-full max-w-sm py-3 px-5 rounded-xl bg-gradient-to-r ${tierInfo.bgColor} border ${tierInfo.borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-300 animate-pulse" />
          <span className="text-yellow-300 font-bold text-sm">{tierInfo.name} JACKPOT</span>
        </div>
        <span className="text-yellow-300 font-black text-xl">{tierInfo.jackpot}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Wager Progress</span>
          <span className="text-white font-bold">{progressToNext.toLocaleString()} / 8,000 ID</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (progressToNext / 8000) * 100)}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full bg-gradient-to-r ${tierInfo.bgColor} rounded-full`}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">Total today: {totalWagered.toLocaleString()} ID</span>
          <span className="text-green-400 font-bold">{spinsAvailable} spin{spinsAvailable !== 1 ? 's' : ''} available</span>
        </div>
      </div>

      {/* Spin button */}
      {spinsAvailable > 0 ? (
        <Button
          onClick={handleSpin}
          disabled={spinning || userVIPLevel < tierInfo.minLevel}
          className={`w-full max-w-sm h-14 text-lg font-black bg-gradient-to-r ${tierInfo.bgColor} border ${tierInfo.borderColor} hover:opacity-90 text-white shadow-lg`}
        >
          {spinning ? 'Spinning...' : `SPIN NOW (${spinsAvailable} left)`}
        </Button>
      ) : (
        <div className="w-full max-w-sm text-center py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
          Wager {(8000 - progressToNext).toLocaleString()} more ID to earn a spin
        </div>
      )}

      {/* Global spin count */}
      <div className="text-xs text-gray-500 text-center">
        🌍 Global Spin #{(globalSpinCount).toLocaleString()} — Jackpot on spin #500,000
      </div>

      {/* Win overlay */}
      <AnimatePresence>
        {showWin && wonPrize && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => setShowWin(false)}
          >
            <div className={`bg-gradient-to-br ${tierInfo.bgColor} border-4 ${tierInfo.borderColor} rounded-3xl p-8 text-center max-w-xs mx-4`}>
              {wonPrize.isJackpot ? (
                <>
                  <div className="text-6xl mb-4">🎰</div>
                  <h2 className="text-3xl font-black text-yellow-300 mb-2">JACKPOT!!!</h2>
                  <p className="text-white text-xl font-bold mb-4">You won {tierInfo.jackpot}!</p>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-2xl font-black text-white mb-2">You Won!</h2>
                  <p className="text-yellow-300 text-3xl font-black mb-4">{wonPrize.label}</p>
                </>
              )}
              <Button onClick={() => setShowWin(false)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30">
                Awesome!
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}