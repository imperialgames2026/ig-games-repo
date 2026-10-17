import React from 'react';
import { Lock, ShieldCheck, Coins, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';

const formatTokens = (value = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export default function TokenTransparency({ tokenConfig }) {
  const maxSupply = tokenConfig?.max_supply || 12000000000;
  const lockedSupply = tokenConfig?.locked_supply || 6000000000;
  const circulatingCap = Math.max(maxSupply - lockedSupply, 0);
  const lockedPercent = maxSupply ? (lockedSupply / maxSupply) * 100 : 0;
  const unlockDate = tokenConfig?.locked_until ? new Date(tokenConfig.locked_until) : new Date('2028-05-23T00:00:00-04:00');

  const cards = [
    { icon: Coins, label: 'Total IGT Supply Cap', value: `${formatTokens(maxSupply)} IGT`, color: 'text-pink-300' },
    { icon: Lock, label: 'Locked IGT', value: `${formatTokens(lockedSupply)} IGT`, color: 'text-amber-300' },
    { icon: ShieldCheck, label: 'Available Ecosystem Cap', value: `${formatTokens(circulatingCap)} IGT`, color: 'text-green-300' },
    { icon: CalendarClock, label: 'Earliest Unlock Date', value: format(unlockDate, 'MMM dd, yyyy'), color: 'text-purple-300' },
  ];

  return (
    <section className="rounded-3xl border border-pink-500/20 bg-white/[0.04] p-6 shadow-2xl shadow-pink-500/10 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-200">
            <ShieldCheck className="h-4 w-4" />
            IGT Transparency Ledger
          </div>
          <h2 className="mt-4 text-3xl font-black text-white">Imperial Gaming Token Ecosystem</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Total supply is capped at 12 billion IGT. 6 billion IGT are locked from circulation and cannot unlock before the two-year lock date shown below.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
          {lockedPercent.toFixed(0)}% of supply locked
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/10 bg-[#0A0612]/70 p-5">
            <card.icon className={`mb-4 h-6 w-6 ${card.color}`} />
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{card.label}</div>
            <div className="mt-2 text-xl font-black text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
        <span className="font-bold text-white">Lock reason:</span> {tokenConfig?.lock_reason || 'Long-term ecosystem protection, staking confidence, and transparent IGT economics.'}
      </div>
    </section>
  );
}