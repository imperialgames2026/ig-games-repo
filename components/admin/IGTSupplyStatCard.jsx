import React from 'react';

export default function IGTSupplyStatCard({ label, value, helper, accent = 'pink' }) {
  const accentStyles = {
    pink: 'from-pink-500/25 to-pink-500/5 border-pink-400/25 text-pink-200',
    amber: 'from-amber-500/25 to-amber-500/5 border-amber-400/25 text-amber-200',
    violet: 'from-violet-500/25 to-violet-500/5 border-violet-400/25 text-violet-200',
    emerald: 'from-emerald-500/25 to-emerald-500/5 border-emerald-400/25 text-emerald-200',
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/20 ${accentStyles[accent]}`}>
      <p className="text-sm font-medium text-white/60">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-white tabular-nums md:text-3xl">{value}</p>
      {helper && <p className="mt-2 text-sm leading-relaxed text-white/55">{helper}</p>}
    </div>
  );
}