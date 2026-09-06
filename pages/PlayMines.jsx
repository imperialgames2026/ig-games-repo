import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MinesGame from '@/components/games/MinesGame';
import WalletDisplay from '@/components/casino/WalletDisplay';
import LiveBetsPanel from '@/components/casino/LiveBetsPanel';

export default function PlayMines() {
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
    <div className="bg-[#0A0612] min-h-screen">
      {/* Sticky Header */}
      <div className="bg-[#0A0612]/95 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to={createPageUrl('Games')}>
            <Button variant="ghost" size="sm" className="text-white px-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="text-white font-bold text-lg">Mines</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-[#1A1528] rounded-lg p-0.5">
              <button onClick={() => setCurrency('IC')} className={`px-2 py-1 rounded text-xs font-semibold transition-all ${currency === 'IC' ? 'bg-pink-500 text-white' : 'text-gray-400'}`}>IC</button>
              <button onClick={() => setCurrency('ID')} className={`px-2 py-1 rounded text-xs font-semibold transition-all ${currency === 'ID' ? 'bg-green-500 text-white' : 'text-gray-400'}`}>ID</button>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold ${currency === 'IC' ? 'bg-pink-500/20 border-pink-500/30 text-pink-300' : 'bg-green-500/20 border-green-500/30 text-green-300'}`}>
              <Coins className="w-4 h-4" />
              {currency === 'IC' ? (wallet?.tokens || 0).toLocaleString() : (wallet?.cat_dollars || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Game — visible without scrolling */}
      <div className="px-2 pt-2">
        <MinesGame wallet={wallet} onBet={handleBet} currency={currency} />
      </div>

      {/* Live Bets Feed — below the game (scroll to see) */}
      <div className="mt-4">
        <LiveBetsPanel gameName="mines" userEmail={user?.email} />
      </div>
    </div>
  );
}