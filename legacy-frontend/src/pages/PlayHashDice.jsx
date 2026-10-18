import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HashDiceGame from '@/components/games/HashDiceGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { toast } from 'sonner';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlayHashDice() {
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
  });

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet) return;

    const isIC = currency === 'IC';

    if (betAmount > 0) {
      await trackDailyWager(user.email, betAmount);
      const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      const newBalance = currentBalance - betAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: { [isIC ? 'tokens' : 'cat_dollars']: newBalance, total_lost: (wallet.total_lost || 0) + betAmount },
      });
    }

    if (winAmount > 0) {
      const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      const newBalance = currentBalance + winAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: { [isIC ? 'tokens' : 'cat_dollars']: newBalance, total_won: (wallet.total_won || 0) + winAmount },
      });
      createTransactionMutation.mutate({
        user_email: user.email, type: 'win', amount: winAmount, game_slug: gameSlug,
        description: `Won ${winAmount.toFixed(2)} ${currency} on Hash Dice`, balance_after: newBalance,
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
            <h1 className="text-2xl font-bold text-white">🎰 Hash Dice</h1>
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <HashDiceGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      {/* Game Info */}
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
                  {['# Imperial Originals', '# Dice', '# Provably Fair'].map(tag => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-sm">House Edge</p><p className="text-pink-400 font-bold text-lg">2.00%</p></div>
                <div><p className="text-gray-400 text-sm">RTP</p><p className="text-pink-400 font-bold text-lg">98%</p></div>
                <div><p className="text-gray-400 text-sm">Max Win</p><p className="text-pink-400 font-bold text-lg">98,000x</p></div>
                <div><p className="text-gray-400 text-sm">Chance</p><p className="text-pink-400 font-bold text-lg">50%</p></div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Hash Dice takes classic casino games and adds a blockchain twist. Predict whether the 5-digit roll will be Low (&lt;50000) or High (&gt;49999). Each round is provably fair — verify any result using the seed displayed after your spin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}