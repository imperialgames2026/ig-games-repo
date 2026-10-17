import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins, RefreshCw } from 'lucide-react';
import BlackjackGame from '@/components/games/BlackjackGame';
import WalletDisplay from '@/components/casino/WalletDisplay';

export default function PlayBlackjack() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');

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

  const handleBet = async (betAmount, winAmount, gameSlug) => {
    if (!wallet) return;

    const netChange = winAmount - betAmount;
    const isID = currency === 'ID';
    const currentBalance = isID ? (wallet.cat_dollars || 0) : (wallet.tokens || 0);
    const newBalance = currentBalance + netChange;

    const walletUpdate = isID
      ? { cat_dollars: newBalance }
      : { tokens: newBalance };

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        ...walletUpdate,
        total_won: wallet.total_won + (winAmount > 0 ? winAmount : 0),
        total_lost: wallet.total_lost + (winAmount === 0 ? betAmount : 0),
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: winAmount > 0 ? 'win' : 'loss',
      amount: netChange,
      game_slug: gameSlug,
      description: winAmount > 0 ? `Won ${winAmount} ${currency}` : `Lost ${betAmount} ${currency}`,
      balance_after: newBalance,
      cat_dollars: isID ? netChange : undefined,
    });

    base44.analytics.track({
      eventName: winAmount > 0 ? 'game_win' : 'game_loss',
      properties: { game: gameSlug, bet_amount: betAmount, win_amount: winAmount, currency },
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0612] touch-manipulation">
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
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = currency === 'IC' ? 'ID' : 'IC';
                  setCurrency(next);
                  localStorage.setItem('preferredCurrency', next);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-gray-300 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                {currency}
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-pink-600/10 border border-pink-500/30">
                <Coins className="w-5 h-5 text-pink-400" />
                <span className="text-lg font-bold text-white">
                  {currency === 'IC' ? (wallet?.tokens || 0).toLocaleString() : (wallet?.cat_dollars || 0).toFixed(2)}
                </span>
                <span className="text-xs text-pink-400">{currency}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-white mb-2">Blackjack</h1>
              <p className="text-gray-400">Beat the dealer to 21!</p>
            </div>
            <BlackjackGame wallet={wallet} onBet={handleBet} currency={currency} />
          </div>
          
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} />
          </div>
        </div>
      </div>
    </div>
  );
}