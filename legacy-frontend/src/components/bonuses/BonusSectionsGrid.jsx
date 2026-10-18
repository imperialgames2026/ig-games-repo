import React from 'react';
import DailyQuests from '@/components/casino/DailyQuests';
import WeeklyQuests from '@/components/casino/WeeklyQuests';
import WagerProgressBar from '@/components/casino/WagerProgressBar';
import LuckySpinWheel from '@/components/casino/LuckySpinWheel';
import LockedBonusBreakdown from '@/components/bonuses/LockedBonusBreakdown';
import WagerWheelLinkCard from '@/components/bonuses/WagerWheelLinkCard';

export default function BonusSectionsGrid({ user, wallet }) {
  return (
    <div className="space-y-6">
      <LockedBonusBreakdown wallet={wallet} />
      {user?.email && <WagerProgressBar userEmail={user.email} />}
      <WagerWheelLinkCard />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DailyQuests user={user} wallet={wallet} />
        <WeeklyQuests user={user} wallet={wallet} />
      </div>
      <LuckySpinWheel wallet={wallet} userVIPLevel={wallet?.vip_level || 1} />
    </div>
  );
}