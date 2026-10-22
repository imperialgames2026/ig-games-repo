import React from 'react';
import BonusHero from '@/components/bonuses/BonusHero';
import BonusSectionsGrid from '@/components/bonuses/BonusSectionsGrid';

export default function Bonuses() {
  return (
    <div className="min-h-screen bg-[#0A0612]">
      <BonusHero />
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <BonusSectionsGrid />
      </div>
    </div>
  );
}
