import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins } from 'lucide-react';
import LuckyFortuneSlot from '@/components/slots/LuckyFortuneSlot';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayLuckyFortune() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
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
      const currentBalance = wallet[balanceKey] || 0;
      const newBalance = currentBalance - betAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [balanceKey]: newBalance,
          total_lost: (wallet.total_lost || 0) + betAmount,
        },
      });
    }

    if (winAmount > 0) {
      const currentBalance = wallet[balanceKey] || 0;
      const newBalance = currentBalance + winAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [balanceKey]: newBalance,
          total_won: (wallet.total_won || 0) + winAmount,
        },
      });
      createTransactionMutation.mutate({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        game_slug: gameSlug,
        description: `Won ${winAmount} tokens on ${gameSlug}`,
        balance_after: newBalance,
      });
    }
  };

  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

  return (
    <div className="min-h-screen bg-[#0A0612]" style={{ zoom: '0.85' }}>
      <div className="bg-gradient-to-b from-[#1A1528] to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link 
              to={createPageUrl('Games')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Games</span>
            </Link>
            
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <LuckyFortuneSlot wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>
    </div>
  );
}