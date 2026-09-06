import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import PhoenixFireSlot from '@/components/slots/PhoenixFireSlot';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayPhoenixFire() {
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

    const actualBetAmount = currency === 'IC' ? betAmount : 0;
    const actualWinAmount = currency === 'IC' ? winAmount : 0;
    const netChange = actualWinAmount - actualBetAmount;
    const newTokens = wallet.tokens + netChange;

    const experienceGained = currency === 'ID' ? Math.floor(betAmount) : 0;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        tokens: newTokens,
        total_won: wallet.total_won + (actualWinAmount > 0 ? actualWinAmount : 0),
        total_lost: wallet.total_lost + (actualWinAmount === 0 ? actualBetAmount : 0),
        experience_points: (wallet.experience_points || 0) + experienceGained,
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: actualWinAmount > 0 ? 'win' : 'loss',
      amount: netChange,
      game_slug: gameSlug,
      description: actualWinAmount > 0 ? `Won ${actualWinAmount} tokens` : `Lost ${actualBetAmount} tokens`,
      balance_after: newTokens,
    });

    if (experienceGained > 0) {
      await base44.functions.invoke('updateVIPLevel', {
        user_email: user.email,
        experience_points: (wallet.experience_points || 0) + experienceGained
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
            <PhoenixFireSlot wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>
    </div>
  );
}