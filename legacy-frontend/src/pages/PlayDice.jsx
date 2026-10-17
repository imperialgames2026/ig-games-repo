import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Coins, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DiceGame from '@/components/games/DiceGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { toast } from 'sonner';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlayDice() {
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
      await queryClient.cancelQueries(['wallet', user?.email]);
      const previousWallets = queryClient.getQueryData(['wallet', user?.email]);
      
      queryClient.setQueryData(['wallet', user?.email], (old) => 
        old ? old.map(w => w.id === id ? { ...w, ...data } : w) : []
      );
      
      return { previousWallets };
    },
    onError: (err, variables, context) => {
      if (context?.previousWallets) {
        queryClient.setQueryData(['wallet', user?.email], context.previousWallets);
      }
    },
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onMutate: async (newTransaction) => {
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
    const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);

    if (betAmount > 0) {
      // Deduct bet immediately
      await trackDailyWager(user.email, betAmount);
      const newBalance = currentBalance - betAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: newBalance,
          total_lost: (wallet.total_lost || 0) + betAmount,
          experience_points: (wallet.experience_points || 0) + xpGained,
        },
      });
      base44.analytics.track({ eventName: 'game_bet', properties: { game: gameSlug, bet_amount: betAmount, currency } });
    }

    if (winAmount > 0) {
      // Credit winnings
      const latestBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      const newBalance = latestBalance + winAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: newBalance,
          total_won: (wallet.total_won || 0) + winAmount,
          experience_points: (wallet.experience_points || 0) + xpGained,
        },
      });
      createTransactionMutation.mutate({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        game_slug: gameSlug,
        description: `Won ${winAmount.toFixed(2)} ${currency} on ${gameSlug}`,
        balance_after: newBalance,
      });
      base44.analytics.track({ eventName: 'game_win', properties: { game: gameSlug, win_amount: winAmount, currency } });
      toast.success(`Won ${winAmount.toFixed(2)} ${currency}! 🎉`);
    }
  };

  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

  return (
    <div className="min-h-screen bg-[#0A0612]" style={{ zoom: '0.85' }}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0612]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl('Games')}>
              <Button variant="ghost" className="text-white">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Games
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🎲 Dice
            </h1>
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DiceGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
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
            <span className="text-lg font-bold">Hash Dice</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals', '# Dice', '# Provably fair'].map(tag => (
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
                  <p className="text-pink-400 font-bold text-lg">98,000x</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Stakes Range</p>
                  <p className="text-pink-400 font-bold text-lg">Any amount</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Hash Dice takes classic casino games and adds a blockchain twist. It captures the traditional charm and incorporates high-speed dynamics that complete each round in moments, blending anticipation with quick wins. It is designed for solo play and offers an immersive gaming experience that embodies the spirit of an exciting casino adventure. Track your strategies with insightful stories from previous rounds, and heighten the excitement with the suspense mechanic of predicting whether the roll will fall within the set range, adding new layers to your game.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}