import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Users, DollarSign, Gift, Ticket, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

function useCountdown(startsAt) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(startsAt) - new Date();
      if (diff <= 0) return setTimeLeft('Starting now');
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startsAt]);

  return timeLeft;
}

export default function TournamentCard({ tournament, user, userRegistrations, onRegister }) {
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(tournament.starts_at);
  const isUpcoming = tournament.status === 'upcoming' || tournament.status === 'registration_open';

  const isRegistered = userRegistrations?.some(r => r.tournament_id === tournament.id);
  const isFreeroll = tournament.tournament_type === 'freeroll';
  const isFull = tournament.max_players && tournament.registered_count >= tournament.max_players;

  const typeColors = {
    freeroll: 'bg-green-500/20 text-green-400',
    daily: 'bg-blue-500/20 text-blue-400',
    weekly: 'bg-purple-500/20 text-purple-400',
    special: 'bg-yellow-500/20 text-yellow-400',
    apex: 'bg-red-500/20 text-red-400',
    satellite: 'bg-cyan-500/20 text-cyan-400',
    bounty: 'bg-orange-500/20 text-orange-400'
  };

  const typeLabels = {
    freeroll: '🆓 Freeroll',
    daily: 'Daily',
    weekly: 'Weekly',
    special: '⭐ Special',
    apex: '🏆 Apex',
    satellite: '🛰️ Satellite',
    bounty: '💥 Bounty PKO'
  };

  const statusColors = {
    upcoming: 'bg-gray-500/20 text-gray-400',
    registration_open: 'bg-green-500/20 text-green-400',
    running: 'bg-yellow-500/20 text-yellow-400',
    finished: 'bg-gray-500/20 text-gray-400',
    cancelled: 'bg-red-500/20 text-red-400'
  };

  const handleRegister = async () => {
    if (!user || isRegistered || loading) return;
    setLoading(true);
    await onRegister(tournament);
    setLoading(false);
  };

  const canRegister = user &&
    !isRegistered &&
    !isFull &&
    (tournament.status === 'upcoming' || tournament.status === 'registration_open');

  return (
    <div className={`bg-gradient-to-br from-[#1A1030] to-[#120D20] border rounded-xl p-5 hover:border-pink-500/30 transition-all ${
      tournament.tournament_type === 'special' ? 'border-yellow-500/30' : 'border-white/10'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-bold text-lg">{tournament.name}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className={`text-xs capitalize ${typeColors[tournament.tournament_type]}`}>
              {typeLabels[tournament.tournament_type] || tournament.tournament_type}
            </Badge>
            <Badge className={`text-xs ${statusColors[tournament.status]}`}>
              {tournament.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="text-right">
          {isFreeroll ? (
            <div className="flex items-center gap-1 text-green-400 font-bold">
              <Gift className="w-4 h-4" />
              <span>FREE</span>
            </div>
          ) : (
            <div className="text-pink-400 font-bold">{tournament.buyin_id} ID</div>
          )}
          <div className="text-gray-500 text-xs">Buy-in</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
            <Calendar className="w-3 h-3" />
            Start Time
          </div>
          <div className="text-white text-sm font-medium">
            {format(new Date(tournament.starts_at), 'MMM d, h:mm a')}
          </div>
          <div className="text-gray-500 text-xs">(your local time)</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
            <Users className="w-3 h-3" />
            Players
          </div>
          <div className="text-white text-sm font-medium">
            {tournament.registered_count}{tournament.max_players ? `/${tournament.max_players}` : ''}
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      {isUpcoming && (
        <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-pink-400 text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            Starts In
          </div>
          <div className="text-white font-mono font-bold text-sm">{countdown}</div>
        </div>
      )}

      {/* Bounty Info */}
      {tournament.tournament_type === 'bounty' && tournament.bounty_amount > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💥</span>
            <span className="text-orange-400 text-xs font-bold">Progressive Knockout (PKO)</span>
          </div>
          <p className="text-gray-300 text-xs">
            Each player starts with a <span className="text-orange-300 font-bold">{tournament.bounty_amount} ID</span> bounty on their head.
            Knock someone out → collect their full bounty. Every KO you rack up also adds to <em>your</em> bounty — making you a bigger target!
          </p>
        </div>
      )}

      {/* Satellite Info */}
      {tournament.tournament_type === 'satellite' && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🛰️</span>
            <span className="text-cyan-400 text-xs font-bold">Satellite Tournament</span>
          </div>
          <p className="text-gray-300 text-xs">
            Top <span className="text-cyan-300 font-bold">{tournament.satellite_tickets_awarded || 1}</span> finisher(s) win a ticket to the next major event!
          </p>
        </div>
      )}

      {/* ITM & Prize Pool */}
      {(tournament.prize_pool_total > 0 || tournament.in_the_money_spots > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {tournament.prize_pool_total > 0 && (
            <div className="bg-yellow-500/10 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <DollarSign className="w-3 h-3" />
                Prize Pool
              </div>
              <div className="text-yellow-400 text-sm font-bold">{tournament.prize_pool_total.toLocaleString()} IC</div>
            </div>
          )}
          {tournament.in_the_money_spots > 0 && (
            <div className="bg-green-500/10 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-1">
                <Trophy className="w-3 h-3" />
                ITM Spots
              </div>
              <div className="text-green-400 text-sm font-bold">Top {tournament.in_the_money_spots}</div>
            </div>
          )}
        </div>
      )}

      {/* Prize Payouts Table */}
      {tournament.prize_payouts && tournament.prize_payouts.some(p => p.amount > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 text-xs font-bold">Prize Payouts</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tournament.prize_payouts.filter(p => p.amount > 0).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className={`font-bold ${p.position === 1 ? 'text-yellow-400' : p.position === 2 ? 'text-gray-300' : p.position === 3 ? 'text-orange-400' : 'text-gray-400'}`}>
                  {p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : p.position === 3 ? '🥉' : `#${p.position}`} Place
                </span>
                <span className="text-white font-semibold">{p.amount.toLocaleString()} <span className="text-gray-400">{p.currency}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prize Info */}
      {tournament.prize_pool_description && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400 text-xs font-bold">Prizes</span>
          </div>
          <p className="text-gray-300 text-xs">{tournament.prize_pool_description}</p>
          {tournament.prize_voucher_code && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Ticket className="w-3 h-3 text-pink-400" />
              <span className="text-pink-300 text-xs">Winner receives tournament voucher</span>
            </div>
          )}
        </div>
      )}

      {/* Blind levels preview */}
      {tournament.blind_levels && tournament.blind_levels.length > 0 && (
        <div className="mb-4">
          <div className="text-gray-500 text-xs mb-1.5">Blind Structure ({tournament.blind_levels[0]?.duration_minutes} min levels)</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {tournament.blind_levels.slice(0, 5).map((level) => (
              <div key={level.level} className={`shrink-0 text-center rounded px-2 py-1 text-xs ${
                tournament.current_level === level.level && tournament.status === 'running'
                  ? 'bg-pink-500/30 text-pink-300 border border-pink-500/50'
                  : 'bg-white/5 text-gray-400'
              }`}>
                <div className="font-bold">{level.small_blind}/{level.big_blind}</div>
              </div>
            ))}
            {tournament.blind_levels.length > 5 && (
              <div className="shrink-0 text-center bg-white/5 rounded px-2 py-1 text-xs text-gray-500">
                +{tournament.blind_levels.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleRegister}
        disabled={!canRegister || loading}
        className={`w-full ${
          isRegistered
            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
            : isFull
              ? 'bg-gray-500/20 text-gray-400'
              : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700'
        }`}
        variant={isRegistered || isFull ? 'ghost' : 'default'}
      >
        {isRegistered ? '✓ Registered' : isFull ? 'Tournament Full' : canRegister ? 'Register Now' : 'Registration Closed'}
      </Button>
    </div>
  );
}