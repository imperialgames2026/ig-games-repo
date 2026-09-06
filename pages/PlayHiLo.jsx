import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import HiLoGame from '@/components/games/HiLoGame';
import { ArrowLeft, Coins, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PlayHiLo() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState('IC');
  const [infoOpen, setInfoOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wallets = [], isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user.email }),
    enabled: !!user,
    placeholderData: (prev) => prev,
  });
  const wallet = wallets[0];

  const updateWallet = useMutation({
    mutationFn: (data) => base44.entities.UserWallet.update(wallet.id, data),
    onSuccess: () => queryClient.invalidateQueries(['wallet', user?.email]),
  });

  const createTransaction = (type, amount, balanceAfter, description) => {
    base44.entities.Transaction.create({
      user_email: user.email,
      type,
      amount,
      game_slug: 'hilo',
      description,
      balance_after: balanceAfter,
    });
  };

  const handleBet = (amount) => {
    if (!wallet) return;
    if (currency === 'IC') {
      const newBal = (wallet.tokens || 0) - amount;
      updateWallet.mutate({
        tokens: newBal,
        total_wagered: (wallet.total_wagered || 0) + amount,
        experience_points: (wallet.experience_points || 0) + Math.floor(amount / 100),
      });
      createTransaction('loss', -amount, newBal, 'HiLo bet placed');
    } else {
      const newBal = (wallet.cat_dollars || 0) - amount;
      updateWallet.mutate({ cat_dollars: newBal });
    }
  };

  const handleWin = (payout, betAmount) => {
    if (!wallet) return;
    if (currency === 'IC') {
      const newBal = (wallet.tokens || 0) + payout;
      updateWallet.mutate({
        tokens: newBal,
        total_won: (wallet.total_won || 0) + payout,
      });
      createTransaction('win', payout, newBal, `HiLo cash out ${payout}`);
    } else {
      const newBal = (wallet.cat_dollars || 0) + payout;
      updateWallet.mutate({ cat_dollars: newBal, total_won: (wallet.total_won || 0) + payout });
    }
  };

  const handleLoss = (betAmount) => {
    if (!wallet) return;
    if (currency === 'IC') {
      updateWallet.mutate({ total_lost: (wallet.total_lost || 0) + betAmount });
    }
  };

  if (!user || !wallet) return (
    <div className="min-h-screen bg-[#0f0b1e] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0b1e]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Link to={createPageUrl('Games')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-bold text-white">HiLo</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrency(c => c === 'IC' ? 'ID' : 'IC')}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            {currency === 'IC'
              ? <><Coins className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400 font-bold text-sm">{(wallet.tokens || 0).toLocaleString()}</span></>
              : <><DollarSign className="w-4 h-4 text-green-400" /><span className="text-green-400 font-bold text-sm">{(wallet.cat_dollars || 0).toFixed(2)}</span></>
            }
          </button>
        </div>
      </div>

      <HiLoGame
        wallet={wallet}
        currency={currency}
        onBet={handleBet}
        onWin={handleWin}
        onLoss={handleLoss}
      />

      {/* Game Info Dropdown */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="bg-[#1c1c2e] rounded-2xl overflow-hidden">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg font-bold">Hilo</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals', '# Provably fair'].map(tag => (
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
                  <p className="text-pink-400 font-bold text-lg">1,038,803.92x</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Stakes Range</p>
                  <p className="text-pink-400 font-bold text-lg">Any amount</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed">
                Hilo is a card prediction game. It retains its traditional appeal and incorporates a rapid-fire dynamic that concludes each round in moments, blending anticipation with quick wins. Designed for solo play, it offers an immersive gaming experience that captures the spirit of an exciting casino adventure. Track your strategies with historical past rounds and amplify the excitement with the simple yet suspenseful mechanic of predicting whether the next card will be higher or lower, adding new dimensions to your game. Dive into this fast-paced adventure today!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}