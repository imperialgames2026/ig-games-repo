import React from 'react';
import { Users, DollarSign, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function SitAndGoTableCard({ table }) {
  const seated = table.seated_players?.length || 0;
  const isFull = seated >= table.max_players;
  const statusColor = {
    waiting: 'bg-yellow-500/20 text-yellow-400',
    active: 'bg-green-500/20 text-green-400',
    finished: 'bg-gray-500/20 text-gray-400'
  }[table.status] || 'bg-gray-500/20 text-gray-400';

  const statusLabel = {
    waiting: 'Waiting',
    active: 'In Progress',
    finished: 'Finished'
  }[table.status];

  return (
    <div className="bg-gradient-to-br from-[#1A1030] to-[#120D20] border border-white/10 rounded-xl p-4 hover:border-pink-500/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-bold">{table.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-pink-400 font-bold text-sm">{table.small_blind}/{table.big_blind} ID</div>
          <div className="text-gray-500 text-xs">Blinds</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-white font-bold text-sm">{table.min_buyin}</div>
          <div className="text-gray-500 text-xs">Min Buy-in</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="text-white font-bold text-sm">{table.max_buyin}</div>
          <div className="text-gray-500 text-xs">Max Buy-in</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className={`font-bold text-sm ${isFull ? 'text-red-400' : 'text-green-400'}`}>
            {seated}/{table.max_players}
          </div>
          <div className="text-gray-500 text-xs">Players</div>
        </div>
      </div>

      {/* Seats visual */}
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: table.max_players }).map((_, i) => {
          const player = table.seated_players?.find(p => p.seat === i + 1);
          return (
            <div
              key={i}
              className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs ${
                player ? 'bg-pink-500/30 text-pink-300' : 'bg-white/5 text-gray-600'
              }`}
            >
              {player ? player.display_name?.charAt(0).toUpperCase() : '—'}
            </div>
          );
        })}
      </div>

      <Link to={createPageUrl(`PlayPoker?tableId=${table.id}`)}>
        <Button
          disabled={isFull || table.status === 'finished'}
          className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 disabled:opacity-40"
        >
          <Play className="w-4 h-4 mr-2" />
          {table.status === 'active' ? 'Join Table' : isFull ? 'Table Full' : 'Take a Seat'}
        </Button>
      </Link>
    </div>
  );
}