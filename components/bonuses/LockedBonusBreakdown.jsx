import React from 'react';
import { LockKeyhole, TrendingUp } from 'lucide-react';

export default function LockedBonusBreakdown({ wallet }) {
  const current = wallet?.locked_bonus_funds_current ?? 0;
  const total = wallet?.locked_bonus_funds_total ?? 0;
  const released = Math.max(total - current, 0);
  const percent = total > 0 ? Math.min(100, (released / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <LockKeyhole className="w-5 h-5 text-pink-400" />
            <h3 className="text-lg font-bold text-white">Locked Deposit Bonus Funds</h3>
          </div>
          <p className="text-sm text-gray-400">Rakeback should release this locked value instead of creating extra bonus money.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white">{current.toLocaleString()}/{total.toLocaleString()} ID</p>
          <p className="text-xs text-gray-500">Remaining locked</p>
        </div>
      </div>

      <div className="h-3 rounded-full bg-black/30 overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500" style={{ width: `${percent}%` }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-gray-500 mb-1">Released</p>
          <p className="text-lg font-bold text-green-400">{released.toLocaleString()} ID</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-gray-500 mb-1">Still locked</p>
          <p className="text-lg font-bold text-pink-400">{current.toLocaleString()} ID</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-gray-500">Progress</p>
          </div>
          <p className="text-lg font-bold text-white">{percent.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
