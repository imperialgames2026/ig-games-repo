import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spade, Trophy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import SitAndGoTableCard from '@/components/poker/SitAndGoTableCard';
import TournamentCard from '@/components/poker/TournamentCard';
import LobbyChat from '@/components/poker/LobbyChat';

export default function PokerLobby() {
  const [user, setUser] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u) {
        base44.entities.UserWallet.filter({ user_email: u.email }).then(setWallets);
      }
    }).catch(() => {});
  }, []);

  const wallet = wallets[0];

  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ['sng-tables'],
    queryFn: () => base44.entities.SitAndGoTable.filter({ is_active: true }),
    refetchInterval: 10000
  });

  const { data: tournaments = [], refetch: refetchTournaments } = useQuery({
    queryKey: ['poker-tournaments'],
    queryFn: () => base44.entities.PokerTournament.list('-starts_at'),
    refetchInterval: 30000
  });

  const { data: userRegistrations = [] } = useQuery({
    queryKey: ['my-tournament-regs', user?.email],
    queryFn: () => base44.entities.TournamentRegistration.filter({ user_email: user?.email }),
    enabled: !!user?.email
  });

  const handleRegister = async (tournament) => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    const wallet = wallets[0];
    if (tournament.buyin_id > 0) {
      if (!wallet || wallet.cat_dollars < tournament.buyin_id) {
        alert('Insufficient Imperial Dollars (ID) for this tournament.');
        return;
      }
      // Deduct buy-in
      await base44.entities.UserWallet.update(wallet.id, {
        cat_dollars: wallet.cat_dollars - tournament.buyin_id
      });
      await base44.entities.Transaction.create({
        user_email: user.email,
        type: 'loss',
        amount: 0,
        cat_dollars: -tournament.buyin_id,
        description: `Tournament buy-in: ${tournament.name}`,
        balance_after: wallet.cat_dollars - tournament.buyin_id
      });
    }
    await base44.entities.TournamentRegistration.create({
      tournament_id: tournament.id,
      user_email: user.email,
      display_name: user.full_name || user.email.split('@')[0],
      status: 'registered',
      chips: tournament.starting_stack || 5000
    });
    await base44.entities.PokerTournament.update(tournament.id, {
      registered_count: (tournament.registered_count || 0) + 1
    });
    refetchTournaments();
  };

  const sortedTables = [...tables].sort((a, b) => {
    const aFull = (a.seated_players?.length || 0) >= a.max_players;
    const bFull = (b.seated_players?.length || 0) >= b.max_players;
    if (aFull && !bFull) return -1;
    if (!aFull && bFull) return 1;
    return a.small_blind - b.small_blind;
  });

  const activeTournaments = tournaments.filter(t => ['upcoming', 'registration_open', 'running'].includes(t.status));
  const pastTournaments = tournaments.filter(t => ['finished', 'cancelled'].includes(t.status));
  const freerolls = activeTournaments.filter(t => t.tournament_type === 'freeroll');
  const paidTournaments = activeTournaments.filter(t => t.tournament_type !== 'freeroll');

  return (
    <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1A0830] to-[#0A0612] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">
                ♠️
              </div>
              <div>
                <h1 className="text-3xl font-black text-white">Poker Lobby</h1>
                <p className="text-gray-400">Texas Hold'em · Imperial Dollars</p>
              </div>
            </div>
            {wallet && (
              <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-right">
                <div className="text-gray-400 text-xs">Your Balance</div>
                <div className="text-white font-bold text-xl">{wallet.cat_dollars?.toLocaleString()} <span className="text-pink-400">ID</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="sng">
              <TabsList className="bg-white/5 border border-white/10 mb-6">
                <TabsTrigger value="sng" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white text-gray-400 gap-2">
                  <span>♠</span> Sit & Go
                  <span className="ml-1 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{tables.length}</span>
                </TabsTrigger>
                <TabsTrigger value="mtt" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white text-gray-400 gap-2">
                  <Trophy className="w-4 h-4" /> Tournaments
                  <span className="ml-1 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{activeTournaments.length}</span>
                </TabsTrigger>
              </TabsList>

              {/* Sit & Go Tab */}
              <TabsContent value="sng">
                {tables.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <span className="text-5xl block mb-4">🃏</span>
                    <p className="text-lg">No tables open right now.</p>
                    <p className="text-sm">Check back soon or ask the lobby host!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedTables.map(table => (
                      <SitAndGoTableCard key={table.id} table={table} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* MTT Tab */}
              <TabsContent value="mtt">
                {/* Freerolls section */}
                {freerolls.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-green-400 font-bold text-lg mb-4 flex items-center gap-2">
                      🆓 Free Tournaments
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {freerolls.map(t => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          user={user}
                          userRegistrations={userRegistrations}
                          onRegister={handleRegister}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid tournaments */}
                {paidTournaments.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-yellow-400 font-bold text-lg mb-4 flex items-center gap-2">
                      🏆 Scheduled Tournaments
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paidTournaments.map(t => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          user={user}
                          userRegistrations={userRegistrations}
                          onRegister={handleRegister}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {activeTournaments.length === 0 && (
                  <div className="text-center py-20 text-gray-500">
                    <span className="text-5xl block mb-4">🏆</span>
                    <p className="text-lg">No upcoming tournaments.</p>
                    <p className="text-sm">Check back for daily freerolls and weekend events!</p>
                  </div>
                )}

                {/* Past Tournaments */}
                {pastTournaments.length > 0 && (
                  <div>
                    <h2 className="text-gray-500 font-bold text-sm mb-3">Past Tournaments</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                      {pastTournaments.slice(0, 4).map(t => (
                        <TournamentCard
                          key={t.id}
                          tournament={t}
                          user={user}
                          userRegistrations={userRegistrations}
                          onRegister={handleRegister}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Lobby Chat Sidebar */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            <div className="h-[600px] lg:sticky lg:top-24">
              <LobbyChat user={user} />
            </div>
          </div>
        </div>
      </div>

      {/* Game Info Dropdown */}
      <div className="max-w-7xl mx-auto px-4 pb-10">
        <div className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg font-bold">IG Poker</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Poker', '# Imperial Originals', '# Customized', '# Table games', "# Hold'em", '# MTT'].map(tag => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                We are excited to introduce IG Poker, a stellar Texas Hold 'em poker game that opens the doors to a world of infinite possibilities, thrilling challenges, and immersive experiences. Whether you're a seasoned poker pro or a casual player, IG Poker promises a gameplay experience like no other.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}