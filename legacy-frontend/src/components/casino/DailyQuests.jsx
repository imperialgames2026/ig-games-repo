import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Gift, Target, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const QUEST_DEFS = [
  {
    key: 'play-50-rounds',
    title: 'Play 50 Rounds',
    objective_type: 'play_games',
    objective_target: 50,
    reward_id: 8,
    reward_ic: 0,
    icon: '🎮',
    rewardLabel: '8 ID',
  },
  {
    key: 'win-25-games',
    title: 'Win 25 Games',
    objective_type: 'win_games',
    objective_target: 25,
    reward_id: 3,
    reward_ic: 0,
    icon: '🏆',
    rewardLabel: '15 free rolls + 3 ID',
  },
  {
    key: 'wager-1000-id',
    title: 'Wager 1000 ID',
    objective_type: 'wager_amount',
    objective_target: 1000,
    reward_id: 10,
    reward_ic: 0,
    icon: '💸',
    rewardLabel: '10 ID',
  },
];

export default function DailyQuests({ user, wallet, onRewardClaimed }) {
  const queryClient = useQueryClient();
  const [celebrateId, setCelebrateId] = useState(null);

  const { data: quests = [] } = useQuery({
    queryKey: ['daily-quests-defs'],
    queryFn: () => base44.entities.Quest.filter({ quest_type: 'daily', is_active: true }),
    enabled: !!user,
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['daily-user-quests', user?.email],
    queryFn: () => base44.entities.UserQuest.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const visibleQuests = useMemo(() => {
    return QUEST_DEFS.map((def) => {
      const quest = quests.find(
        (item) => item.title === def.title && item.objective_type === def.objective_type && item.objective_target === def.objective_target
      );
      const userQuest = quest ? userQuests.find((item) => item.quest_id === quest.id) : null;
      return {
        ...def,
        id: quest?.id,
        progress: userQuest?.progress || 0,
        is_completed: userQuest?.is_completed || false,
        is_claimed: userQuest?.is_claimed || false,
        userQuestId: userQuest?.id,
      };
    });
  }, [quests, userQuests]);

  const claimMutation = useMutation({
    mutationFn: async (quest) => {
      if (!wallet || !quest.userQuestId) return;

      const walletUpdate = {
        cat_dollars: (wallet.cat_dollars || 0) + (quest.reward_id || 0),
      };

      if (quest.title === 'Win 25 Games') {
        walletUpdate.free_spins = (wallet.free_spins || 0) + 15;
        walletUpdate.free_spin_game = wallet.free_spin_game || 'wheel';
      }

      await base44.functions.invoke('claimDailyQuestReward', { userQuestId: quest.userQuestId });
    },
    onSuccess: (_, quest) => {
      queryClient.invalidateQueries({ queryKey: ['wallet', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['daily-user-quests', user?.email] });
      setCelebrateId(quest.key);
      onRewardClaimed?.();
      toast.success(`${quest.title} reward claimed`);
      setTimeout(() => setCelebrateId(null), 1800);
    },
  });

  if (!user || !wallet) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Daily Quests</h3>
          <p className="text-sm text-gray-400">Finish objectives and claim bonus rewards.</p>
        </div>
      </div>

      <div className="space-y-3">
        {visibleQuests.map((quest) => {
          const pct = Math.min(100, Math.round((quest.progress / quest.objective_target) * 100));
          return (
            <motion.div
              key={quest.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <AnimatePresence>
                {celebrateId === quest.key && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 10, x: `${8 + i * 7}%`, opacity: 1, scale: 0.8 }}
                        animate={{ y: -60, opacity: 0, scale: 1.2 }}
                        transition={{ duration: 1.1, delay: i * 0.03 }}
                        className="absolute bottom-4 h-2 w-2 rounded-full bg-pink-400"
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl leading-none">{quest.icon}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white">{quest.title}</h4>
                      {quest.is_claimed && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Reward: {quest.rewardLabel}</p>
                  </div>
                </div>

                {quest.is_claimed ? (
                  <span className="text-xs font-bold text-green-400">Claimed</span>
                ) : quest.is_completed ? (
                  <Button
                    size="sm"
                    onClick={() => claimMutation.mutate(quest)}
                    disabled={claimMutation.isPending}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  >
                    <Gift className="w-4 h-4 mr-1" /> Claim
                  </Button>
                ) : (
                  <span className="text-xs font-bold text-pink-400">{quest.progress}/{quest.objective_target}</span>
                )}
              </div>

              <div className="mt-3">
                <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500" style={{ width: `${pct}%` }} />
                </div>
                {quest.is_completed && !quest.is_claimed && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400 font-semibold">
                    <Sparkles className="w-3 h-3" /> Ready to claim
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}