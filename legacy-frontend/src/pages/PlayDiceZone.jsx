import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DiceZoneGame from '@/components/games/DiceZoneGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { toast } from 'sonner';

export default function PlayDiceZone() {
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
    const currentBalance = isIC ? wallet.tokens : wallet.cat_dollars;
    const netChange = winAmount - betAmount;
    const newBalance = currentBalance + netChange;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        [isIC ? 'tokens' : 'cat_dollars']: newBalance,
        total_won: wallet.total_won + (netChange > 0 ? netChange : 0),
        total_lost: wallet.total_lost + (netChange < 0 ? Math.abs(netChange) : 0),
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: netChange > 0 ? 'win' : 'loss',
      amount: netChange,
      game_slug: gameSlug,
      description: `${netChange > 0 ? 'Won' : 'Lost'} ${Math.abs(netChange).toFixed(2)} ${currency}`,
      balance_after: newBalance,
    });

    if (netChange > 0) {
      toast.success(`Won ${winAmount.toFixed(2)} ${currency}! 🎯`);
    }
  };

  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

  return (
    <div className="min-h-screen bg-[#0A0612]" style={{ zoom: '0.85' }}>
      <div className="sticky top-0 z-50 bg-[#0A0612]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl('Games')}>
              <Button variant="ghost" className="text-white">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Games
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">🎯 Dice Zone</h1>
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DiceZoneGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>
    </div>
  );
}