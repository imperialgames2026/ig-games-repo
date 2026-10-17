import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Trophy, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const multiplierColor = (mult) => {
  if (mult >= 100) return 'text-yellow-400';
  if (mult >= 10) return 'text-pink-400';
  if (mult >= 5) return 'text-purple-400';
  return 'text-green-400';
};

const multiplierBg = (mult) => {
  if (mult >= 100) return 'bg-yellow-400/10 border-yellow-400/20';
  if (mult >= 10) return 'bg-pink-400/10 border-pink-400/20';
  if (mult >= 5) return 'bg-purple-400/10 border-purple-400/20';
  return 'bg-green-400/10 border-green-400/20';
};

export default function LimboLeaderboard() {
  const { data: rounds = [] } = useQuery({
    queryKey: ['limbo-live-wins'],
    queryFn: () => base44.entities.GameRound.filter(
      { game_slug: 'limbo' },
      '-created_date',
      20
    ),
    refetchInterval: 5000,
  });

  // Filter to only wins (win_amount > bet_amount) and compute multiplier
  const wins = rounds
    .filter(r => r.win_amount > r.bet_amount)
    .map(r => ({
      ...r,
      multiplier: r.bet_amount > 0 ? +(r.win_amount / r.bet_amount).toFixed(2) : 0,
      displayName: r.user_email ? r.user_email.split('@')[0].slice(0, 10) : 'Player',
    }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 10);

  return (
    <div className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-pink-900/20 to-purple-900/20">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-white font-bold text-sm">Live High Wins</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
          Live
        </span>
      </div>

      {/* Wins List */}
      <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
        {wins.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
            No big wins yet — be the first!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {wins.map((win, i) => (
              <motion.div
                key={win.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border ${multiplierBg(win.multiplier)}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-500 text-xs font-mono w-4 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-white text-xs font-semibold truncate">{win.displayName}</div>
                    <div className="text-gray-500 text-xs">{win.bet_amount} {win.difficulty?.includes('ID') ? 'ID' : 'IC'}</div>
                  </div>
                </div>
                <div className={`text-sm font-black shrink-0 ml-2 ${multiplierColor(win.multiplier)}`}>
                  {win.multiplier}×
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}