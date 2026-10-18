import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Zap } from 'lucide-react';

/**
 * Reusable wager progress bar for the 8000 ID spin bonus.
 * Show anywhere a bonus is displayed.
 */
export default function WagerProgressBar({ userEmail, compact = false }) {
  const today = new Date().toISOString().split('T')[0];

  const { data: dailyWagers = [] } = useQuery({
    queryKey: ['daily-wager', userEmail, today],
    queryFn: () => base44.entities.DailyWager.filter({ user_email: userEmail, date: today }),
    enabled: !!userEmail,
    refetchInterval: 30000,
  });

  const dailyWager = dailyWagers[0];
  const totalWagered = dailyWager?.total_wagered || 0;
  const spinsEarned = dailyWager?.spins_earned || 0;
  const spinsUsed = dailyWager?.spins_used || 0;
  const spinsAvailable = spinsEarned - spinsUsed;
  const progressToNext = totalWagered % 8000;
  const progressPct = Math.min(100, (progressToNext / 8000) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex justify-between mb-0.5">
            <span className="text-gray-400">Lucky Spin</span>
            <span className="text-white font-bold">{progressToNext.toLocaleString()}/8,000 ID</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full"
            />
          </div>
        </div>
        {spinsAvailable > 0 && (
          <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">{spinsAvailable}</span>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-pink-500/10 border border-yellow-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-bold text-sm">Lucky Spin Progress</span>
        </div>
        {spinsAvailable > 0 && (
          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
            {spinsAvailable} Spin{spinsAvailable > 1 ? 's' : ''} Ready!
          </span>
        )}
      </div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Today's wager</span>
        <span className="text-white font-bold">{progressToNext.toLocaleString()} / 8,000 ID</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8 }}
          className="h-full bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full"
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Total wagered today: {totalWagered.toLocaleString()} ID</span>
        <span>{progressPct < 100 ? `${(8000 - progressToNext).toLocaleString()} ID to next spin` : 'Spin available!'}</span>
      </div>
    </div>
  );
}