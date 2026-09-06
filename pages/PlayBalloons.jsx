import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import WalletDisplay from '@/components/casino/WalletDisplay';
import BalloonsGame from '@/components/games/BalloonsGame';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlayBalloons() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserWallet.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet || !user) return;
    const isIC = currency === 'IC';
    const currentBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);

    if (betAmount > 0) {
      await trackDailyWager(user.email, betAmount);
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: currentBalance - betAmount,
          total_lost: (wallet.total_lost || 0) + betAmount,
          total_wagered: (wallet.total_wagered || 0) + betAmount,
        },
      });
    }

    if (winAmount > 0) {
      const refreshedBalance = isIC ? (wallet.tokens || 0) : (wallet.cat_dollars || 0);
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          [isIC ? 'tokens' : 'cat_dollars']: refreshedBalance + winAmount,
          total_won: (wallet.total_won || 0) + winAmount,
        },
      });
      createTransactionMutation.mutate({
        user_email: user.email,
        type: 'win',
        amount: winAmount,
        game_slug: gameSlug,
        description: `Won ${winAmount.toFixed(2)} ${currency} on Balloons`,
        balance_after: refreshedBalance + winAmount,
      });
    }
  };

  const handleCurrencyChange = () => {
    const next = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(next);
    localStorage.setItem('preferredCurrency', next);
  };

  return (
    <div className="min-h-screen bg-[#0A0612]">
      <div className="max-w-xl mx-auto px-3 pt-3 pb-6">
        <div className="mb-3">
          <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
        </div>

        <BalloonsGame wallet={wallet} onBet={handleBet} currency={currency} />
      </div>

      <div className="max-w-xl mx-auto px-3 pb-8">
        <div className="bg-[#1c1632] rounded-2xl overflow-hidden border border-white/10">
          <button onClick={() => setInfoOpen(!infoOpen)} className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors">
            <span className="text-lg font-bold">Balloons</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {infoOpen && (
            <div className="px-6 pb-6 pt-4 border-t border-white/10 space-y-5">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Balloons', '# Pump Game', '# Imperial Originals'].map((tag) => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-sm">House Edge</p><p className="text-pink-400 font-bold text-lg">2.00%</p></div>
                <div><p className="text-gray-400 text-sm">RTP</p><p className="text-pink-400 font-bold text-lg">98%</p></div>
                <div><p className="text-gray-400 text-sm">Modes</p><p className="text-pink-400 font-bold text-lg">Manual / Auto</p></div>
                <div><p className="text-gray-400 text-sm">Flow</p><p className="text-pink-400 font-bold text-lg">Play • Pump • Cashout</p></div>
              </div>
              <ol className="text-gray-400 text-sm leading-relaxed list-decimal list-inside space-y-1">
                <li>Each difficulty has its own multiplier ladder like in your screenshots.</li>
                <li>Easy climbs slowly, while Expert jumps hard and pops fast.</li>
                <li>The center tile is the active multiplier during the round.</li>
                <li>If the balloon pops, the popped multiplier is shown in red before the round resets.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}