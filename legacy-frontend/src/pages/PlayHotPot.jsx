import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';
import WalletDisplay from '@/components/casino/WalletDisplay';
import HotPotSlot from '@/components/slots/HotPotSlot';

export default function PlayHotPot() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-hotpot', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const wallet = wallets[0];

  const walletMutation = useMutation({
    mutationFn: (data) => base44.entities.UserWallet.update(wallet?.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet-hotpot', user?.email] }),
  });

  const transactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount, game, xp) => {
    if (!wallet) return;
    const isIC = currency === 'IC';
    const balanceKey = isIC ? 'tokens' : 'cat_dollars';

    if (betAmount > 0) {
      const currentBalance = wallet[balanceKey] || 0;
      const newBalance = Math.max(0, currentBalance - betAmount);
      await walletMutation.mutateAsync({
        [balanceKey]: newBalance,
        total_lost: (wallet.total_lost || 0) + betAmount,
        experience_points: (wallet.experience_points || 0) + (xp || 0),
      });
    }

    if (winAmount > 0) {
      const currentBalance = wallet[balanceKey] || 0;
      const newBalance = currentBalance + winAmount;
      await walletMutation.mutateAsync({
        [balanceKey]: newBalance,
        total_won: (wallet.total_won || 0) + winAmount,
        experience_points: (wallet.experience_points || 0) + (xp || 0),
      });
      transactionMutation.mutate({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        currency,
        game_slug: 'hotpot',
        description: 'Hot Pot - Win',
      });
    }
  };

  const handleCurrencyChange = () => {
    const next = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(next);
    localStorage.setItem('preferredCurrency', next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 to-black touch-manipulation">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40">
        <Link to={createPageUrl('Games')} className="text-white flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>
        <span className="text-amber-400 font-black text-lg">🍲 HOT POT SLOTS</span>
        <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
      </div>

      <div className="p-2 max-w-lg mx-auto">
        <HotPotSlot
          wallet={wallet}
          onBet={handleBet}
          currency={currency}
          user={user}
        />
      </div>
    </div>
  );
}