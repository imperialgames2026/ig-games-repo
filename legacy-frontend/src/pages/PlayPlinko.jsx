import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlinkoGame from '@/components/games/PlinkoGame';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayPlinko() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState('IC');

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
    
    if (currency === 'IC') {
      const newBalance = wallet.tokens + netChange;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          tokens: newBalance,
          total_won: wallet.total_won + (winAmount > betAmount ? winAmount - betAmount : 0),
          total_lost: wallet.total_lost + (winAmount < betAmount ? betAmount - winAmount : 0),
        },
      });
    } else {
      const newBalance = (wallet.cat_dollars || 0) + netChange;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          cat_dollars: newBalance,
        },
      });
    }

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: winAmount > betAmount ? 'win' : 'loss',
      amount: netChange,
      game_slug: gameSlug,
      description: winAmount > betAmount ? `Won ${winAmount} ${currency} in ${gameSlug}` : `Lost ${betAmount} ${currency} in ${gameSlug}`,
      balance_after: currency === 'IC' ? wallet.tokens + netChange : (wallet.cat_dollars || 0) + netChange,
    });

    // Track wagering analytics
    base44.analytics.track({
      eventName: winAmount > betAmount ? 'game_win' : 'game_loss',
      properties: {
        game: gameSlug,
        bet_amount: betAmount,
        win_amount: winAmount,
        currency: currency,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="bg-[#0A0612]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Games')}>
            <Button variant="ghost" className="text-white">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-[#1A1528] rounded-lg p-1">
              <button
                onClick={() => setCurrency('IC')}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                  currency === 'IC' ? 'bg-pink-500 text-white' : 'text-gray-400'
                }`}
              >
                IC
              </button>
              <button
                onClick={() => setCurrency('ID')}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                  currency === 'ID' ? 'bg-green-500 text-white' : 'text-gray-400'
                }`}
              >
                ID
              </button>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
              currency === 'IC' 
                ? 'bg-gradient-to-r from-pink-500/20 to-pink-600/10 border-pink-500/30' 
                : 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30'
            }`}>
              <Coins className={`w-5 h-5 ${currency === 'IC' ? 'text-pink-400' : 'text-green-400'}`} />
              <span className="text-lg font-bold text-white">
                {currency === 'IC' 
                  ? (wallet?.tokens || 0).toLocaleString() 
                  : (wallet?.cat_dollars || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="text-center mb-6">
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                PLINKO
              </h1>
              <p className="text-gray-400">
                Drop the ball and watch it bounce! Pick your risk level and row count.
              </p>
            </div>
            <PlinkoGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} />
          </div>
        </div>
      </div>
    </div>
  );
}