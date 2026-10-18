import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

const GAME_LABELS = {
  'crash': '💥 Crash',
  'rocket': '🚀 Rocket',
  'limbo': '🚀 Limbo',
  'plinko': '🎯 Plinko',
  'mines': '💣 Mines',
  'towers': '🗼 Towers',
  'dice': '🎲 Dice',
  'roulette': '🎰 Roulette',
  'blackjack': '🃏 Blackjack',
  'hilo': '🃏 HiLo',
  'wheel': '🎡 Wheel',
  'slots': '🎰 Slots',
  'coinflip': '🪙 Coin Flip',
  'twist': '🌀 Twist',
  'hashdice': '🎲 Hash Dice',
  'trenball': '⚽ Trenball',
  'craps': '🎲 Craps',
  'dicezone': '🎲 Dice Zone',
  'hotpot': '🍲 Hot Pot',
};

function getGameLabel(slug) {
  if (!slug) return '🎮 Game';
  const lower = slug.toLowerCase().replace(/-/g, '').replace(/_/g, '');
  for (const [key, label] of Object.entries(GAME_LABELS)) {
    if (lower.includes(key)) return label;
  }
  return '🎮 ' + slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getMultiplier(round) {
  if (round.win_amount > 0 && round.bet_amount > 0) {
    return (round.win_amount / round.bet_amount).toFixed(2);
  }
  return null;
}

function PlayerAvatar({ name, picture }) {
  const initials = name ? name.slice(0, 2).toUpperCase() : '??';
  if (picture) {
    return (
      <img
        src={picture}
        alt={name}
        className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-white">{initials}</span>
    </div>
  );
}

export default function LiveBetFeed() {
  const [bets, setBets] = useState([]);
  const [userCache, setUserCache] = useState({}); // email -> { full_name, profile_picture }

  const fetchUserInfo = async (email) => {
    if (!email || userCache[email]) return;
    try {
      const users = await base44.entities.User.filter({ email });
      if (users.length > 0) {
        setUserCache(prev => ({
          ...prev,
          [email]: {
            full_name: users[0].full_name || users[0].email?.split('@')[0] || 'Player',
            profile_picture: users[0].profile_picture || null,
          }
        }));
      }
    } catch {}
  };

  useEffect(() => {
    base44.entities.GameRound.list('-created_date', 20).then(rounds => {
      const mapped = rounds.map(r => ({ ...r.data || r, id: r.id, created_date: r.created_date }));
      setBets(mapped);
      // Prefetch user info for all emails
      const emails = [...new Set(mapped.map(r => r.user_email).filter(Boolean))];
      emails.forEach(fetchUserInfo);
    }).catch(() => {});

    const unsubscribe = base44.entities.GameRound.subscribe((event) => {
      if (event.type === 'create' && event.data) {
        const newBet = { ...event.data, id: event.id, created_date: new Date().toISOString() };
        setBets(prev => [newBet, ...prev].slice(0, 20));
        fetchUserInfo(event.data.user_email);
      }
    });

    return () => unsubscribe();
  }, []);

  if (bets.length === 0) return null;

  return (
    <div className="w-full mt-16">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-pink-400" />
          Live Bet Feed
        </h3>
        <span className="text-xs text-gray-500 ml-auto">All Players</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-4 text-xs text-gray-500 font-medium px-4 py-3 border-b border-white/10">
            <span>Player</span>
            <span>Game</span>
            <span className="text-right">Bet</span>
            <span className="text-right">Result</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {bets.map((bet) => {
                const won = bet.win_amount > 0;
                const multiplier = getMultiplier(bet);
                const userInfo = userCache[bet.user_email];
                const displayName = userInfo?.full_name || bet.user_email?.split('@')[0] || 'Player';
                const picture = userInfo?.profile_picture || null;

                return (
                  <motion.div
                    key={bet.id}
                    initial={{ opacity: 0, y: -10, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-4 items-center px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    {/* Player */}
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={displayName} picture={picture} />
                      <span className="text-gray-200 text-sm font-medium truncate max-w-[100px]">{displayName}</span>
                    </div>

                    {/* Game */}
                    <span className="text-gray-300 text-sm">{getGameLabel(bet.game_slug)}</span>

                    {/* Bet */}
                    <span className="text-right text-gray-300 text-sm font-mono">
                      {bet.bet_amount != null ? Number(bet.bet_amount).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                    </span>

                    {/* Result */}
                    <span className={`text-right text-sm font-bold flex items-center justify-end gap-1 ${won ? 'text-green-400' : 'text-red-400'}`}>
                      {won ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {won && multiplier ? `${multiplier}x` : 'Loss'}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}