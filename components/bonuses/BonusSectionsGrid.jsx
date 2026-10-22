import React from 'react';
import DailyQuests from '@/components/casino/DailyQuests';
import WeeklyQuests from '@/components/casino/WeeklyQuests';
import LuckySpinWheel from '@/components/casino/LuckySpinWheel';
import WagerWheelLinkCard from '@/components/bonuses/WagerWheelLinkCard';
import ProgramUnavailable from '@/components/casino/ProgramUnavailable';

export default function BonusSectionsGrid() {
  return (
    <div className="space-y-6">
      <WagerWheelLinkCard />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DailyQuests />
        <WeeklyQuests />
      </div>
      <ProgramUnavailable title="Other bonus programs">Daily, weekly and monthly bonuses, deposit bonuses and wager-based spins are not active. This page does not offer claims for those programs.</ProgramUnavailable>
      <LuckySpinWheel />
    </div>
  );
}
