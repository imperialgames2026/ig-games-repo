import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import migrationScope from '@/config/game-migration-scope.json';

// A game page with a legacy browser-settled backend is not a working game.
// Never suggest that a stake, spin, wager or payout was accepted.
export default function GameUnavailable({ game }) {
  const onHold = migrationScope.nonMigration.includes(game);
  return (
    <main className="min-h-[80vh] bg-[#0a0612] px-5 py-12 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-[#21192b] p-8">
        <ShieldAlert className="h-12 w-12 text-amber-300" />
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-amber-300">
          {onHold ? 'Currently unavailable' : 'Outside the practice collection'}
        </p>
        <h1 className="mt-2 text-3xl font-black">{game.replace(/^Play/, '').replace(/([a-z])([A-Z])/g, '$1 $2')} is not available</h1>
        <p className="mt-4 leading-7 text-gray-300">
          This game isn’t part of the current tester-chip collection. Explore the game library to find a practice table or an Imperial Original. Your chips haven’t been used.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/Games" className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950">Back to games</Link>
          <Link to="/PlayDice" className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white">Try verified practice Dice</Link>
        </div>
      </div>
    </main>
  );
}
