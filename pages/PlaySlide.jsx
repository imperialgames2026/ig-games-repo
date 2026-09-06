import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import WalletDisplay from '@/components/casino/WalletDisplay';
import SlideGame from '@/components/games/SlideGame';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlaySlide() {
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
        description: `Won ${winAmount.toFixed(2)} ${currency} on Slide`,
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
        <div className="flex items-center justify-between mb-3 rounded-2xl bg-[#183140] border border-[#214153] p-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden">
            <img src="https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/669cada57_692efb11e_generated_image.png" alt="Imperial Gaming" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-[110px]">
            <WalletDisplay wallet={wallet} compact currency={currency} onCurrencyChange={handleCurrencyChange} />
          </div>
          <div className="flex items-center gap-2 text-white/85">
            <div className="w-10 h-10 rounded-xl bg-[#2b7de7]" />
            <div className="w-10 h-10 rounded-xl bg-[#223a49]" />
            <div className="w-10 h-10 rounded-xl bg-[#223a49]" />
          </div>
        </div>

        <SlideGame wallet={wallet} onBet={handleBet} currency={currency} />
      </div>

      <div className="max-w-xl mx-auto px-3 pb-8">
        <div className="bg-[#213746] rounded-2xl overflow-hidden border border-[#284150]">
          <button onClick={() => setInfoOpen(!infoOpen)} className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors">
            <span className="text-lg font-bold">Slide</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>
          {infoOpen && (
            <div className="px-6 pb-6 pt-4 border-t border-white/10 space-y-5">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals', '# Live Loop', '# Multiplier Hunt'].map((tag) => (
                    <span key={tag} className="text-xs bg-white/10 text-gray-300 rounded-full px-3 py-1">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-gray-400 text-sm">House Edge</p><p className="text-pink-400 font-bold text-lg">2.00%</p></div>
                <div><p className="text-gray-400 text-sm">RTP</p><p className="text-pink-400 font-bold text-lg">98%</p></div>
                <div><p className="text-gray-400 text-sm">Round Timer</p><p className="text-pink-400 font-bold text-lg">18 Seconds</p></div>
                <div><p className="text-gray-400 text-sm">Top Tile Seen</p><p className="text-pink-400 font-bold text-lg">232.54x</p></div>
              </div>
              <ol className="text-gray-400 text-sm leading-relaxed list-decimal list-inside space-y-1">
                <li>Slide runs continuously in repeating rounds.</li>
                <li>When a round settles on a tile, the next 18 second betting window starts.</li>
                <li>The slider begins fast, slows down, and lands on one mixed-up multiplier tile.</li>
                <li>If the final result is the same as or higher than your selected target, you win your target multiplier.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}