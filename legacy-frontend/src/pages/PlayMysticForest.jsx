import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import MysticForestSlot from '@/components/slots/MysticForestSlot';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { useWeeklyWagerTracker } from '@/hooks/useWeeklyWagerTracker';

export default function PlayMysticForest() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const trackWager = useWeeklyWagerTracker(user);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserWallet.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet) return;
    const isIC = currency === 'IC';
    const balanceKey = isIC ? 'tokens' : 'cat_dollars';
    if (betAmount > 0) {
      const newBalance = (wallet[balanceKey] || 0) - betAmount;
      await updateWalletMutation.mutateAsync({ id: wallet.id, data: { [balanceKey]: newBalance, total_wagered: (wallet.total_wagered || 0) + betAmount, total_lost: (wallet.total_lost || 0) + betAmount } });
      trackWager(betAmount, currency);
    }
    if (winAmount > 0) {
      const newBalance = (wallet[balanceKey] || 0) + winAmount;
      await updateWalletMutation.mutateAsync({ id: wallet.id, data: { [balanceKey]: newBalance, total_won: (wallet.total_won || 0) + winAmount } });
      createTransactionMutation.mutate({ user_email: user.email, type: 'win', amount: winAmount, game_slug: gameSlug, description: `Won ${winAmount} on ${gameSlug}`, balance_after: newBalance });
    }
  };

  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

  return (
    <div className="min-h-screen bg-[#0A0612]">
      <div className="bg-gradient-to-b from-[#1A1528] to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to={createPageUrl('Games')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Games</span>
          </Link>
          <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <MysticForestSlot wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>
    </div>
  );
}