import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

// A game page with a legacy browser-settled backend is not a working game.
// Never suggest that a stake, spin, wager or payout was accepted.
export default function GameUnavailable({ game }) {
  return (
    <main className="min-h-[80vh] bg-[#0a0612] px-5 py-12 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-[#21192b] p-8">
        <ShieldAlert className="h-12 w-12 text-amber-300" />
        <p className="mt-5 text-xs font-black uppercase tracking-widest text-amber-300">
          Staging-only · Backend migration pending
        </p>
        <h1 className="mt-2 text-3xl font-black">{game.replace(/^Play/, '')} is not accepting wagers</h1>
        <p className="mt-4 leading-7 text-gray-300">
          This game's original Base44 settlement operation has not passed the
          Supabase authorization, fairness and transaction tests. The screen is
          disabled to prevent misleading balances or unverified outcomes.
          No coins, cryptocurrency or practice chips have been charged.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/Games" className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950">Back to games</Link>
          <Link to="/PlayDice" className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white">Try verified practice Dice</Link>
        </div>
      </div>
    </main>
  );
}
