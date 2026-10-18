import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import WheelGame from '@/components/games/WheelGame';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayWheel() {
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

  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

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

  const handleBet = (amt) => {
    if (!wallet) return;
    if (currency === 'IC') {
      updateWalletMutation.mutate({ id: wallet.id, data: { tokens: wallet.tokens - amt, total_wagered: (wallet.total_wagered || 0) + amt } });
    } else {
      updateWalletMutation.mutate({ id: wallet.id, data: { cat_dollars: wallet.cat_dollars - amt } });
    }
  };

  const handleWin = (payout, betAmt) => {
    if (!wallet) return;
    if (currency === 'IC') {
      updateWalletMutation.mutate({ id: wallet.id, data: { tokens: wallet.tokens + payout, total_won: (wallet.total_won || 0) + payout } });
    } else {
      updateWalletMutation.mutate({ id: wallet.id, data: { cat_dollars: wallet.cat_dollars + payout } });
    }
  };

  const handleLoss = (amt) => {
    if (!wallet) return;
    if (currency === 'IC') {
      updateWalletMutation.mutate({ id: wallet.id, data: { total_lost: (wallet.total_lost || 0) + amt } });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0612] py-8" style={{ zoom: '0.85' }}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Home')}>
              <button className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white">Spin Wheel</h1>
              <p className="text-gray-400">Wager 8,000 to earn a spin!</p>
            </div>
          </div>
          <div className="hidden md:block">
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>

        <WheelGame
          wallet={wallet}
          currency={currency}
          onBet={handleBet}
          onWin={handleWin}
          onLoss={handleLoss}
          onFreeSpinUsed={() => {
            if (!wallet) return;
            updateWalletMutation.mutate({
              id: wallet.id,
              data: { free_spins: Math.max(0, (wallet.free_spins || 0) - 1) }
            });
          }}
        />
      </div>
    </div>
  );
}