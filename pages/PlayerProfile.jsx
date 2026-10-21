import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {useVipStatus} from '@/hooks/useVipCatalog';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy, Zap, Target, TrendingUp, TrendingDown, Star, Clock, Users } from 'lucide-react';

// ─── Medal definitions ────────────────────────────────────────────────────────
const MEDALS = [
  {
    id: 'ballin',
    name: "Ballin'",
    emoji: '💰',
    color: 'from-yellow-400 to-amber-600',
    glow: '#f59e0b',
    description: "You wagered over 1,000,000 ID. You are truly ballin'!",
    check: (wallet) => (wallet?.total_deposited || 0) >= 1000000,
    progress: (wallet) => Math.min((wallet?.total_deposited || 0) / 1000000, 1),
    goal: '1,000,000 ID deposited',
  },
  {
    id: 'old_timer',
    name: 'The Old Timer',
    emoji: '⏰',
    color: 'from-slate-400 to-gray-600',
    glow: '#94a3b8',
    description: 'You have been with us for over 1 year. A true Imperial veteran!',
    check: (wallet, user) => {
      if (!user?.created_date) return false;
      const ms = Date.now() - new Date(user.created_date).getTime();
      return ms >= 365 * 24 * 60 * 60 * 1000;
    },
    progress: (wallet, user) => {
      if (!user?.created_date) return 0;
      const ms = Date.now() - new Date(user.created_date).getTime();
      return Math.min(ms / (365 * 24 * 60 * 60 * 1000), 1);
    },
    goal: '1 year membership',
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    emoji: '🎲',
    color: 'from-pink-500 to-rose-600',
    glow: '#ec4899',
    description: 'Placed a single bet of 10,000+ IC. You live dangerously!',
    check: (wallet) => (wallet?.total_wagered || 0) >= 500000,
    progress: (wallet) => Math.min((wallet?.total_wagered || 0) / 500000, 1),
    goal: '500,000 IC wagered',
  },
  {
    id: 'big_winner',
    name: 'Big Winner',
    emoji: '🏆',
    color: 'from-green-400 to-emerald-600',
    glow: '#10b981',
    description: 'Your total winnings exceed 100,000 IC. The luck is real!',
    check: (wallet) => (wallet?.total_won || 0) >= 100000,
    progress: (wallet) => Math.min((wallet?.total_won || 0) / 100000, 1),
    goal: '100,000 IC total won',
  },
  {
    id: 'multiplier_god',
    name: 'Multiplier God',
    emoji: '⚡',
    color: 'from-purple-500 to-violet-700',
    glow: '#8b5cf6',
    description: 'Achieved a 100x+ multiplier in a single game. Legendary!',
    check: (wallet, user, athMult) => (athMult || 0) >= 100,
    progress: (wallet, user, athMult) => Math.min((athMult || 0) / 100, 1),
    goal: '100x multiplier',
  },
  {
    id: 'veteran',
    name: 'Imperial Veteran',
    emoji: '👑',
    color: 'from-orange-400 to-red-600',
    glow: '#f97316',
    description: 'Reached VIP Level 10 or higher. A true Imperial loyalist!',
    check: (wallet) => (wallet?.vip_level ?? 0) >= 10,
    progress: (wallet) => Math.min((wallet?.vip_level ?? 0) / 10, 1),
    goal: 'VIP Level 10',
  },
  {
    id: 'purchase_king',
    name: 'Purchase King',
    emoji: '💎',
    color: 'from-cyan-400 to-blue-600',
    glow: '#06b6d4',
    description: 'Made 10 or more purchases on Imperial Gaming. A true supporter!',
    check: (wallet) => (wallet?.purchase_count || 0) >= 10,
    progress: (wallet) => Math.min((wallet?.purchase_count || 0) / 10, 1),
    goal: '10 purchases',
  },
];

