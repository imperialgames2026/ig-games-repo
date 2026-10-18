import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins } from 'lucide-react';
import CrapsGame from '@/components/games/CrapsGame';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayCraps() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

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

    const netChange = winAmount - betAmount;
    const newTokens = wallet.tokens + netChange;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        tokens: newTokens,
        total_won: wallet.total_won + (winAmount > 0 ? winAmount : 0),
        total_lost: wallet.total_lost + (winAmount === 0 ? betAmount : 0),
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: winAmount > 0 ? 'win' : 'loss',
      amount: netChange,
      game_slug: gameSlug,
      description: winAmount > 0 ? `Won ${winAmount} tokens` : `Lost ${betAmount} tokens`,
      balance_after: newTokens,
    });

    // Track wagering analytics
    base44.analytics.track({
      eventName: winAmount > 0 ? 'game_win' : 'game_loss',
      properties: {
        game: gameSlug,
        bet_amount: betAmount,
        win_amount: winAmount,
        currency: 'IC',
      },
    });
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
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-pink-600/10 border border-pink-500/30">
              <Coins className="w-5 h-5 text-pink-400" />
              <span className="text-lg font-bold text-white">{(wallet?.tokens || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-white mb-2">Craps</h1>
              <p className="text-gray-400">Roll the dice and test your luck!</p>
            </div>
            <CrapsGame wallet={wallet} onBet={handleBet} />
          </div>
          
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} />
          </div>
        </div>
      </div>
    </div>
  );
}