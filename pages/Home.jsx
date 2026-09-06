import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { motion } from 'framer-motion';
import { Sparkles, Star, TrendingUp, Users, ChevronRight, Zap, Smartphone, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GameCard from '@/components/casino/GameCard';
import LiveBetFeed from '@/components/casino/LiveBetFeed';
import WalletDisplay from '@/components/casino/WalletDisplay';
import DailyReward from '@/components/casino/DailyReward';
import BonusActivator from '@/components/casino/BonusActivator';
import AnnouncementBanner from '@/components/casino/AnnouncementBanner';
import DailyQuests from '@/components/casino/DailyQuests';
import WeeklyQuests from '@/components/casino/WeeklyQuests';

export default function Home() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [currency, setCurrency] = useState(() => localStorage.getItem('preferredCurrency') || 'IC');
  const [rewardPulse, setRewardPulse] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    loadUser();
  }, []);
  
  const handleCurrencyChange = () => {
    const newCurrency = currency === 'IC' ? 'ID' : 'IC';
    setCurrency(newCurrency);
    localStorage.setItem('preferredCurrency', newCurrency);
  };

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.filter({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: wallets = [], status: walletsStatus } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];

  const createWalletMutation = useMutation({
    mutationFn: (data) => base44.entities.UserWallet.create(data),
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  const updateWalletMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserWallet.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['wallet']),
  });

  // Create wallet only after query has fully loaded and confirmed no wallet exists
  useEffect(() => {
    const createWallet = async () => {
      if (user?.email && walletsStatus === 'success' && wallets.length === 0 && !createWalletMutation.isPending) {
        createWalletMutation.mutate({
          user_email: user.email,
          tokens: 10000,
          cat_dollars: 5,
          total_won: 0,
          total_lost: 0,
          vip_level: 1,
        });
      }
    };
    createWallet();
  }, [user?.email, walletsStatus]);

  const canClaimDaily = () => {
    if (!wallet) return false;
    const lastClaim = localStorage.getItem('lastDailyClaim');
    if (!lastClaim) return true;
    const last = new Date(lastClaim);
    const now = new Date();
    const hoursDiff = (now - last) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  };

  const claimDailyReward = async () => {
    if (!wallet || !canClaimDaily()) return;
    
    await updateWalletMutation.mutateAsync({
      id: wallet.id,
      data: { 
        tokens: wallet.tokens + 20000,
        cat_dollars: (wallet.cat_dollars || 0) + 1
      },
    });
    localStorage.setItem('lastDailyClaim', new Date().toISOString());
  };

  // Show only instant games (Crash, Rocket, etc.) on homepage
  const headlinerGames = games.filter(g => g.category === 'instant' || g.slug === 'crash' || g.slug === 'rocket');

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['games-home'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet-home', user?.email] }),
    ]);
  };

  const triggerRewardPulse = () => {
    setRewardPulse(true);
    setTimeout(() => setRewardPulse(false), 900);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-[#0A0612] overflow-y-auto">
      {/* Announcement Banner */}
      <AnnouncementBanner />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-amber-900/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="text-sm text-pink-400 font-medium">Welcome Bonus: 1,000 Free Tokens!</span>
            </div>
            
            {/* Mascot Image */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 1 }}
              className="mb-8"
            >
              <img 
                src="https://media.base44.com/images/public/697dc67abbb768c5bbbab5d5/669cada57_692efb11e_generated_image.png"
                alt="Imperial Gaming logo"
                className="w-64 h-64 mx-auto object-contain drop-shadow-2xl"
              />
            </motion.div>

            <h1 className="text-5xl sm:text-7xl font-black text-white mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-pink-400">
                IMPERIAL
              </span>
              <br />
              <span className="text-white">CASINO</span>
            </h1>
            
            <p className="text-2xl font-bold text-pink-400 mb-4">
              For Real Gamblers by Real Gamblers
            </p>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-4">
              Experience the thrill of Vegas with our premium social casino games in a free-to-play social casino environment.
            </p>

            <div className="max-w-3xl mx-auto mb-8 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-5 py-4">
              <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                18+ only. Free to play. No real money gambling. No real money prizes or cash value.
              </p>
            </div>

            {!user && (
              <Button
                onClick={() => base44.auth.redirectToLogin()}
                className="h-14 px-8 text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 rounded-xl"
              >
                <Zap className="w-5 h-5 mr-2" />
                Start Playing Now
              </Button>
            )}
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'Active Players', value: '10K+', icon: Users },
              { label: 'Games', value: games.length.toString(), icon: Star },
              { label: 'Payouts', value: '$1M+', icon: TrendingUp },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-4 rounded-2xl bg-white/5 border border-white/10"
              >
                <stat.icon className="w-6 h-6 mx-auto text-pink-400 mb-2" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* App Download Banner */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-pink-600/20 border border-pink-500/30 p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-10"
        >
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-2xl font-black text-white mb-1">Play on the Go</h3>
            <p className="text-gray-400 text-sm sm:text-base">Download the Imperial Gaming app and enjoy the full casino experience from your phone — anytime, anywhere.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <a
              href="https://apps.apple.com/us/app/imperial-gaming/id6745543726"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 bg-black border border-white/20 hover:border-white/50 rounded-xl transition-all group"
            >
              <svg className="w-7 h-7 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-gray-400 text-xs leading-none">Download on the</div>
                <div className="text-white font-bold text-sm leading-tight">App Store</div>
              </div>
            </a>

          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Games Section */}
          <div className="lg:col-span-3 space-y-12">

            {/* Daily Reward */}
            {user && (
              <>
                <DailyReward 
                  onClaim={claimDailyReward}
                  canClaim={canClaimDaily()}
                />
                <DailyQuests user={user} wallet={wallet} onRewardClaimed={triggerRewardPulse} />
                <WeeklyQuests user={user} wallet={wallet} onRewardClaimed={triggerRewardPulse} />
              </>
            )}

            {/* Headliner Games */}
            {headlinerGames.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Zap className="w-6 h-6 text-pink-400" />
                    Trending Now
                  </h2>
                  <Link 
                    to={createPageUrl('Games')}
                    className="text-pink-400 hover:text-pink-300 flex items-center gap-1 text-sm font-medium"
                  >
                    View All Games <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {headlinerGames.map((game, i) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <GameCard game={game} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {user && <WalletDisplay wallet={wallet} currency={currency} onCurrencyChange={handleCurrencyChange} rewardPulse={rewardPulse} />}
            {user && <BonusActivator wallet={wallet} />}
            
            <Link to={createPageUrl('Staking')} className="block rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 to-purple-500/10 p-6 transition-all hover:border-pink-500/40 hover:bg-pink-500/20">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-300">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Staking Dashboard</h3>
              <p className="mt-2 text-sm text-gray-400">Lock your ID balance and collect hourly pool rewards.</p>
            </Link>
            
            {/* Quick Links */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Play</h3>
              <div className="space-y-2">
                {games.slice(0, 5).map((game) => (
                  <Link
                    key={game.id}
                    to={createPageUrl(`Play${game.slug}`)}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-white font-medium">{game.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Bet Feed - Full Width Bottom */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <LiveBetFeed />
      </div>

      {/* Information Section */}
      <div className="bg-gradient-to-b from-transparent via-purple-900/10 to-transparent py-16">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-12"
          >
            {/* Main Content Block */}
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-white mb-8">About Imperial Gaming</h2>
              
              <p className="text-gray-300 text-lg leading-relaxed">
                Welcome to Imperial Gaming, where premium entertainment meets cutting-edge gaming technology. Our platform is designed for players who demand excellence, fairness, and excitement in every spin, every hand, and every round. Whether you're a seasoned casino enthusiast or exploring social gaming for the first time, Imperial Gaming provides an immersive experience that rivals the finest casinos.
              </p>

              <p className="text-gray-300 text-lg leading-relaxed">
                We believe that gaming should be thrilling, fair, and accessible to everyone. That's why we've built Imperial Gaming as a social casino platform where you can enjoy authentic casino experiences without the financial risks of real-money gambling. Our games are designed for pure entertainment, with the opportunity to win impressive virtual rewards and climb our exclusive VIP rankings.
              </p>

              <p className="text-gray-300 text-lg leading-relaxed">
                At Imperial Gaming, we're committed to transparency and fairness. Every game outcome is determined by cryptographically secure, server-side randomness using SHA-256 hash chains and pre-commitment hashing. This means you can trust that your results are truly random and verifiable. Our Fairness Manifesto outlines exactly how we ensure every player gets a fair shot at winning.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Diverse Game Library',
                  description: 'From instant games like Crash and Rocket to classic slots, poker tournaments, and live blackjack tables. We have something for every gaming preference.'
                },
                {
                  title: 'VIP Progression System',
                  description: 'Climb eight exclusive VIP tiers from Bronze to Diamond III. Unlock special perks, bonuses, and rewards as you advance through our loyalty program.'
                },
                {
                  title: 'Server-Side Fairness',
                  description: 'Every outcome uses provably fair cryptographic randomness. Our SSRCR technology ensures all results are transparent and independently verifiable.'
                },
                {
                  title: 'Daily Rewards & Bonuses',
                  description: 'Claim daily login bonuses, first-purchase bonuses up to 150%, seasonal promotions, and exclusive rewards for our loyal players.'
                },
                {
                  title: 'Social Features',
                  description: 'Join our thriving community with live chat, leaderboards, referral programs, and social tournaments where you can compete with other players.'
                },
                {
                  title: 'Secure & Responsible',
                  description: 'Play with confidence knowing your account is secure. We enforce responsible gaming practices and self-exclusion options for player protection.'
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-pink-500/30 transition-colors"
                >
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Why Choose Imperial */}
            <div className="space-y-6 pt-8 border-t border-white/10">
              <h2 className="text-3xl font-bold text-white">Why Choose Imperial Gaming?</h2>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm mt-1">✓</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Premium Experience</h4>
                    <p className="text-gray-400">Our platform is built with modern technology and beautiful UI/UX design that makes every session enjoyable and intuitive.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm mt-1">✓</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">No Real Money Required</h4>
                    <p className="text-gray-400">Play with virtual Imperial Coins and Dollars. All gaming is for entertainment purposes only, with no financial risk.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm mt-1">✓</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Proven Fairness</h4>
                    <p className="text-gray-400">With our cryptographically secure randomness, every outcome is verifiable and completely transparent to our players.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm mt-1">✓</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Rewarding Gameplay</h4>
                    <p className="text-gray-400">Earn rewards through daily bonuses, winning games, referrals, and VIP progression. The more you play, the more you earn.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="text-center pt-8">
              <p className="text-gray-400 mb-6 text-lg">
                Ready to experience the ultimate social casino? Join thousands of players who trust Imperial Gaming for authentic entertainment.
              </p>
              {!user && (
                <Button
                  onClick={() => base44.auth.redirectToLogin()}
                  className="h-12 px-8 text-lg font-bold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 rounded-xl"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Create Your Account Today
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}