// ─── Medal Card ───────────────────────────────────────────────────────────────
function MedalCard({ medal, wallet, user, athMult, onClick }) {
  const earned = medal.check(wallet, user, athMult);
  const progress = medal.progress(wallet, user, athMult);

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(medal)}
      className={`relative cursor-pointer rounded-2xl p-4 border transition-all ${
        earned
          ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/20'
          : 'bg-white/5 border-white/10 opacity-60'
      }`}
    >
      {earned && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `0 0 20px 2px ${medal.glow}33` }}
        />
      )}
      {/* Hexagon badge */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${medal.color} shadow-lg`}
          style={earned ? { boxShadow: `0 4px 20px ${medal.glow}55` } : {}}
        >
          {medal.emoji}
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold ${earned ? 'text-white' : 'text-gray-400'}`}>{medal.name}</div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${medal.color} transition-all duration-700`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">{Math.round(progress * 100)}%</div>
      </div>
      {earned && (
        <div className="absolute top-2 right-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        </div>
      )}
    </motion.div>
  );
}

// ─── Medal Detail Modal ───────────────────────────────────────────────────────
function MedalModal({ medal, wallet, user, athMult, onClose }) {
  if (!medal) return null;
  const earned = medal.check(wallet, user, athMult);
  const progress = medal.progress(wallet, user, athMult);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          className="relative bg-[#1a1528] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 40 }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">✕</button>
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-4 bg-gradient-to-br ${medal.color}`}
            style={earned ? { boxShadow: `0 6px 30px ${medal.glow}66` } : {}}
          >
            {medal.emoji}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{Math.round(progress * 100)}%</span>
              <span>{medal.goal}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${medal.color} transition-all duration-700`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">{medal.name}</h2>
          <p className="text-gray-400 text-sm mb-6">{medal.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-gray-400">Status</div>
              <div className={`font-bold ${earned ? 'text-green-400' : 'text-gray-500'}`}>
                {earned ? '✅ Earned' : '🔒 Locked'}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-gray-400">Duration</div>
              <div className="font-bold text-white">Unlimited</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'pink' }) {
  const colors = {
    pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-400',
    green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
  };
  const cls = colors[color] || colors.pink;
  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${cls.split(' ').pop()}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlayerProfile() {
  const [user, setUser] = useState(null);
  const [selectedMedal, setSelectedMedal] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-player-profile', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: gameRounds = [] } = useQuery({
    queryKey: ['game-rounds-ath', user?.email],
    queryFn: () => base44.entities.GameRound.filter({ user_email: user?.email }, '-win_amount', 100),
    enabled: !!user?.email,
  });

  const {progress:vip}=useVipStatus(wallets[0]);
  const wallet=wallets[0]?{...wallets[0],vip_level:vip?.current.level??null}:null;

  // All-time high multiplier from GameRounds
  const athMultiplier = useMemo(() => {
    if (!gameRounds.length) return null;
    let best = 0;
    gameRounds.forEach(r => {
      if (r.bet_amount > 0 && r.win_amount > 0) {
        const mult = r.win_amount / r.bet_amount;
        if (mult > best) best = mult;
      }
    });
    return best > 0 ? best : null;
  }, [gameRounds]);

  const earnedCount = MEDALS.filter(m => m.check(wallet, user, athMultiplier)).length;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const joinedDaysAgo = user.created_date
    ? Math.floor((Date.now() - new Date(user.created_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-[#0A0612] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0612]/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('Profile')} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black text-white">Player Profile</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        {/* Profile Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-pink-600/20 via-purple-600/10 to-transparent border border-pink-500/20 rounded-3xl p-6 flex items-center gap-5"
        >
          {user.profile_picture ? (
            <img src={user.profile_picture} alt="avatar" className="w-20 h-20 rounded-full object-cover border-4 border-pink-500" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-3xl font-black shrink-0">
              {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xl font-black truncate">{user.username || user.full_name || 'Player'}</div>
            <div className="text-sm text-gray-400 truncate">{user.email}</div>
            <div className="text-xs text-gray-500 mt-1">Account #{user.account_number || 'Pending'}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30">
                VIP {vip?.current.level??'unavailable'}
              </span>
              {joinedDaysAgo !== null && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {joinedDaysAgo < 365
                    ? `${joinedDaysAgo} days`
                    : `${Math.floor(joinedDaysAgo / 365)}y ${Math.floor((joinedDaysAgo % 365) / 30)}m`} member
                </span>
              )}
              <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 text-xs font-bold rounded-full border border-pink-500/30 flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                {earnedCount}/{MEDALS.length} medals
              </span>
            </div>
          </div>
        </motion.div>

        {/* Game Stats */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-pink-400" /> Game Statistics
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={TrendingUp}
              label="Total Wagered"
              value={(wallet?.total_wagered || 0).toLocaleString()}
              sub="Imperial Coins (IC)"
              color="blue"
            />
            <StatCard
              icon={Trophy}
              label="Total Won"
              value={(wallet?.total_won || 0).toLocaleString()}
              sub="Imperial Coins (IC)"
              color="green"
            />
            <StatCard
              icon={TrendingDown}
              label="Total Lost"
              value={(wallet?.total_lost || 0).toLocaleString()}
              sub="Imperial Coins (IC)"
              color="pink"
            />
            <StatCard
              icon={Target}
              label="All-Time High Mult"
              value={athMultiplier ? `${athMultiplier.toFixed(2)}x` : '—'}
              sub="personal best multiplier"
              color="yellow"
            />
            <StatCard
              icon={Star}
              label="Total Deposited"
              value={`$${(wallet?.total_deposited || 0).toFixed(2)}`}
              sub="Imperial Dollars (ID)"
              color="purple"
            />
            <StatCard
              icon={Users}
              label="Experience Points"
              value={(wallet?.experience_points || 0).toLocaleString()}
              sub="XP earned"
              color="pink"
            />
          </div>
        </section>

        {/* Medals */}
        <section>
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Medals
          </h2>
          <p className="text-xs text-gray-500 mb-4">{earnedCount} of {MEDALS.length} earned — tap a medal for details</p>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {MEDALS.map(medal => (
              <MedalCard
                key={medal.id}
                medal={medal}
                wallet={wallet}
                user={user}
                athMult={athMultiplier}
                onClick={setSelectedMedal}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Medal Detail Modal */}
      {selectedMedal && (
        <MedalModal
          medal={selectedMedal}
          wallet={wallet}
          user={user}
          athMult={athMultiplier}
          onClose={() => setSelectedMedal(null)}
        />
      )}
    </div>
  );
}
