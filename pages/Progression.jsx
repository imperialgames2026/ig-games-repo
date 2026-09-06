import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Gift, Target, Crown, Zap, Lock, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { calculateVIPLevel, getNextLevel, getProgressToNextLevel } from '@/components/casino/VIPHelper';

export default function Progression() {
  const queryClient = useQueryClient();
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

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: quests = [] } = useQuery({
    queryKey: ['quests'],
    queryFn: () => base44.entities.Quest.filter({ is_active: true }),
  });

  const { data: userQuests = [] } = useQuery({
    queryKey: ['userQuests', user?.email],
    queryFn: () => base44.entities.UserQuest.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.filter({ is_active: true }),
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.email],
    queryFn: () => base44.entities.UserAchievement.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: cosmetics = [] } = useQuery({
    queryKey: ['cosmetics'],
    queryFn: () => base44.entities.Cosmetic.filter({ is_active: true }),
  });

  const { data: userCosmetics = [] } = useQuery({
    queryKey: ['userCosmetics', user?.email],
    queryFn: () => base44.entities.UserCosmetic.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserWallet.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  const updateQuestMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserQuest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['userQuests']),
  });

  const updateAchievementMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserAchievement.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['userAchievements']),
  });

  const equipCosmeticMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserCosmetic.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['userCosmetics']),
  });

  const wallet = wallets[0];
  const currentXP = wallet?.experience_points || 0;
  const vipLevel = calculateVIPLevel(currentXP);
  const nextLevel = getNextLevel(currentXP);
  const progressPercent = getProgressToNextLevel(currentXP);

  const handleClaimQuest = async (quest, userQuest) => {
    if (!userQuest.is_completed || userQuest.is_claimed) return;

    const totalIC = quest.reward_ic || 0;
    const totalID = quest.reward_id || 0;
    const totalXP = quest.reward_xp || 0;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        tokens: wallet.tokens + totalIC,
        cat_dollars: (wallet.cat_dollars || 0) + totalID,
        experience_points: currentXP + totalXP,
      },
    });

    await updateQuestMutation.mutateAsync({
      id: userQuest.id,
      data: { is_claimed: true },
    });

    toast.success(`Claimed: ${totalIC} IC, ${totalID} ID, ${totalXP} XP!`);
  };

  const handleClaimAchievement = async (achievement, userAchievement) => {
    if (!userAchievement.is_completed || userAchievement.is_claimed) return;

    const totalIC = achievement.reward_ic || 0;
    const totalID = achievement.reward_id || 0;
    const totalXP = achievement.reward_xp || 0;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        tokens: wallet.tokens + totalIC,
        cat_dollars: (wallet.cat_dollars || 0) + totalID,
        experience_points: currentXP + totalXP,
      },
    });

    await updateAchievementMutation.mutateAsync({
      id: userAchievement.id,
      data: { is_claimed: true },
    });

    toast.success(`Achievement unlocked: ${totalIC} IC, ${totalID} ID, ${totalXP} XP!`);
  };

  const handleEquipCosmetic = async (userCosmetic) => {
    // Unequip all of same type first
    const sameTypeCosmetics = userCosmetics.filter(uc => {
      const cosmetic = cosmetics.find(c => c.id === uc.cosmetic_id);
      const targetCosmetic = cosmetics.find(c => c.id === userCosmetic.cosmetic_id);
      return cosmetic?.type === targetCosmetic?.type && uc.is_equipped;
    });

    for (const uc of sameTypeCosmetics) {
      await equipCosmeticMutation.mutateAsync({
        id: uc.id,
        data: { is_equipped: false },
      });
    }

    await equipCosmeticMutation.mutateAsync({
      id: userCosmetic.id,
      data: { is_equipped: !userCosmetic.is_equipped },
    });

    toast.success(userCosmetic.is_equipped ? 'Cosmetic unequipped' : 'Cosmetic equipped!');
  };

  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-pink-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg shadow-purple-500/30 mb-6">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">Player Progression</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Complete quests, unlock achievements, and earn exclusive cosmetics!
            </p>
          </motion.div>

          {/* Level Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 max-w-3xl mx-auto p-6 rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{vipLevel.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{vipLevel.name}</h3>
                  <p className="text-sm text-gray-400">VIP Level {vipLevel.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Experience</p>
                <p className="text-2xl font-bold text-white">{currentXP.toLocaleString()} XP</p>
              </div>
            </div>
            <Progress value={progressPercent} className="h-3 mb-2" />
            {nextLevel ? (
              <p className="text-sm text-gray-400 text-center">
                {(nextLevel.xp_required - currentXP).toLocaleString()} XP to {nextLevel.name}
              </p>
            ) : (
              <p className="text-sm text-pink-400 text-center font-bold">MAX LEVEL! 👑</p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Tabs defaultValue="quests" className="space-y-8">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="quests" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600">
              <Target className="w-4 h-4 mr-2" />
              Quests
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="cosmetics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600">
              <Crown className="w-4 h-4 mr-2" />
              Cosmetics
            </TabsTrigger>
          </TabsList>

          {/* Quests Tab */}
          <TabsContent value="quests">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quests.map((quest, i) => {
                const userQuest = userQuests.find(uq => uq.quest_id === quest.id);
                const progress = userQuest?.progress || 0;
                const isCompleted = userQuest?.is_completed || false;
                const isClaimed = userQuest?.is_claimed || false;
                const progressPercent = Math.min((progress / quest.objective_target) * 100, 100);

                return (
                  <motion.div
                    key={quest.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{quest.icon || '🎯'}</div>
                        <div>
                          <h3 className="font-bold text-white">{quest.title}</h3>
                          <p className="text-xs text-pink-400 uppercase">{quest.quest_type}</p>
                        </div>
                      </div>
                      {isClaimed && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{quest.description}</p>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white font-bold">{progress} / {quest.objective_target}</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    <div className="flex items-center gap-4 text-sm mb-4">
                      {quest.reward_ic > 0 && (
                        <div className="flex items-center gap-1 text-pink-400">
                          <Zap className="w-4 h-4" />
                          {quest.reward_ic} IC
                        </div>
                      )}
                      {quest.reward_id > 0 && (
                        <div className="flex items-center gap-1 text-green-400">
                          <Star className="w-4 h-4" />
                          {quest.reward_id} ID
                        </div>
                      )}
                      {quest.reward_xp > 0 && (
                        <div className="flex items-center gap-1 text-purple-400">
                          <Trophy className="w-4 h-4" />
                          {quest.reward_xp} XP
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleClaimQuest(quest, userQuest)}
                      disabled={!isCompleted || isClaimed}
                      className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 disabled:opacity-50"
                    >
                      {isClaimed ? 'Claimed' : isCompleted ? 'Claim Rewards' : 'In Progress'}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((achievement, i) => {
                const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
                const progress = userAchievement?.progress || 0;
                const isCompleted = userAchievement?.is_completed || false;
                const isClaimed = userAchievement?.is_claimed || false;
                const progressPercent = Math.min((progress / achievement.objective_target) * 100, 100);

                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{achievement.icon || '🏆'}</div>
                        <div>
                          <h3 className="font-bold text-white">{achievement.title}</h3>
                          <p className="text-xs text-purple-400 uppercase">{achievement.category}</p>
                        </div>
                      </div>
                      {isClaimed && <CheckCircle2 className="w-6 h-6 text-green-400" />}
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{achievement.description}</p>
                    
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white font-bold">{progress} / {achievement.objective_target}</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    <div className="flex items-center gap-4 text-sm mb-4">
                      {achievement.reward_ic > 0 && (
                        <div className="flex items-center gap-1 text-pink-400">
                          <Zap className="w-4 h-4" />
                          {achievement.reward_ic} IC
                        </div>
                      )}
                      {achievement.reward_id > 0 && (
                        <div className="flex items-center gap-1 text-green-400">
                          <Star className="w-4 h-4" />
                          {achievement.reward_id} ID
                        </div>
                      )}
                      {achievement.reward_xp > 0 && (
                        <div className="flex items-center gap-1 text-purple-400">
                          <Trophy className="w-4 h-4" />
                          {achievement.reward_xp} XP
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleClaimAchievement(achievement, userAchievement)}
                      disabled={!isCompleted || isClaimed}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50"
                    >
                      {isClaimed ? 'Claimed' : isCompleted ? 'Claim Rewards' : 'In Progress'}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Cosmetics Tab */}
          <TabsContent value="cosmetics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {cosmetics.map((cosmetic, i) => {
                const userCosmetic = userCosmetics.find(uc => uc.cosmetic_id === cosmetic.id);
                const isUnlocked = !!userCosmetic;
                const isEquipped = userCosmetic?.is_equipped || false;
                const canUnlock = vipLevel.level >= cosmetic.unlock_level;

                return (
                  <motion.div
                    key={cosmetic.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-2xl border-2 ${
                      isEquipped
                        ? 'border-pink-500 bg-gradient-to-br from-pink-500/20 to-pink-600/10'
                        : 'border-white/10 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E]'
                    }`}
                  >
                    <div className="relative mb-4">
                      {cosmetic.image_url ? (
                        <img
                          src={cosmetic.image_url}
                          alt={cosmetic.name}
                          className={`w-full h-32 object-cover rounded-lg ${!isUnlocked && 'opacity-30 grayscale'}`}
                        />
                      ) : (
                        <div className={`w-full h-32 rounded-lg bg-gradient-to-br ${rarityColors[cosmetic.rarity]} flex items-center justify-center ${!isUnlocked && 'opacity-30 grayscale'}`}>
                          <Crown className="w-12 h-12 text-white" />
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-8 h-8 text-white" />
                        </div>
                      )}
                      {isEquipped && (
                        <div className="absolute top-2 right-2 bg-pink-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          EQUIPPED
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-white mb-1">{cosmetic.name}</h3>
                    <p className="text-xs text-gray-400 mb-2">{cosmetic.description}</p>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${rarityColors[cosmetic.rarity]} text-white font-bold uppercase`}>
                        {cosmetic.rarity}
                      </span>
                      <span className="text-xs text-gray-400">Level {cosmetic.unlock_level}</span>
                    </div>

                    {isUnlocked ? (
                      <Button
                        onClick={() => handleEquipCosmetic(userCosmetic)}
                        className={`w-full ${
                          isEquipped
                            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                            : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700'
                        }`}
                      >
                        {isEquipped ? 'Unequip' : 'Equip'}
                      </Button>
                    ) : (
                      <Button disabled className="w-full bg-gray-700 opacity-50">
                        {canUnlock ? 'Locked' : `Requires Level ${cosmetic.unlock_level}`}
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}