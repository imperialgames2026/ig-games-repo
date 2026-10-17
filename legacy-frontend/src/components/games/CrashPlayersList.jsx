import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CrashPlayersList({ currentRoundId, currentUser, gameState }) {
  const { data: bets = [] } = useQuery({
    queryKey: ['crash-bets', currentRoundId],
    queryFn: () => base44.entities.CrashBet.filter({ round_id: currentRoundId }, '-created_date', 50),
    enabled: !!currentRoundId && gameState === 'countdown',
    refetchInterval: gameState === 'countdown' ? 2000 : false,
    staleTime: 1500,
  });

  return (
    <div className="bg-[#1c1c2e] rounded-2xl p-6 mt-6 border-2 border-pink-500/30 shadow-[0_0_30px_rgba(236,72,153,0.12)]">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-pink-400" />
        Live Players ({bets.length})
      </h3>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {bets.map((bet, i) => {
          const isCurrentUser = bet.user_email === currentUser?.email;
          const isCashedOut = bet.status === 'cashed_out';
          const isCrashed = bet.status === 'crashed';
          const isActive = bet.status === 'active';
          
          return (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center justify-between p-3 rounded-lg ${
                isCurrentUser 
                  ? 'bg-pink-500/20 border border-pink-500/30' 
                  : 'bg-[#252538] border border-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  isActive ? 'bg-yellow-400 animate-pulse' :
                  isCashedOut ? 'bg-green-400' : 
                  'bg-red-400'
                }`} />
                <div>
                  <div className="text-white font-medium">
                    {isCurrentUser ? 'You' : bet.user_email.split('@')[0]}
                  </div>
                  <div className="text-xs text-gray-400">
                    {bet.bet_amount.toFixed(2)} {bet.currency}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                {isActive && (
                  <div className="text-yellow-400 font-bold flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Waiting...</span>
                  </div>
                )}
                {isCashedOut && (
                  <div className="text-green-400 font-bold flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <div>
                      <div>{bet.cash_out_multiplier.toFixed(2)}x</div>
                      <div className="text-xs">+{(bet.win_amount - bet.bet_amount).toFixed(2)}</div>
                    </div>
                  </div>
                )}
                {isCrashed && (
                  <div className="text-red-400 font-bold flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    <div>
                      <div>Crashed</div>
                      <div className="text-xs">-{bet.bet_amount.toFixed(2)}</div>
                    </div>
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