import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DartsGame from '@/components/games/DartsGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { toast } from 'sonner';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlayDarts() {
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
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet) return;

    const isIC = currency === 'IC';
    const balanceField = isIC ? 'tokens' : 'cat_dollars';
    const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);

    if (betAmount > 0) {
      await trackDailyWager(user.email, betAmount);
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [balanceField]: currentBalance - betAmount,
          total_lost: (wallet.total_lost || 0) + betAmount,
          total_wagered: (wallet.total_wagered || 0) + betAmount,
        },
      });
    }

    if (winAmount > 0) {
      const newBalance = currentBalance - betAmount + winAmount;
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [balanceField]: newBalance,
          total_won: (wallet.total_won || 0) + winAmount,
        },
      });
      createTransactionMutation.mutate({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        game_slug: gameSlug,
        description: `Won ${winAmount.toFixed(2)} ${currency} on Darts`,
        balance_after: newBalance,
      });
      toast.success(`Won ${winAmount.toFixed(2)} ${currency}!`);
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
            <h1 className="text-2xl font-bold text-white">🎯 Darts</h1>
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DartsGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg font-bold">Darts</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals', '# Instant', '# Random Multipliers'].map(tag => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-sm">Mode</p><p className="text-pink-400 font-bold text-lg">Weighted Random</p></div>
                <div><p className="text-gray-400 text-sm">Difficulty</p><p className="text-pink-400 font-bold text-lg">Easy to Expert</p></div>
                <div><p className="text-gray-400 text-sm">Hit Pattern</p><p className="text-pink-400 font-bold text-lg">Lower hits more</p></div>
                <div><p className="text-gray-400 text-sm">Top Win</p><p className="text-pink-400 font-bold text-lg">500x</p></div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Choose your bet amount and difficulty, then throw. The result is completely random, with the smaller multiplier zones landing much more often and the bigger multiplier zones landing less often.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}