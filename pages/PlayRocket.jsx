import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Coins, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RocketGame from '@/components/games/RocketGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlayRocket() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const [infoOpen, setInfoOpen] = useState(false);

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
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['wallet', user?.email]);
      
      // Snapshot previous value
      const previousWallets = queryClient.getQueryData(['wallet', user?.email]);
      
      // Optimistically update
      queryClient.setQueryData(['wallet', user?.email], (old) => 
        old ? old.map(w => w.id === id ? { ...w, ...data } : w) : []
      );
      
      return { previousWallets };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousWallets) {
        queryClient.setQueryData(['wallet', user?.email], context.previousWallets);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wallet']);
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onMutate: async (newTransaction) => {
      // Optimistically add transaction to history
      await queryClient.cancelQueries(['transactions', user?.email]);
      const previousTransactions = queryClient.getQueryData(['transactions', user?.email]);
      
      queryClient.setQueryData(['transactions', user?.email], (old) => 
        old ? [newTransaction, ...old] : [newTransaction]
      );
      
      return { previousTransactions };
    },
    onError: (err, variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(['transactions', user?.email], context.previousTransactions);
      }
    },
  });

  const handleBet = async (betAmount, winAmount, gameSlug, xpGained = 0) => {
    if (!wallet) return;

    const isIC = currency === 'IC';

    if (betAmount > 0) {
      await trackDailyWager(user.email, betAmount);
      const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      const newBalance = currentBalance - betAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: newBalance,
          total_lost: (wallet.total_lost || 0) + betAmount,
          experience_points: (wallet.experience_points || 0) + xpGained,
        },
      });
    }

    if (winAmount > 0) {
      const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      const newBalance = currentBalance + winAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: newBalance,
          total_won: (wallet.total_won || 0) + winAmount,
          experience_points: (wallet.experience_points || 0) + xpGained,
        },
      });
      createTransactionMutation.mutate({
        user_email: user.email, type: 'win', amount: winAmount, game_slug: gameSlug,
        description: `Cashed out ${winAmount.toFixed(2)} ${currency} in ${gameSlug}`, balance_after: newBalance,
      });
      base44.analytics.track({ eventName: 'game_win', properties: { game: gameSlug, win_amount: winAmount, currency } });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0612]" style={{ zoom: '0.85' }}>
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
            <button
              onClick={() => {
                const newCurrency = currency === 'IC' ? 'ID' : 'IC';
                setCurrency(newCurrency);
                localStorage.setItem('preferredCurrency', newCurrency);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                currency === 'IC' 
                  ? 'bg-gradient-to-r from-pink-500/20 to-pink-600/10 border-pink-500/30' 
                  : 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30'
              }`}
            >
              <Coins className={`w-5 h-5 ${currency === 'IC' ? 'text-pink-400' : 'text-green-400'}`} />
              <span className="text-lg font-bold text-white">
                {currency === 'IC' 
                  ? (wallet?.tokens || 0).toLocaleString() 
                  : (wallet?.cat_dollars || 0).toLocaleString()}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <RocketGame wallet={wallet} onBet={handleBet} currency={currency} user={user} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} />
          </div>
        </div>
      </div>
      {/* Game Info Dropdown */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg font-bold">Limbo</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals', '# Crash games', '# Provably fair'].map(tag => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">House Edge</p>
                  <p className="text-pink-400 font-bold text-lg">2.00%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">RTP (Return to Player)</p>
                  <p className="text-pink-400 font-bold text-lg">98%</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Max Win</p>
                  <p className="text-pink-400 font-bold text-lg">1,000,000x</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Stakes Range</p>
                  <p className="text-pink-400 font-bold text-lg">Any amount</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Ride the rocket of fortune as it climbs ever higher—will it reach the stars or explode in a shower of rewards? The answer lies in the unpredictability of the game, where choosing a number lower than the volatile rocket's peak could lead to treasures beyond belief. With features like turbo betting, hotkeys, and an auto-play mode, this game offers an experience tailored to you. Limbo welcomes you into a universe of chance, where every launch could lead to a fortune or a thrilling crash. Take a leap of faith with Limbo, a game of risk, reward, and pulse-pounding entertainment!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}