import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { createPageUrl } from '@/utils';
import ExclusionBanner from '@/components/casino/ExclusionBanner';
import { motion } from 'framer-motion';
import { Gamepad2, LayoutGrid, Table, Sparkles, Dice5, Crown, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import GameCard from '@/components/casino/GameCard';
import WeeklyTokenLeaderboard from '@/components/casino/WeeklyTokenLeaderboard';

const categoryIcons = {
  all: LayoutGrid,
  table: Table,
  slots: Sparkles,
  instant: Dice5,
  cards: Gamepad2,
  poker: Crown,
  blackjack: Crown,
};

export default function Games() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.filter({ is_active: true }),
  });

  if (user?.is_excluded) return <ExclusionBanner />;

  const categories = ['all', 'table', 'slots', 'instant', 'cards', 'poker', 'blackjack'];

  const sortGames = (gamesList) => {
    const categoryOrder = { 'instant': 1, 'table': 2, 'cards': 3, 'slots': 4 };
    return [...gamesList].sort((a, b) => {
      const orderA = categoryOrder[a.category] || 999;
      const orderB = categoryOrder[b.category] || 999;
      return orderA - orderB;
    });
  };

  const uniqueGames = Array.from(
    new Map(games.map((game) => [game.slug || game.id, game])).values()
  );

  const filterGames = (category) => {
    if (category === 'all') return sortGames(uniqueGames);
    return uniqueGames.filter(g => g.category === category);
  };

  return (
    <PullToRefresh onRefresh={() => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-token-leaderboard'] });
    }}>
      <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/30 via-transparent to-blue-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-500/30 mb-6">
              <Gamepad2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">Game Library</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Explore our collection of exciting casino games. Play responsibly and have fun!
            </p>
          </motion.div>
        </div>
      </div>

      {/* Games */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <section aria-label="Available multiplayer practice tables" className="mb-10 rounded-2xl border border-amber-400/20 bg-[#181525] p-5 sm:p-7">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Staging · Multiplayer practice</p>
            <h2 className="mt-2 text-2xl font-black text-white">Join a live casino-style table</h2>
            <p className="mt-2 text-sm text-gray-300">Play beside other signed-in users using imaginary practice chips only. No cryptocurrency, paid wagers, transfers, redemptions or cash prizes.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to={createPageUrl('PlayCraps')}
              className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950 to-[#123429] p-5 text-white transition hover:border-amber-300">
              <div className="text-4xl">🎲</div>
              <h3 className="mt-2 text-xl font-black">Multiplayer Craps</h3>
              <p className="mt-2 text-sm text-gray-300">Take the shooter's turn or join the action with Pass Line, Field, Any Seven and Place Number practice bets.</p>
              <p className="mt-4 text-sm font-bold text-amber-200">Enter craps table →</p>
            </Link>
            <Link to={createPageUrl('PlayRoulette')}
              className="rounded-xl border border-red-400/30 bg-gradient-to-br from-red-950 to-[#2c1a1a] p-5 text-white transition hover:border-amber-300">
              <div className="text-4xl">🎡</div>
              <h3 className="mt-2 text-xl font-black">Multiplayer Roulette</h3>
              <p className="mt-2 text-sm text-gray-300">Join a shared single-zero table, cover your numbers or outside selections, and watch a communal spin.</p>
              <p className="mt-4 text-sm font-bold text-amber-200">Enter roulette table →</p>
            </Link>
            <Link to={createPageUrl('PlayBaccarat')}
              className="rounded-xl border border-blue-400/30 bg-gradient-to-br from-blue-950 to-[#152d3b] p-5 text-white hover:border-amber-300">
              <div className="text-4xl">🃏</div>
              <h3 className="mt-2 text-xl font-black">Multiplayer Baccarat</h3>
              <p className="mt-2 text-sm text-gray-300">One communal 8-deck hand. Place Player, Banker or Tie practice chips before the deal.</p>
              <p className="mt-4 text-sm font-bold text-amber-200">Enter Baccarat table →</p>
            </Link>
            <Link to={createPageUrl('PlayCrash')}
              className="rounded-xl border border-pink-400/30 bg-gradient-to-br from-purple-950 to-[#2d1b3d] p-5 text-white hover:border-amber-300">
              <div className="text-4xl">📈</div>
              <h3 className="mt-2 text-xl font-black">Multiplayer Crash</h3>
              <p className="mt-2 text-sm text-gray-300">Watch a shared multiplier and bet on a preset server-side automatic cashout threshold.</p>
              <p className="mt-4 text-sm font-bold text-amber-200">Enter Crash table →</p>
            </Link>
            <Link to={createPageUrl('PlayTrenball')}
              className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-950 to-[#39300f] p-5 text-white hover:border-amber-300">
              <div className="text-4xl">🌙</div>
              <h3 className="mt-2 text-xl font-black">Multiplayer Trenball</h3>
              <p className="mt-2 text-sm text-gray-300">Red, Green or Moon predictions on the same live Crash round.</p>
              <p className="mt-4 text-sm font-bold text-amber-200">Enter Trenball table →</p>
            </Link>
          </div>
        </section>
        <WeeklyTokenLeaderboard />

        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl flex-wrap h-auto gap-1">
            {[
              { value: 'all', label: 'All', Icon: LayoutGrid },
              { value: 'table', label: 'Table', Icon: Table },
              { value: 'slots', label: 'Slots', Icon: Sparkles },
              { value: 'instant', label: 'Instant', Icon: Dice5 },
              { value: 'cards', label: 'Cards', Icon: Gamepad2 },
              { value: 'poker', label: 'Poker', Icon: Crown },
              { value: 'blackjack', label: 'Blackjack', Icon: Crown },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600 data-[state=active]:text-white rounded-lg px-4"
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {['all', 'table', 'slots', 'instant', 'cards'].map((category) => (
            <TabsContent key={category} value={category}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filterGames(category).map((game, i) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <GameCard game={game} />
                  </motion.div>
                ))}
              </div>
              
              {filterGames(category).length === 0 && (
                <div className="text-center py-20">
                  <Gamepad2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-400">No games in this category</h3>
                  <p className="text-gray-500">Check back soon for new additions!</p>
                </div>
              )}
            </TabsContent>
          ))}

          {/* Poker Tab */}
          <TabsContent value="poker">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500 to-pink-700 shadow-lg shadow-pink-500/40 mb-6">
                <Crown className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Imperial Poker</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                Join live Sit & Go tables or compete in scheduled tournaments. Real action, real stakes.
              </p>
              <Link to={createPageUrl('PokerLobby')}>
                <Button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-lg px-10 py-4 h-auto rounded-xl shadow-lg shadow-pink-500/30">
                  Enter Poker Lobby <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </TabsContent>

          {/* Blackjack Tab */}
          <TabsContent value="blackjack">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500 to-pink-700 shadow-lg shadow-pink-500/40 mb-6">
                <Crown className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">Imperial Blackjack</h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                Play solo or take a seat at a live multiplayer blackjack table with other players.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to={createPageUrl('PlayBlackjack')}>
                  <Button variant="outline" className="border-pink-500/50 text-pink-400 hover:bg-pink-500/10 font-bold text-lg px-10 py-4 h-auto rounded-xl">
                    Solo Blackjack
                  </Button>
                </Link>
                <Link to={createPageUrl('BlackjackLobby')}>
                  <Button className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold text-lg px-10 py-4 h-auto rounded-xl shadow-lg shadow-pink-500/30">
                    Multiplayer Lobby <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>

      </div>
      </div>
    </PullToRefresh>
  );
}