import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Zap } from 'lucide-react';
import ImperialLightningGame from '@/components/games/ImperialLightningGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { createPageUrl } from '@/utils';

export default function PlayImperialLightning() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });
  const wallet = wallets[0];

  const updateWallet = useMutation({
    mutationFn: (data) => base44.entities.UserWallet.update(wallet.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet', user?.email] }),
  });

  const createTransaction = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet) return;
    const isIC = currency === 'IC';
    const balanceKey = isIC ? 'tokens' : 'cat_dollars';
    const currentBalance = wallet[balanceKey] || 0;

    if (betAmount > 0) {
      const newBalance = currentBalance - betAmount;
      const xpGain = Math.floor(betAmount);
      await updateWallet.mutateAsync({
        [balanceKey]: Math.max(0, newBalance),
        total_wagered: (wallet.total_wagered || 0) + betAmount,
        total_lost: (wallet.total_lost || 0) + betAmount,
        experience_points: (wallet.experience_points || 0) + xpGain,
      });
    }
    if (winAmount > 0) {
      const currentBal = (queryClient.getQueryData(['wallet', user?.email])?.[0] || wallet)[balanceKey] || 0;
      await updateWallet.mutateAsync({
        [balanceKey]: currentBal + winAmount,
        total_won: (wallet.total_won || 0) + winAmount,
        total_lost: Math.max(0, (wallet.total_lost || 0) - winAmount),
      });
      await createTransaction.mutateAsync({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        game_slug: gameSlug,
        description: `Imperial Rapid Lightning win`,
        balance_after: (wallet[balanceKey] || 0) + winAmount,
      });
    }
  };

  const handleCurrencyChange = () => {
    const next = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(next);
    localStorage.setItem('preferredCurrency', next);
  };

  return (
    <div className="min-h-screen bg-[#06020f]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-purple-900/30">
        <Link to={createPageUrl('Games')} className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:block">Games</span>
        </Link>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-300" />
          <span className="text-white font-black text-sm tracking-widest">IMPERIAL RAPID LIGHTNING</span>
        </div>
        <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} user={user} onBet={() => {}} />
      </div>

      {/* Game */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <ImperialLightningGame wallet={wallet} onBet={handleBet} currency={currency} />
      </div>
    </div>
  );
}