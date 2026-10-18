import React from 'react';
import { Coins, Timer, Trophy } from 'lucide-react';

export default function StakingHero() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-pink-500/20 bg-gradient-to-br from-[#1A1528] via-[#130f20] to-[#0F0A1E] p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.18),transparent_35%)]" />
      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <p className="mb-3 inline-flex rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">Imperial Staking</p>
          <h1 className="text-4xl font-black text-white sm:text-5xl">Lock IGT. Earn hourly rewards.</h1>
          <p className="mt-4 max-w-2xl text-base text-gray-400">Your share of the staking pool earns payouts every hour based on your position size and the live pool total.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
          {[{ icon: Coins, label: 'Stake IGT' }, { icon: Timer, label: 'Hourly payout' }, { icon: Trophy, label: 'Live pool share' }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <item.icon className="mb-2 h-5 w-5 text-pink-400" />
              <p className="text-sm font-semibold text-white">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}