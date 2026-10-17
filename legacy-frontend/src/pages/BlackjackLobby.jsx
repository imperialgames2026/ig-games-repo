import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Crown, Users, ArrowRight } from 'lucide-react';
import LobbyChat from '@/components/poker/LobbyChat';

function getCirclePositions(count) {
  const start = 5;
  const end = 175;
  const spread = end - start;
  return Array.from({ length: count }, (_, i) => {
    const angle = count === 1 ? 90 : start + (spread / (count - 1)) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  });
}

function TableNode({ table, index, onJoin }) {
  const seated = (table.seated_players || []).length;
  const maxSeats = table.max_seats || 7;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onJoin}
      className="w-44 rounded-2xl p-3 text-left"
      style={{
        background: 'rgba(13, 9, 23, 0.92)',
        border: '1px solid rgba(236,72,153,0.38)',
        boxShadow: '0 0 20px rgba(236,72,153,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <div className="flex items-center gap-1 mb-1">
            {table.is_high_roller && <Crown className="w-3 h-3 text-yellow-400" />}
            <div className="text-white font-black text-xs leading-tight">{table.name}</div>
          </div>
          <div className="text-[10px] text-gray-400">
            {table.min_bet > 0 ? `Min ${table.min_bet}` : 'No Min'} · Max {table.max_bet}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
          <Users className="w-3 h-3" />
          <span>{seated}/{maxSeats}</span>
        </div>
      </div>

      <div className="flex gap-1 mb-2">
        {Array.from({ length: maxSeats }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: i < seated ? '#ec4899' : 'rgba(255,255,255,0.14)' }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400">6 Deck</span>
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500/15 text-blue-400">S17</span>
        <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/15 text-amber-400">3:2</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{table.currency === 'both' ? 'IC / ID' : table.currency}</span>
        <div className="flex items-center gap-1 text-[10px] font-black text-pink-400">
          Join <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </motion.button>
  );
}

export default function BlackjackLobby() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: tables = [] } = useQuery({
    queryKey: ['bj-tables-lobby'],
    queryFn: () => base44.entities.BlackjackTable.filter({ is_active: true }),
    refetchInterval: 10000,
  });

  const positions = getCirclePositions(tables.length);

  const handleJoin = (tableId) => {
    if (!user) return base44.auth.redirectToLogin();
    navigate(`/PlayMultiplayerBlackjack?table=${tableId}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0612] overflow-hidden">
      <div className="flex flex-col lg:flex-row min-h-screen">
        <div className="flex-1 relative px-4 py-6 lg:px-8 lg:py-8 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[38rem] h-[18rem] rounded-full bg-pink-500/10 blur-3xl" />
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[48rem] h-[24rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
          </div>

          <div className="relative z-10 text-center mb-6 lg:mb-10">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600">Blackjack</span>
            </h1>
            <p className="text-gray-400 text-sm lg:text-base">Pick your table from the live floor and take your seat.</p>
          </div>

          <div className="relative mx-auto w-full max-w-[1100px] h-[760px] lg:h-[840px]">
            <svg viewBox="0 0 1100 840" className="absolute inset-0 w-full h-full">
              <defs>
                <filter id="pinkGlow">
                  <feGaussianBlur stdDeviation="12" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="tableFill" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#153d26" />
                  <stop offset="55%" stopColor="#0f2d1d" />
                  <stop offset="100%" stopColor="#09150f" />
                </radialGradient>
              </defs>

              <ellipse cx="550" cy="390" rx="320" ry="230" fill="url(#tableFill)" />
              <ellipse cx="550" cy="390" rx="350" ry="255" fill="none" stroke="#ec4899" strokeWidth="3" filter="url(#pinkGlow)" opacity="0.85" />
              <ellipse cx="550" cy="390" rx="338" ry="244" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              <ellipse cx="550" cy="390" rx="300" ry="214" fill="none" stroke="rgba(236,72,153,0.28)" strokeWidth="1" />

              <text x="550" y="285" textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="34" fontWeight="900" letterSpacing="10">IMPERIAL</text>
              <text x="550" y="320" textAnchor="middle" fill="rgba(255,255,255,0.05)" fontSize="15" fontWeight="900" letterSpacing="16">BLACKJACK FLOOR</text>

              <ellipse cx="550" cy="205" rx="84" ry="30" fill="rgba(236,72,153,0.08)" stroke="rgba(236,72,153,0.26)" />
              <text x="550" y="211" textAnchor="middle" fill="rgba(236,72,153,0.7)" fontSize="12" fontWeight="900" letterSpacing="4">DEALER</text>

              {positions.map((pos, i) => {
                const startX = 550 + pos.x * 300;
                const startY = 390 + pos.y * 214;
                const endX = 550 + pos.x * 345;
                const endY = 390 + pos.y * 255;
                return (
                  <line
                    key={i}
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="rgba(236,72,153,0.18)"
                    strokeWidth="1"
                    strokeDasharray="5 7"
                  />
                );
              })}
            </svg>

            {tables.map((table, i) => {
              const pos = positions[i];
              const x = 550 + pos.x * 350;
              const y = 390 + pos.y * 250;
              return (
                <div
                  key={table.id}
                  className="absolute"
                  style={{ left: `${(x / 1100) * 100}%`, top: `${(y / 840) * 100}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <TableNode table={table} index={i} onJoin={() => handleJoin(table.id)} />
                </div>
              );
            })}

            {tables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-semibold">
                No blackjack tables available right now.
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-72 xl:w-80 shrink-0 p-4 lg:pt-24">
          <div className="h-[500px] lg:sticky lg:top-24">
            <LobbyChat user={user} roomId="blackjack-lobby" title="Blackjack Lobby" />
          </div>
        </div>
      </div>
    </div>
  );
}