import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Coins } from 'lucide-react';
import RealisticSlotMachine from '@/components/slots/RealisticSlotMachine';
import PremiumSlot from '@/components/slots/PremiumSlot';
import WalletDisplay from '@/components/casino/WalletDisplay';
import { Crown, Heart, Sparkles, Gem, Clover, Flame, Waves, Feather, Zap, Star } from 'lucide-react';
import { trackDailyWager } from '@/components/casino/DailyWagerTracker';

export default function PlaySlots() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('imperial-gold');
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');

  const slotGames = [
    { 
      id: 'imperial-gold', 
      name: 'Imperial Gold',
      theme: {
        primary: 'from-yellow-500 to-yellow-600',
        secondary: 'from-yellow-900 via-yellow-800 to-yellow-900',
        border: 'border-yellow-500',
        text: 'text-yellow-300',
        title: 'IMPERIAL GOLD',
        icon: Crown,
      }
    },
    { 
      id: 'royal-ruby', 
      name: 'Royal Ruby',
      theme: {
        primary: 'from-pink-500 to-pink-600',
        secondary: 'from-pink-900 via-pink-800 to-pink-900',
        border: 'border-pink-500',
        text: 'text-pink-300',
        title: 'ROYAL RUBY',
        icon: Heart,
      }
    },
    { 
      id: 'cosmic-crown', 
      name: 'Cosmic Crown',
      theme: {
        primary: 'from-purple-500 to-purple-600',
        secondary: 'from-purple-900 via-purple-800 to-purple-900',
        border: 'border-purple-500',
        text: 'text-purple-300',
        title: 'COSMIC CROWN',
        icon: Sparkles,
      }
    },
    { 
      id: 'diamond-dynasty', 
      name: 'Diamond Dynasty',
      theme: {
        primary: 'from-cyan-500 to-cyan-600',
        secondary: 'from-cyan-900 via-cyan-800 to-cyan-900',
        border: 'border-cyan-500',
        text: 'text-cyan-300',
        title: 'DIAMOND DYNASTY',
        icon: Gem,
      }
    },
    { 
      id: 'emerald-empire', 
      name: 'Emerald Empire',
      theme: {
        primary: 'from-green-500 to-green-600',
        secondary: 'from-green-900 via-green-800 to-green-900',
        border: 'border-green-500',
        text: 'text-green-300',
        title: 'EMERALD EMPIRE',
        icon: Clover,
      }
    },
    { 
      id: 'phoenix-fire', 
      name: 'Phoenix Fire',
      theme: {
        primary: 'from-orange-500 to-red-600',
        secondary: 'from-orange-900 via-red-800 to-orange-900',
        border: 'border-orange-500',
        text: 'text-orange-300',
        title: 'PHOENIX FIRE',
        icon: Flame,
      }
    },
    { 
      id: 'ocean-treasure', 
      name: 'Ocean Treasure',
      theme: {
        primary: 'from-blue-500 to-blue-600',
        secondary: 'from-blue-900 via-blue-800 to-blue-900',
        border: 'border-blue-500',
        text: 'text-blue-300',
        title: 'OCEAN TREASURE',
        icon: Waves,
      }
    },
    { 
      id: 'sapphire-storm', 
      name: 'Sapphire Storm',
      theme: {
        primary: 'from-indigo-500 to-indigo-600',
        secondary: 'from-indigo-900 via-indigo-800 to-indigo-900',
        border: 'border-indigo-500',
        text: 'text-indigo-300',
        title: 'SAPPHIRE STORM',
        icon: Zap,
      }
    },
    { 
      id: 'neon-nights', 
      name: 'Neon Nights',
      theme: {
        primary: 'from-fuchsia-500 to-fuchsia-600',
        secondary: 'from-fuchsia-900 via-fuchsia-800 to-fuchsia-900',
        border: 'border-fuchsia-500',
        text: 'text-fuchsia-300',
        title: 'NEON NIGHTS',
        icon: Star,
      }
    },
    { 
      id: 'lucky-fortune', 
      name: 'Lucky Fortune',
      theme: {
        primary: 'from-lime-500 to-green-600',
        secondary: 'from-lime-900 via-green-800 to-lime-900',
        border: 'border-lime-500',
        text: 'text-lime-300',
        title: 'LUCKY FORTUNE',
        icon: Clover,
      }
    },
    { 
      id: 'premium-slot', 
      name: '⚡ Premium Slot',
      theme: {
        primary: 'from-pink-500 to-purple-600',
        secondary: 'from-slate-900 via-purple-900 to-slate-900',
        border: 'border-purple-500',
        text: 'text-purple-300',
        title: 'PREMIUM SLOT',
        icon: Zap,
      }
    },
  ];

  const currentSlot = slotGames.find(s => s.id === selectedSlot) || slotGames[0];

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

  const handleBet = async (betAmount, winAmount, gameSlug, xpGained = 0) => {
    if (!wallet) return;

    // Track daily wager for wheel spins
    await trackDailyWager(user.email, betAmount);

    const netChange = winAmount - betAmount;
    const isWin = winAmount > betAmount;
    
    if (currency === 'IC') {
      const newBalance = wallet.tokens + netChange;
      // IC does NOT contribute to XP or bonuses
      
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          tokens: newBalance,
          total_won: wallet.total_won + (isWin ? winAmount - betAmount : 0),
          total_lost: wallet.total_lost + (isWin ? 0 : betAmount - winAmount),
          // No XP change for IC
        },
      });

      // No VIP level update for IC wagering

      // Track quest progress
      try {
        await base44.functions.invoke('checkQuestProgress', {
          game_slug: gameSlug,
          amount_wagered: betAmount,
          is_win: isWin,
        });
      } catch (e) {
        console.error('Quest progress error:', e);
      }

      // Track achievement progress
      try {
        await base44.functions.invoke('checkAchievementProgress', {
          trigger_type: 'wager',
          value: betAmount,
        });
        
        if (isWin) {
          await base44.functions.invoke('checkAchievementProgress', {
            trigger_type: 'game_won',
            value: 1,
          });
        }
      } catch (e) {
        console.error('Achievement progress error:', e);
      }

      await createTransactionMutation.mutateAsync({
        user_email: user.email,
        type: isWin ? 'win' : 'loss',
        amount: netChange,
        game_slug: gameSlug,
        description: isWin ? `Won ${winAmount.toFixed(2)} ${currency}` : `Lost ${betAmount.toFixed(2)} ${currency}`,
        balance_after: newBalance,
      });
    } else {
      const newBalance = (wallet.cat_dollars || 0) + netChange;
      const newExperience = (wallet.experience_points || 0) + xpGained;
      
      await updateWalletMutation.mutateAsync({
        id: wallet.id,
        data: {
          cat_dollars: newBalance,
          experience_points: newExperience,
        },
      });

      // Check VIP level update for ID wagering too
      try {
        await base44.functions.invoke('updateVIPLevel', {
          user_email: user.email,
          experience_points: newExperience,
        });
      } catch (e) {
        console.error('VIP update error:', e);
      }

      // Track quest progress for ID
      try {
        await base44.functions.invoke('checkQuestProgress', {
          game_slug: gameSlug,
          amount_wagered: betAmount,
          is_win: isWin,
        });
      } catch (e) {
        console.error('Quest progress error:', e);
      }

      // Track achievement progress for ID
      try {
        await base44.functions.invoke('checkAchievementProgress', {
          trigger_type: 'wager',
          value: betAmount,
        });
        
        if (isWin) {
          await base44.functions.invoke('checkAchievementProgress', {
            trigger_type: 'game_won',
            value: 1,
          });
        }
      } catch (e) {
        console.error('Achievement progress error:', e);
      }

      await createTransactionMutation.mutateAsync({
        user_email: user.email,
        type: isWin ? 'win' : 'loss',
        amount: netChange,
        game_slug: gameSlug,
        description: isWin ? `Won ${winAmount.toFixed(2)} ${currency}` : `Lost ${betAmount.toFixed(2)} ${currency}`,
        balance_after: newBalance,
      });
    }

    // Track comprehensive analytics
    base44.analytics.track({
    eventName: isWin ? 'game_win' : 'game_loss',
    properties: {
      game: gameSlug,
      bet_amount: betAmount,
      win_amount: winAmount,
      net_change: netChange,
      currency: currency,
      xp_gained: currency === 'IC' ? 0 : xpGained, // IC doesn't give XP
      new_balance: currency === 'IC' ? wallet.tokens + netChange : (wallet.cat_dollars || 0) + netChange,
      vip_level: wallet.vip_level || 1,
    },
    });
    };

  return (
    <div className="min-h-screen bg-[#0A0612] touch-manipulation">
      {/* Header */}
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
            
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-[#1A1528] rounded-lg p-1">
                <button
                  onClick={() => setCurrency('IC')}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                    currency === 'IC' ? 'bg-pink-500 text-white' : 'text-gray-400'
                  }`}
                >
                  IC
                </button>
                <button
                  onClick={() => setCurrency('ID')}
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                    currency === 'ID' ? 'bg-green-500 text-white' : 'text-gray-400'
                  }`}
                >
                  ID
                </button>
              </div>
              <button
                onClick={() => {
                  const newCurrency = currency === 'IC' ? 'ID' : 'IC';
                  setCurrency(newCurrency);
                  localStorage.setItem('preferredCurrency', newCurrency);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  currency === 'IC' 
                    ? 'bg-gradient-to-r from-pink-500/20 to-pink-600/10 border-pink-500/30' 
                    : 'bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30'
                }`}
              >
                <Coins className={`w-5 h-5 ${currency === 'IC' ? 'text-pink-400' : 'text-green-400'}`} />
                <span className="text-lg font-bold text-white">
                  {currency === 'IC' 
                    ? (wallet?.tokens || 0).toLocaleString() 
                    : (wallet?.cat_dollars || 0).toLocaleString()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {/* Slot Selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {slotGames.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    selectedSlot === slot.id
                      ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20'
                  }`}
                >
                  {slot.name}
                </button>
              ))}
            </div>
            
            {selectedSlot === 'premium-slot' ? (
              <PremiumSlot
                wallet={wallet}
                onWin={(betAmount, winAmount, gameSlug) => handleBet(betAmount, winAmount, gameSlug, Math.floor(betAmount))}
                bet={10}
              />
            ) : (
              <RealisticSlotMachine 
                wallet={wallet} 
                onBet={handleBet}
                onFreeSpinUsed={() => {
                  if (!wallet) return;
                  updateWalletMutation.mutate({
                    id: wallet.id,
                    data: { free_spins: Math.max(0, (wallet.free_spins || 0) - 1) }
                  });
                }}
                currency={currency}
                slotType={currentSlot.id}
                theme={currentSlot.theme}
              />
            )}
          </div>
          
          <div className="hidden lg:block">
            <WalletDisplay wallet={wallet} />
          </div>
        </div>
      </div>
    </div>
  );
}