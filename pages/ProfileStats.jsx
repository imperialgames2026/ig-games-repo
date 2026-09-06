import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Target, Trophy, Layers, DollarSign, Activity, ChevronLeft
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = 'pink', delay = 0 }) {
  const colors = {
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5`}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${colors[color].split(' ').pop()}`} />
        <span className="text-sm text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </motion.div>
  );
}

export default function ProfileStats() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // All poker hands this user participated in
  const { data: allHands = [], isLoading: handsLoading } = useQuery({
    queryKey: ['poker-hand-records', user?.email],
    queryFn: () => base44.entities.PokerHandRecord.list('-created_date', 500),
    enabled: !!user?.email,
  });

  // Last 30 days transactions
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions-30d', user?.email],
    queryFn: () => base44.entities.Transaction.filter({ user_email: user?.email }, '-created_date', 500),
    enabled: !!user?.email,
  });

  // Wallet
  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-stats', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];

  // --- Poker Stats Computation ---
  const pokerStats = useMemo(() => {
    if (!user?.email || allHands.length === 0) return null;

    // Filter hands where current user played
    const myHands = allHands.filter(hand =>
      hand.player_records?.some(p => p.user_email === user.email)
    );

    if (myHands.length === 0) return null;

    let totalHands = myHands.length;
    let wins = 0;
    let losses = 0;
    let folds = 0;
    let vpipHands = 0; // hands where player put money in pre-flop (not folded immediately)
    let allIns = 0;

    myHands.forEach(hand => {
      const myRecord = hand.player_records?.find(p => p.user_email === user.email);
      if (!myRecord) return;

      if (myRecord.result === 'won' || myRecord.result === 'split') wins++;
      if (myRecord.result === 'lost') losses++;
      if (myRecord.result === 'folded') folds++;
      if (myRecord.went_allin) allIns++;

      // VPIP = player didn't fold pre-flop (simplified: they have a non-fold result or their amount_won/lost > 0)
      if (myRecord.result !== 'folded' || myRecord.amount_lost > 0 || myRecord.amount_won > 0) {
        vpipHands++;
      }
    });

    const winRate = totalHands > 0 ? ((wins / totalHands) * 100).toFixed(1) : 0;
    const vpip = totalHands > 0 ? ((vpipHands / totalHands) * 100).toFixed(1) : 0;
    const foldRate = totalHands > 0 ? ((folds / totalHands) * 100).toFixed(1) : 0;

    // Win trend — last 20 hands bucketed into 10 groups of 2
    const recent = myHands.slice(0, 20).reverse();
    const trendData = [];
    for (let i = 0; i < recent.length; i += 2) {
      const group = recent.slice(i, i + 2);
      const groupWins = group.filter(h => h.player_records?.find(p => p.user_email === user.email)?.result === 'won').length;
      trendData.push({ label: `H${i + 1}-${i + 2}`, winRate: (groupWins / group.length) * 100 });
    }

    return { totalHands, wins, losses, folds, winRate, vpip, foldRate, allIns, trendData };
  }, [allHands, user]);

  // --- 30-Day P&L Computation ---
  const pnlStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const recent = transactions.filter(tx => new Date(tx.created_date) >= cutoff);

    // Daily net P&L using cat_dollars (ID = real USD equivalent)
    const dailyMap = {};
    let totalWon = 0;
    let totalLost = 0;

    recent.forEach(tx => {
      const day = new Date(tx.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dailyMap[day]) dailyMap[day] = 0;

      if (tx.type === 'win' && tx.cat_dollars) {
        dailyMap[day] += tx.cat_dollars;
        totalWon += tx.cat_dollars;
      } else if (tx.type === 'loss' && tx.cat_dollars) {
        dailyMap[day] -= tx.cat_dollars;
        totalLost += tx.cat_dollars;
      }
    });

    // Build last 30 days (fill in zeros)
    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartData.push({ label, net: dailyMap[label] || 0 });
    }

    // Running cumulative
    let running = 0;
    const cumulativeData = chartData.map(d => {
      running += d.net;
      return { ...d, cumulative: running };
    });

    const netPnl = totalWon - totalLost;

    return { totalWon, totalLost, netPnl, chartData: cumulativeData };
  }, [transactions]);

  const isLoading = handsLoading || txLoading;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0612] text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0612]/90 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('Profile')} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white">Player Stats</h1>
            <p className="text-xs text-gray-500">{user.full_name || user.email}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* VIP + Overall Lifetime */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-2xl font-black shrink-0">
            {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-xl font-black">{user.username || user.full_name || 'Player'}</div>
            <div className="text-sm text-gray-400">{user.email}</div>
            <div className="text-xs text-gray-500 mt-1">Account #{user.account_number || 'Pending'}</div>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30">
                VIP Level {wallet?.vip_level ?? 1}
              </span>
              <span className="px-3 py-1 bg-pink-500/20 text-pink-400 text-xs font-bold rounded-full border border-pink-500/30">
                {(wallet?.total_wagered || 0).toLocaleString()} IG Wagered
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-yellow-400">{(wallet?.experience_points || 0).toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total XP</div>
          </div>
        </motion.div>

        {/* Poker Stats Section */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" /> Poker Statistics
          </h2>

          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !pokerStats ? (
            <div className="text-center py-12 text-gray-500 bg-white/5 rounded-2xl">
              No poker hands recorded yet. Hit the tables!
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <StatCard icon={Layers} label="Total Hands" value={pokerStats.totalHands.toLocaleString()} delay={0.05} color="purple" />
                <StatCard icon={Target} label="VPIP" value={`${pokerStats.vpip}%`} sub="Voluntarily Put $ In Pot" delay={0.1} color="blue" />
                <StatCard icon={Trophy} label="Win Rate" value={`${pokerStats.winRate}%`} sub={`${pokerStats.wins}W / ${pokerStats.losses}L`} delay={0.15} color="green" />
                <StatCard icon={TrendingDown} label="Fold Rate" value={`${pokerStats.foldRate}%`} sub={`${pokerStats.folds} folds`} delay={0.2} color="yellow" />
                <StatCard icon={Activity} label="All-Ins" value={pokerStats.allIns} delay={0.25} color="red" />
                <StatCard icon={TrendingUp} label="Hands Won" value={pokerStats.wins} sub={`of ${pokerStats.totalHands} played`} delay={0.3} color="pink" />
              </div>

              {/* Win Rate Trend */}
              {pokerStats.trendData.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4">Win Rate Trend (Last 20 Hands)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={pokerStats.trendData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1a1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(v) => [`${v.toFixed(0)}%`, 'Win Rate']}
                      />
                      <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                        {pokerStats.trendData.map((entry, i) => (
                          <Cell key={i} fill={entry.winRate >= 50 ? '#10b981' : '#ec4899'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </section>

        {/* 30-Day P&L Section */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" /> 30-Day Win / Loss (IGUSD)
          </h2>

          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard
                  icon={TrendingUp}
                  label="Total Won"
                  value={`$${(pnlStats.totalWon).toFixed(2)}`}
                  delay={0.05}
                  color="green"
                />
                <StatCard
                  icon={TrendingDown}
                  label="Total Lost"
                  value={`$${(pnlStats.totalLost).toFixed(2)}`}
                  delay={0.1}
                  color="red"
                />
                <StatCard
                  icon={DollarSign}
                  label="Net P&L"
                  value={`${pnlStats.netPnl >= 0 ? '+' : ''}$${pnlStats.netPnl.toFixed(2)}`}
                  sub="past 30 days"
                  delay={0.15}
                  color={pnlStats.netPnl >= 0 ? 'green' : 'red'}
                />
              </div>

              {/* Cumulative P&L Chart */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Cumulative P&L — Last 30 Days</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={pnlStats.chartData}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={pnlStats.netPnl >= 0 ? '#10b981' : '#ec4899'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={pnlStats.netPnl >= 0 ? '#10b981' : '#ec4899'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      interval={4}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `$${v.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cumulative P&L']}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke={pnlStats.netPnl >= 0 ? '#10b981' : '#ec4899'}
                      strokeWidth={2}
                      fill="url(#pnlGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {/* Zero reference line label */}
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-3 h-3 rounded-full ${pnlStats.netPnl >= 0 ? 'bg-green-500' : 'bg-pink-500'}`} />
                  <span className="text-xs text-gray-400">
                    {pnlStats.netPnl >= 0
                      ? `You're up $${pnlStats.netPnl.toFixed(2)} this month`
                      : `You're down $${Math.abs(pnlStats.netPnl).toFixed(2)} this month`}
                  </span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Lifetime Wallet Stats */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Lifetime Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label="Lifetime Won" value={(wallet?.total_won || 0).toLocaleString()} sub="IG" delay={0.05} color="green" />
            <StatCard icon={TrendingDown} label="Lifetime Lost" value={(wallet?.total_lost || 0).toLocaleString()} sub="IG" delay={0.1} color="red" />
            <StatCard icon={Layers} label="Total Wagered" value={(wallet?.total_wagered || 0).toLocaleString()} sub="IG" delay={0.15} color="blue" />
            <StatCard icon={DollarSign} label="Total Deposited" value={`$${(wallet?.total_deposited || 0).toFixed(2)}`} delay={0.2} color="purple" />
          </div>
        </section>

      </div>
    </div>
  );
}