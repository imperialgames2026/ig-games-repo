import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TABS = ['All Games', 'High Rollers', 'My Bets'];

export default function LiveBetsPanel({ gameName = '', userEmail = '' }) {
  const [activeTab, setActiveTab] = useState('All Games');
  const [bets, setBets] = useState([]);

  useEffect(() => {
    // Load recent transactions as live bets feed
    const load = async () => {
      try {
        const recent = await base44.entities.Transaction.list('-created_date', 30);
        setBets(recent);
      } catch (_) {}
    };
    load();

    // Subscribe to new transactions
    const unsub = base44.entities.Transaction.subscribe((event) => {
      if (event.type === 'create') {
        setBets(prev => [event.data, ...prev.slice(0, 29)]);
      }
    });
    return () => unsub();
  }, []);

  const filtered = bets.filter(b => {
    if (activeTab === 'My Bets') return b.user_email === userEmail;
    if (activeTab === 'High Rollers') return Math.abs(b.amount) >= 100;
    return true;
  });

  const formatGame = (slug) => {
    if (!slug) return 'Game';
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="bg-[#111122]">
      {/* Tab bar */}
      <div className="flex border-b border-white/10 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'text-white border-b-2 border-pink-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 py-2 text-xs text-gray-500 border-b border-white/5">
        <span className="flex-1">Game</span>
        <span className="w-24 text-right">Result</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">No bets yet</div>
        ) : (
          filtered.map((b, i) => {
            const isWin = b.amount > 0;
            return (
              <div key={b.id || i} className="flex items-center px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-pink-400">
                      {(b.user_email || 'A')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-300 truncate">
                    {formatGame(b.game_slug)}
                  </span>
                </div>
                <span className={`w-24 text-right text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {isWin ? '+' : ''}{Number(b.amount).toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}