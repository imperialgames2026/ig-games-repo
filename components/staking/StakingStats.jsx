import React from 'react';

export default function StakingStats({ stats, pool, wallet }) {
  const cards = [
    { label: 'Available IGT', value: (wallet?.igt_tokens || 0).toFixed(2) },
    { label: 'Your Active Stake', value: (stats?.userActiveStake || 0).toFixed(2) },
    { label: 'Pool Size', value: (pool?.total_staked_igt || 0).toFixed(2) },
    { label: 'Next Hour Estimate', value: (stats?.estimatedNextHourlyReward || 0).toFixed(4) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <p className="text-sm text-gray-400">{card.label}</p>
          <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
}