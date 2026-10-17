import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteGame from '@/components/games/RouletteGame';
import WalletDisplay from '@/components/casino/WalletDisplay';

const ROULETTE_BOARD_IMAGE = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/f1c1d3180_1860760b8_generated_image.png';
const ROULETTE_WHEEL_IMAGE = 'https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/510d4508f_50da35acb_generated_image.png';

export default function PlayRoulette() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleCurrencyChange = () => {
    const nextCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(nextCurrency);
    localStorage.setItem('preferredCurrency', nextCurrency);
  };

  const handleBet = async (betAmount, winAmount) => {
    if (!wallet) return;

    const netResult = winAmount - betAmount;
    const balanceField = currency === 'ID' ? 'cat_dollars' : 'tokens';
    const currentBalance = wallet[balanceField] || 0;
    const newBalance = currentBalance + netResult;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        [balanceField]: newBalance,
        total_won: wallet.total_won + (netResult > 0 ? winAmount : 0),
        total_lost: wallet.total_lost + (netResult < 0 ? betAmount : 0),
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: netResult > 0 ? 'win' : 'loss',
      amount: netResult,
      game_slug: 'roulette',
      description: `Roulette ${netResult > 0 ? 'win' : 'loss'}`,
      balance_after: newBalance,
      cat_dollars: currency === 'ID' ? netResult : 0,
    });

    base44.analytics.track({
      eventName: netResult > 0 ? 'game_win' : 'game_loss',
      properties: {
        game: 'roulette',
        bet_amount: betAmount,
        win_amount: winAmount,
        currency,
      },
    });
  };

  if (!user || !wallet) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0612]" style={{ zoom: '0.85' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/30 via-[#0A0612] to-black/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Games')}>
              <Button variant="ghost" className="text-white">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Games
              </Button>
            </Link>
            <div className="text-center flex-1">
              <h1 className="text-2xl font-black text-white">ROULETTE</h1>
              <p className="text-sm text-gray-400">European Style - Single Zero</p>
            </div>
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${currency === 'ID' ? 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30' : 'bg-gradient-to-r from-pink-500/20 to-pink-600/10 border-pink-500/30'}`}>
              <div className="text-right">
                <div className="text-xs text-gray-400">Balance</div>
                <div className="text-lg font-bold text-white">{(currency === 'ID' ? wallet.cat_dollars : wallet.tokens).toLocaleString()} {currency}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_300px] gap-5">
          <div>
            <RouletteGame wallet={wallet} currency={currency} onBet={handleBet} boardImage={ROULETTE_BOARD_IMAGE} wheelImage={ROULETTE_WHEEL_IMAGE} />
          </div>
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} user={user} onBet={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}