import React from 'react';

export default function IGTSupplyBar({ lockedPercent, stakedPercent, liquidPercent }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">IGT Supply Composition</h2>
          <p className="mt-1 text-sm text-white/55">Locked supply, active player staking, and remaining circulating capacity.</p>
        </div>
        <p className="text-sm font-semibold text-pink-200">12,000,000,000 Total IGT</p>
      </div>

      <div className="h-8 overflow-hidden rounded-full border border-white/10 bg-white/10" aria-label="IGT supply composition bar">
        <div className="flex h-full w-full">
          <div className="bg-gradient-to-r from-pink-500 to-pink-400" style={{ width: `${lockedPercent}%` }} title="Locked IGT" />
          <div className="bg-gradient-to-r from-violet-500 to-purple-400" style={{ width: `${stakedPercent}%` }} title="Staked IGT" />
          <div className="bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${liquidPercent}%` }} title="Remaining IGT" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Legend color="bg-pink-400" label="Locked" value={`${lockedPercent.toFixed(2)}%`} />
        <Legend color="bg-violet-400" label="Active Staked" value={`${stakedPercent.toFixed(4)}%`} />
        <Legend color="bg-emerald-400" label="Remaining" value={`${liquidPercent.toFixed(2)}%`} />
      </div>
    </section>
  );
}

function Legend({ color, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}