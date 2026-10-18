import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import BonusHero from '@/components/bonuses/BonusHero';
import BonusSummaryCards from '@/components/bonuses/BonusSummaryCards';
import BonusSectionsGrid from '@/components/bonuses/BonusSectionsGrid';

export default function Bonuses() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-bonuses', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];

  return (
    <div className="min-h-screen bg-[#0A0612]">
      <BonusHero />
      <div className="max-w-7xl mx-auto px-4 pb-16 space-y-6">
        <BonusSummaryCards wallet={wallet} />
        <BonusSectionsGrid user={user} wallet={wallet} />
      </div>
    </div>
  );
}