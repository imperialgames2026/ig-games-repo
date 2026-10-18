import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TowersGame from '../components/games/TowersGame';

export default function PlayTowers() {
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const [infoOpen, setInfoOpen] = useState(false);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
  });

  const handleBet = async (betAmount, winAmount) => {
    if (!wallet) return;

    const netAmount = winAmount - betAmount;
    const newBalance = wallet.tokens + netAmount;

    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: {
        tokens: Math.max(0, newBalance),
        total_won: wallet.total_won + (winAmount > 0 ? winAmount : 0),
        total_lost: wallet.total_lost + (winAmount === 0 ? betAmount : 0),
      },
    });

    await createTransactionMutation.mutateAsync({
      user_email: user.email,
      type: winAmount > 0 ? 'win' : 'loss',
      amount: netAmount,
      game_slug: 'towers',
      description: `Towers game - ${winAmount > betAmount ? 'Won' : 'Lost'}`,
      balance_after: newBalance,
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0612] p-4" style={{ zoom: '0.85' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="mb-6">
          <h1 className="text-4xl font-black text-white mb-2">Towers</h1>
          <p className="text-gray-400">Climb the tower and avoid the mines</p>
        </div>

        {wallet && <TowersGame wallet={wallet} onBet={handleBet} currency={currency} />}

        {/* Game Info Dropdown */}
        <div className="mt-6 bg-[#1c1c2e] rounded-2xl overflow-hidden">
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-lg font-bold">Tower Legend</span>
            {infoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {infoOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
              <div>
                <p className="text-pink-400 text-sm font-semibold mb-2">By Imperial Gaming</p>
                <div className="flex flex-wrap gap-2">
                  {['# Imperial Originals'].map(tag => (
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
                Experience the thrill of Tower Legend at Imperial Gaming, an innovative and provably fair slot game. Navigate the tower wisely, avoid the wrong tiles, and reach the top for impressive wins. Engaging gameplay, transparency, and big rewards await in this unique and exciting slot adventure.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}