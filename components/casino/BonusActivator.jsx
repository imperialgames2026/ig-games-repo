import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Gift, Zap, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function BonusActivator({ wallet, compact = false }) {
  const queryClient = useQueryClient();

  const activateBonusMutation = useMutation({
    mutationFn: ({ id, bonus }) => base44.entities.UserWallet.update(id, { active_bonus: bonus }),
    onSuccess: () => {
      queryClient.invalidateQueries(['wallet']);
      toast.success('Bonus activated! Use it on your next purchase.');
    },
  });

  const bonuses = [
    {
      percent: 50,
      available: wallet?.bonus_50_available && wallet?.purchase_count === 0,
      used: !wallet?.bonus_50_available,
      label: '1st Purchase',
      color: 'from-blue-500 to-blue-600',
      icon: Gift,
    },
    {
      percent: 100,
      available: wallet?.bonus_100_available && wallet?.purchase_count === 1,
      used: !wallet?.bonus_100_available,
      label: '2nd Purchase',
      color: 'from-purple-500 to-purple-600',
      icon: Zap,
    },
    {
      percent: 150,
      available: wallet?.bonus_150_available && wallet?.purchase_count === 2,
      used: !wallet?.bonus_150_available,
      label: '3rd Purchase',
      color: 'from-pink-500 to-pink-600',
      icon: Briefcase,
    },
  ];

  const handleActivate = (percent) => {
    if (wallet?.active_bonus > 0) {
      toast.error('Deactivate current bonus first');
      return;
    }
    activateBonusMutation.mutate({ id: wallet.id, bonus: percent });
  };

  const handleDeactivate = () => {
    activateBonusMutation.mutate({ id: wallet.id, bonus: 0 });
    toast.success('Bonus deactivated');
  };

  if (compact) {
    const activeBonus = bonuses.find(b => b.percent === wallet?.active_bonus);
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30">
        <Briefcase className="w-4 h-4 text-amber-400" />
        {activeBonus ? (
          <span className="text-sm font-bold text-amber-400">+{activeBonus.percent}% Active</span>
        ) : (
          <span className="text-xs text-amber-400">No bonus active</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-white">Bonus Vault</h3>
      </div>

      {wallet?.active_bonus > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-green-600/10 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-green-400">
                +{wallet.active_bonus}% Bonus Active
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeactivate}
              className="text-xs"
            >
              Deactivate
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {bonuses.map((bonus) => {
          const Icon = bonus.icon;
          const isActive = wallet?.active_bonus === bonus.percent;
          const isLocked = !bonus.available && !bonus.used;

          return (
            <motion.div
              key={bonus.percent}
              whileHover={bonus.available ? { scale: 1.02 } : {}}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/50'
                  : bonus.used
                  ? 'bg-white/5 border-white/10 opacity-50'
                  : isLocked
                  ? 'bg-white/5 border-white/10 opacity-40'
                  : 'bg-gradient-to-r ' + bonus.color + '/20 border-' + bonus.color.split('-')[1] + '-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${bonus.color} flex items-center justify-center`}>
                    {bonus.used ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : isLocked ? (
                      <Lock className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-bold">+{bonus.percent}% Bonus</div>
                    <div className="text-xs text-gray-400">{bonus.label}</div>
                  </div>
                </div>
                {bonus.available && !isActive && (
                  <Button
                    size="sm"
                    onClick={() => handleActivate(bonus.percent)}
                    disabled={activateBonusMutation.isPending}
                    className={`bg-gradient-to-r ${bonus.color} hover:opacity-90`}
                  >
                    Activate
                  </Button>
                )}
                {isActive && (
                  <span className="text-green-400 font-bold text-sm">Active</span>
                )}
                {bonus.used && (
                  <span className="text-gray-500 text-sm">Used</span>
                )}
                {isLocked && (
                  <span className="text-gray-500 text-sm">Locked</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Activate a bonus before making a purchase to get extra tokens!
      </p>
    </div>
  );
}