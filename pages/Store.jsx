import React from 'react';
import { Link } from 'react-router-dom';
import BonusActivator from '@/components/casino/BonusActivator';
import ProgramUnavailable from '@/components/casino/ProgramUnavailable';

export default function Store() {
  return (
    <div className="min-h-screen bg-[#0A0612] px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-4xl font-black text-white">Imperial Gaming Store</h1>
          <p className="mt-4 text-lg text-slate-300">The current site offers practice games. Purchases are not open.</p>
        </header>
        <ProgramUnavailable title="Token purchases">
          Checkout and paid token packs are unavailable. No payment is collected here. Prices, purchase terms and any promotional offers will be published when purchases open.
        </ProgramUnavailable>
        <BonusActivator />
        <div className="flex flex-wrap gap-4">
          <Link className="rounded-lg bg-pink-600 px-5 py-3 font-bold text-white" to="/Games">Browse practice games</Link>
          <Link className="rounded-lg border border-white/20 px-5 py-3 text-white" to="/VIP">View VIP levels and saved spins</Link>
          <Link className="rounded-lg border border-white/20 px-5 py-3 text-white" to="/Support">Contact support</Link>
        </div>
      </div>
    </div>
  );
}
