import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Crown, Medal, Trophy } from 'lucide-react';

function formatTokens(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function WeeklyTokenLeaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['weekly-token-leaderboard'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getWeeklyTokenLeaderboard', {});
      return response.data;
    },
    refetchInterval: 30000,
  });

  const leaders = data?.leaderboard || [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 overflow-hidden rounded-3xl border border-pink-500/20 bg-white/[0.04] shadow-2xl shadow-pink-500/10 backdrop-blur-xl"
    >
      <div className="relative p-6 md:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-sm font-bold text-pink-300">
              <Trophy className="h-4 w-4" />
              Weekly Top 10
            </div>
            <h2 className="text-2xl font-black text-white md:text-3xl">Most Tokens Won This Week</h2>
            <p className="mt-2 text-sm text-gray-400">Auto-refreshes every 30 seconds for all players.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Live leaderboard
          </div>
        </div>

        <div className="relative mt-6 grid gap-3">
          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-gray-400">Loading winners...</div>
          )}

          {!isLoading && leaders.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-gray-400">No wins recorded yet this week.</div>
          )}

          {leaders.map((leader) => {
            const isTopThree = leader.rank <= 3;
            return (
              <div
                key={`${leader.rank}-${leader.name}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#120d1d]/80 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${isTopThree ? 'bg-gradient-to-br from-pink-500 to-pink-700 text-white' : 'bg-white/10 text-gray-300'}`}>
                    {isTopThree ? <Crown className="h-5 w-5" /> : leader.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-white">{leader.name}</p>
                      {isTopThree && <Medal className="h-4 w-4 text-pink-300" />}
                    </div>
                    <p className="text-xs text-gray-500">Rank #{leader.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-pink-300">{formatTokens(leader.total_won)}</p>
                  <p className="text-xs text-gray-500">tokens won</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}