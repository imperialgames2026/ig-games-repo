// VIP Level Configuration and Helper Functions
// XP thresholds mapped to exact tier/level specifications
// 1 XP = 1 ID wagered

export const VIP_LEVELS = [
  { level: 1, name: 'Beginner', xp_required: 0, tier: 'Beginner', color: 'from-slate-500 to-slate-700', icon: '△' },

  { level: 2, name: 'Bronze I', xp_required: 1000, tier: 'Bronze', color: 'from-amber-500 to-orange-700', icon: '◇' },
  { level: 3, name: 'Bronze II', xp_required: 3000, tier: 'Bronze', color: 'from-amber-500 to-orange-700', icon: '◇' },
  { level: 4, name: 'Bronze III', xp_required: 7000, tier: 'Bronze', color: 'from-amber-500 to-orange-700', icon: '◇' },
  { level: 5, name: 'Bronze IV', xp_required: 15000, tier: 'Bronze', color: 'from-amber-500 to-orange-700', icon: '◇' },

  { level: 6, name: 'Silver I', xp_required: 30000, tier: 'Silver', color: 'from-slate-300 to-slate-500', icon: '⬡' },
  { level: 7, name: 'Silver II', xp_required: 60000, tier: 'Silver', color: 'from-slate-300 to-slate-500', icon: '⬡' },
  { level: 8, name: 'Silver III', xp_required: 120000, tier: 'Silver', color: 'from-slate-300 to-slate-500', icon: '⬡' },
  { level: 9, name: 'Silver IV', xp_required: 240000, tier: 'Silver', color: 'from-slate-300 to-slate-500', icon: '⬡' },

  { level: 10, name: 'Gold I', xp_required: 500000, tier: 'Gold', color: 'from-emerald-400 to-green-600', icon: '⬢' },
  { level: 11, name: 'Gold II', xp_required: 1000000, tier: 'Gold', color: 'from-emerald-400 to-green-600', icon: '⬢' },
  { level: 12, name: 'Gold III', xp_required: 2000000, tier: 'Gold', color: 'from-emerald-400 to-green-600', icon: '⬢' },
  { level: 13, name: 'Gold IV', xp_required: 3500000, tier: 'Gold', color: 'from-emerald-400 to-green-600', icon: '⬢' },

  { level: 14, name: 'Platinum I', xp_required: 6000000, tier: 'Platinum', color: 'from-slate-400 to-slate-600', icon: '▣' },
  { level: 15, name: 'Platinum II', xp_required: 8500000, tier: 'Platinum', color: 'from-slate-400 to-slate-600', icon: '▣' },
  { level: 16, name: 'Platinum III', xp_required: 11000000, tier: 'Platinum', color: 'from-slate-400 to-slate-600', icon: '▣' },
  { level: 17, name: 'Platinum IV', xp_required: 15000000, tier: 'Platinum', color: 'from-slate-400 to-slate-600', icon: '▣' },

  { level: 18, name: 'Diamond I', xp_required: 25000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 19, name: 'Diamond II', xp_required: 40000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 20, name: 'Diamond III', xp_required: 65000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 21, name: 'Diamond IV', xp_required: 110000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 22, name: 'Diamond V', xp_required: 200000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 23, name: 'Diamond VI', xp_required: 400000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },
  { level: 24, name: 'Diamond VII', xp_required: 1000000000, tier: 'Diamond', color: 'from-indigo-300 to-violet-500', icon: '◈' },

  { level: 25, name: 'Eternal I', xp_required: 1500000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 26, name: 'Eternal II', xp_required: 2200000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 27, name: 'Eternal III', xp_required: 3200000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 28, name: 'Eternal IV', xp_required: 4500000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 29, name: 'Eternal V', xp_required: 6000000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 30, name: 'Eternal VI', xp_required: 7200000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 31, name: 'Eternal VII', xp_required: 8300000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 32, name: 'Eternal VIII', xp_required: 9000000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 33, name: 'Eternal IX', xp_required: 9500000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
  { level: 34, name: 'Eternal X', xp_required: 10000000000, tier: 'Eternal', color: 'from-cyan-200 to-blue-400', icon: '✧' },
];

// Calculate VIP level from experience points
export function calculateVIPLevel(xp) {
  for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= VIP_LEVELS[i].xp_required) {
      return VIP_LEVELS[i];
    }
  }
  return VIP_LEVELS[0];
}

// Get next level info
export function getNextLevel(currentXP) {
  const currentLevel = calculateVIPLevel(currentXP);
  const nextLevelIndex = VIP_LEVELS.findIndex(l => l.level === currentLevel.level) + 1;
  if (nextLevelIndex >= VIP_LEVELS.length) return null;
  return VIP_LEVELS[nextLevelIndex];
}

// Calculate progress to next level (0-100)
export function getProgressToNextLevel(currentXP) {
  const currentLevel = calculateVIPLevel(currentXP);
  const nextLevel = getNextLevel(currentXP);
  if (!nextLevel) return 100;
  const xpInCurrentLevel = currentXP - currentLevel.xp_required;
  const xpNeededForNextLevel = nextLevel.xp_required - currentLevel.xp_required;
  return Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));
}

// Convert wager amount to XP (1 ID wagered = 1 XP)
export function wagerToXP(idWagered) {
  return Math.floor(idWagered);
}