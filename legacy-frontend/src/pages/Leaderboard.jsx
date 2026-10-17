import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Trophy, TrendingUp, RefreshCw, Zap } from 'lucide-react';

const TIER_COLORS = {
  'Bronze':     { bg: 'from-amber-900/40 to-amber-800/20', badge: 'bg-amber-700/40 text-amber-300 border-amber-600/30' },
  'Silver':     { bg: 'from-slate-600/40 to-slate-500/20', badge: 'bg-slate-500/40 text-slate-200 border-slate-400/30' },
  'Gold':       { bg: 'from-yellow-700/40 to-yellow-600/20', badge: 'bg-yellow-600/40 text-yellow-300 border-yellow-500/30' },
  'Platinum I': { bg: 'from-cyan-800/40 to-cyan-700/20', badge: 'bg-cyan-700/40 text-cyan-200 border-cyan-500/30' },
  'Platinum II':{ bg: 'from-cyan-700/40 to-cyan-600/20', badge: 'bg-cyan-600/40 text-cyan-100 border-cyan-400/30' },
  'Diamond I':  { bg: 'from-blue-700/40 to-blue-600/20', badge: 'bg-blue-600/40 text-blue-200 border-blue-400/30' },
  'Diamond II': { bg: 'from-indigo-700/40 to-indigo-600/20', badge: 'bg-indigo-600/40 text-indigo-200 border-indigo-400/30' },
  'Diamond III':{ bg: 'from-purple-700/40 to-pink-600/20', badge: 'bg-gradient-to-r from-purple-600/40 to-pink-600/40 text-pink-200 border-pink-400/30' },
};

function vipTierFromLevel(level) {
  if (level >= 91) return 'Diamond III';
  if (level >= 71) return 'Diamond II';
  if (level >= 51) return 'Diamond I';
  if (level >= 36) return 'Platinum II';
  if (level >= 21) return 'Platinum I';
  if (level >= 11) return 'Gold';
  if (level >= 6)  return 'Silver';
  return 'Bronze';
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-base font-black text-gray-400 w-8 text-center">#{rank}</span>;
}

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: wallets = [], isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['leaderboard-wallets'],
    queryFn: async () => {
      // Fetch top 50 by cat_dollars (Imperial Dollars won)
      const results = await base44.entities.UserWallet.list('-cat_dollars', 50);
      return results;
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Sort by cat_dollars desc, then vip_level as tiebreaker
  const ranked = [...wallets].sort((a, b) => {
    const diff = (b.cat_dollars || 0) - (a.cat_dollars || 0);
    if (diff !== 0) return diff;
    return (b.vip_level || 1) - (a.vip_level || 1);
  });

  const myRank = user ? ranked.findIndex(w => w.user_email === user.email) + 1 : 0;

  const timeSince = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
  const timeLabel = timeSince < 60 ? `${timeSince}s ago` : `${Math.floor(timeSince / 60)}m ago`;

  return (
    <div className="min-h-screen bg-[#0A0612] text-white pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#1a0a2e] to-[#0A0612] border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,0.15),transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto px-4 py-10 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Crown className="w-7 h-7 text-yellow-400" />
              <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Global Leaderboard
              </h1>
              <Crown className="w-7 h-7 text-yellow-400" />
            </div>
            <p className="text-gray-400 text-sm">Top 50 players ranked by Imperial Dollars won</p>

            <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live • updates every 5 min
              </span>
              <span>·</span>
              <span>Last updated {timeLabel}</span>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">

        {/* My Rank Banner */}
        {user && myRank > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 rounded-2xl px-5 py-4 flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-pink-400" />
              <span className="text-sm font-semibold text-white">Your Rank</span>
            </div>
            <div className="text-2xl font-black text-pink-400">#{myRank}</div>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Leaderboard Rows */}
        <AnimatePresence>
          {ranked.map((wallet, index) => {
            const rank = index + 1;
            const tier = vipTierFromLevel(wallet.vip_level || 1);
            const colors = TIER_COLORS[tier] || TIER_COLORS['Bronze'];
            const isMe = user?.email === wallet.user_email;
            const initials = wallet.user_email?.[0]?.toUpperCase() || '?';

            return (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className={`relative flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all
                  ${isMe
                    ? 'bg-gradient-to-r from-pink-600/25 to-purple-600/20 border-pink-500/40 ring-1 ring-pink-500/30'
                    : `bg-gradient-to-r ${colors.bg} border-white/5 hover:border-white/10`
                  }
                  ${rank <= 3 ? 'shadow-lg' : ''}
                `}
              >
                {/* Rank */}
                <div className="w-10 flex items-center justify-center shrink-0">
                  <RankBadge rank={rank} />
                </div>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0
                  ${rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                    rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black' :
                    rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                    'bg-white/10 text-white'}
                `}>
                  {initials}
                </div>

                {/* Name + tier */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-sm truncate ${isMe ? 'text-pink-300' : 'text-white'}`}>
                      {wallet.user_email?.split('@')[0] || 'Player'}
                      {isMe && <span className="ml-1 text-xs text-pink-400">(you)</span>}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${colors.badge}`}>
                      VIP {wallet.vip_level || 1} · {tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{(wallet.total_wagered || 0).toLocaleString()} IC wagered</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <div className={`text-lg font-black ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-500' : 'text-green-400'}`}>
                    ${(wallet.cat_dollars || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                    <TrendingUp className="w-3 h-3" /> ID won
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!isLoading && ranked.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No players ranked yet. Be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}