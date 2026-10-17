import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Crown, Gift, TrendingUp, Lock, Unlock, ChevronRight } from 'lucide-react';
import VIPTierExplainer from '@/components/casino/VIPTierExplainer';
import VIPLevelUpToast from '@/components/casino/VIPLevelUpToast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function VIP() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: wallet } = useQuery({
    queryKey: ['wallet-vip', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => base44.entities.VIPLevel.list(),
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ['vip-tiers'],
    queryFn: () => base44.entities.VIPTier.list(),
  });

  const { data: bonuses = [] } = useQuery({
    queryKey: ['vip-bonuses'],
    queryFn: () => base44.entities.VIPBonus.list(),
  });

  const { data: userBonuses = [] } = useQuery({
    queryKey: ['user-vip-bonuses', user?.email],
    queryFn: () => base44.entities.UserVIPBonus.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  if (!user || !wallet || wallet.length === 0) {
    return <div className="min-h-screen bg-[#0A0612] flex items-center justify-center"><p className="text-white">Loading...</p></div>;
  }

  const currentWallet = wallet[0];
  const currentLevel = levels.find(l => l.level === currentWallet.vip_level) || levels[0];
  const currentTier = tiers.find(t => currentWallet.vip_level >= t.min_level && currentWallet.vip_level <= t.max_level);
  const nextLevel = levels.find(l => l.level === currentWallet.vip_level + 1);
  
  const xpProgress = nextLevel 
    ? ((currentWallet.experience_points - currentLevel.required_xp) / (nextLevel.required_xp - currentLevel.required_xp)) * 100
    : 100;

  const unlockedBonuses = bonuses.filter(b => b.min_tier_level <= currentWallet.vip_level && b.is_active);
  const lockedBonuses = bonuses.filter(b => b.min_tier_level > currentWallet.vip_level && b.is_active);

  return (
    <div className="min-h-screen bg-[#0A0612] p-4 md:p-8">
      <VIPLevelUpToast wallet={currentWallet} />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">👑 VIP Club</h1>
          <p className="text-gray-400">Unlock exclusive rewards as you climb the ranks</p>
        </motion.div>

        {/* Current Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] rounded-2xl p-8 border border-white/10 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Level Info */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl">{currentTier?.icon || '👑'}</div>
                <div>
                  <p className="text-gray-400 text-sm">{currentTier?.tier_group}</p>
                  <h2 className="text-3xl font-bold text-white">{currentLevel?.display_name}</h2>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm">Level Progress</span>
                    <span className="text-white font-bold">{xpProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={xpProgress} className="h-2" />
                </div>

                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-xs text-gray-400 mb-1">Experience Points</p>
                  <p className="text-2xl font-bold text-green-400">
                    {currentWallet.experience_points.toLocaleString()}
                  </p>
                </div>

                {nextLevel && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">To Next Level</p>
                    <p className="text-lg font-bold text-yellow-400">
                      {Math.max(0, nextLevel.required_xp - currentWallet.experience_points).toLocaleString()} XP
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Benefits */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Tier Benefits</h3>
              <div className="space-y-2">
                {currentTier?.benefits?.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{benefit}</span>
                  </div>
                )) || (
                  <p className="text-gray-500">No specific benefits yet</p>
                )}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-blue-900/20 border border-blue-500/30">
                <p className="text-blue-300 text-sm">
                  <strong>💡 Tip:</strong> Play more to earn XP and unlock higher tiers with better rewards.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mb-8">
          <VIPTierExplainer />
        </div>

        {/* Available Bonuses */}
        {unlockedBonuses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">Available Bonuses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unlockedBonuses.map((bonus) => (
                <motion.div
                  key={bonus.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] rounded-xl p-6 border border-white/10 hover:border-pink-500/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{bonus.display_name}</h3>
                      <p className="text-sm text-gray-400">{bonus.bonus_type.replace('_', ' ')}</p>
                    </div>
                    <Unlock className="w-5 h-5 text-green-400" />
                  </div>

                  <p className="text-gray-300 text-sm mb-4">{bonus.description}</p>

                  <div className="bg-white/5 rounded-lg p-3 mb-4 border border-white/10">
                    <p className="text-xs text-gray-400">Amount</p>
                    <p className="text-xl font-bold text-yellow-400">
                      {bonus.base_amount} {bonus.amount_type === 'percentage' ? '%' : ''}
                    </p>
                  </div>

                  {bonus.wager_requirement > 0 && (
                    <p className="text-xs text-gray-400 mb-3">
                      Wager Required: {bonus.wager_requirement.toLocaleString()}
                    </p>
                  )}

                  <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold">
                    Claim Now
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Locked Bonuses */}
        {lockedBonuses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-4">Locked Bonuses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lockedBonuses.map((bonus) => (
                <div key={bonus.id} className="bg-[#1A1528]/50 rounded-xl p-6 border border-white/5 opacity-60">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-500">{bonus.display_name}</h3>
                      <p className="text-sm text-gray-600">{bonus.bonus_type.replace('_', ' ')}</p>
                    </div>
                    <Lock className="w-5 h-5 text-gray-500" />
                  </div>

                  <p className="text-gray-500 text-sm mb-4">{bonus.description}</p>

                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-gray-500">Unlock at Level</p>
                    <p className="text-lg font-bold text-gray-400">{bonus.min_tier_level}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Level Progression */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] rounded-2xl p-8 border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Your VIP Journey</h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {levels.slice(0, 20).map((level) => {
              const isCurrentOrPassed = level.level <= currentWallet.vip_level;
              const isNext = level.level === currentWallet.vip_level + 1;
              
              return (
                <motion.div
                  key={level.id}
                  whileHover={{ scale: 1.01 }}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    isCurrentOrPassed
                      ? 'bg-gradient-to-r from-pink-500/20 to-pink-600/20 border-pink-500/50'
                      : isNext
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isCurrentOrPassed ? 'bg-pink-500 text-white' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {level.level}
                    </div>
                    <div>
                      <p className={`font-bold ${isCurrentOrPassed ? 'text-white' : 'text-gray-400'}`}>
                        {level.display_name}
                      </p>
                      <p className="text-xs text-gray-500">{level.tier_group}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isCurrentOrPassed ? (
                      <div className="text-xs font-bold text-green-400">✓ Unlocked</div>
                    ) : (
                      <div className="text-sm font-mono font-bold text-yellow-400">
                        {level.required_xp.toLocaleString()} XP
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}