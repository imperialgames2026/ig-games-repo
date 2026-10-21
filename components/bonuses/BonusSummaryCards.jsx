import React from 'react';
import { Gift, CalendarDays, Trophy, LockKeyhole } from 'lucide-react';

function SummaryCard({ icon: Icon, title, value, helper, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-xl font-black text-white">{value}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">{helper}</p>
    </div>
  );
}

export default function BonusSummaryCards({ wallet }) {
  const lockedCurrent = wallet?.locked_bonus_funds_current ?? 0;
  const lockedTotal = wallet?.locked_bonus_funds_total ?? 0;
  const monthlyBonus = wallet?.monthly_bonus_amount || 0;
  const weeklyBonus = wallet?.weekly_bonus_amount || 0;
  const dailyBonus = wallet?.daily_bonus_amount || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SummaryCard icon={LockKeyhole} title="Locked Deposit Bonus" value={`${lockedCurrent.toLocaleString()}/${lockedTotal.toLocaleString()} ID`} helper="Freed up through eligible wagering and rakeback release." accent="from-pink-500 to-rose-600" />
      <SummaryCard icon={CalendarDays} title="Daily Bonus" value={`${dailyBonus.toLocaleString()} ID`} helper="Your currently available daily reward amount." accent="from-emerald-500 to-green-600" />
      <SummaryCard icon={Gift} title="Weekly Bonus" value={`${weeklyBonus.toLocaleString()} ID`} helper="Your currently available weekly reward amount." accent="from-violet-500 to-purple-600" />
      <SummaryCard icon={Trophy} title="Monthly Bonus" value={`${monthlyBonus.toLocaleString()} ID`} helper="Your currently available monthly reward amount." accent="from-amber-500 to-orange-600" />
    </div>
  );
}
