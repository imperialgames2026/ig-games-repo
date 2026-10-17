import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { Coins, Gift, Crown, Star, Shield, Zap } from 'lucide-react';
import TokenPackCard from '@/components/casino/TokenPackCard';
import WalletDisplay from '@/components/casino/WalletDisplay';
import BonusActivator from '@/components/casino/BonusActivator';
import ExclusionBanner from '@/components/casino/ExclusionBanner';

export default function Store() {
  const [user, setUser] = useState(null);
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

  const { data: packs = [] } = useQuery({
    queryKey: ['tokenPacks'],
    queryFn: () => base44.entities.TokenPack.filter({ is_active: true }),
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];



  const vipBenefits = [
    { icon: Gift, title: 'Daily Bonuses', desc: 'Extra tokens every day' },
    { icon: Crown, title: 'Exclusive Games', desc: 'Access VIP-only tables' },
    { icon: Star, title: 'Priority Support', desc: '24/7 dedicated help' },
    { icon: Shield, title: 'Higher Limits', desc: 'Increased bet caps' },
  ];

  if (user?.is_excluded) return <ExclusionBanner />;

  return (
    <PullToRefresh onRefresh={() => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tokenPacks'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet', user?.email] }),
    ])}>
      <div className="min-h-screen bg-[#0A0612]">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-transparent to-purple-900/20" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full shadow-lg shadow-pink-500/30 mb-6">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/697dc67abbb768c5bbbab5d5/08601dfa9_Wed_4_02_2026_06_44_03.png"
                alt="Imperial Gaming Coin"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">Imperial Gaming Store</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-6">
              Purchase IG packs to play with Base44 Payments. Receive <span className="text-green-400 font-bold">FREE IGUSD</span> with every purchase - no strings attached!
            </p>
            <p className="text-sm text-pink-400 font-semibold">TAXES INCLUDED • NO PURCHASE NECESSARY • Imperial Dollars available free by mail request</p>
            <div className="inline-flex items-center gap-4 bg-white/5 px-6 py-3 rounded-xl border border-white/10">
              <div className="text-center">
                <div className="text-sm text-gray-400">You Purchase</div>
                <div className="text-lg font-bold text-pink-400">200,000 IG</div>
              </div>
              <div className="text-2xl text-gray-600">+</div>
              <div className="text-center">
                <div className="text-sm text-gray-400">FREE Bonus</div>
                <div className="text-lg font-bold text-green-400">22 IGUSD</div>
              </div>
              <div className="text-2xl text-gray-600">=</div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Price</div>
                <div className="text-lg font-bold text-white">$21.78 taxes included</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Token Packs */}
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-pink-400" />
              Token Packs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((pack, i) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <TokenPackCard 
                   pack={pack} 
                   wallet={wallet}
                  />
                </motion.div>
              ))}
            </div>

            {/* VIP Benefits */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Crown className="w-6 h-6 text-pink-400" />
                VIP Benefits
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {vipBenefits.map((benefit, i) => (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border border-white/10"
                  >
                    <benefit.icon className="w-8 h-8 text-pink-400 mb-3" />
                    <h3 className="text-white font-bold mb-1">{benefit.title}</h3>
                    <p className="text-sm text-gray-400">{benefit.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <WalletDisplay wallet={wallet} user={user} onBet={async () => {}} />
            <BonusActivator wallet={wallet} />
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="max-w-7xl mx-auto px-4 py-12 border-t border-white/10">
        <h2 className="text-2xl font-bold text-white mb-6">Terms & Conditions</h2>
        <div className="prose prose-invert prose-sm max-w-none space-y-4 text-gray-400">
          <section>
            <h3 className="text-lg font-bold text-white">1. Acceptance of Terms</h3>
            <p>By accessing and using Imperial Gaming, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use this service.</p>
          </section>

            <section>
              <h3 className="text-lg font-bold text-white">2. Eligibility</h3>
              <p>You must be at least 18 years old to use this service. By using Imperial Casino, you represent and warrant that you are of legal age to form a binding contract.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">3. Virtual Currency</h3>
              <p>IG is a virtual currency that can be purchased for entertainment play. IGUSD is a sweepstakes entry provided FREE as a promotional bonus with IG purchases or by mail request. IGUSD has no monetary value and no purchase is necessary to obtain it. All IG purchases are final and non-refundable.</p>
            </section>
            
            <section>
              <h3 className="text-lg font-bold text-white">3A. No Purchase Necessary</h3>
              <p>You can obtain IGUSD completely FREE without any purchase by mailing a request to: Imperial Gaming, PO Box [ADDRESS], including your name, email, and date of birth. Limit one free request per person per day.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">4. Purchase Bonuses</h3>
              <p>Users receive three special bonuses: 50% on 1st purchase, 100% on 2nd purchase, and 150% on 3rd purchase. Each bonus must be manually activated before making a purchase. Once activated, the bonus is applied to the next purchase only. Bonuses cannot be combined and are limited to one use per tier.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">5. Entertainment Only</h3>
              <p>Imperial Gaming is for entertainment purposes only. No real money gambling occurs on this platform. All games are simulated and outcomes are determined by random number generators.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">6. Account Responsibilities</h3>
              <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">7. Prohibited Activities</h3>
              <p>You agree not to: (a) use the service for any illegal purpose; (b) attempt to gain unauthorized access to any portion of the service; (c) use bots, scripts, or automated tools; (d) create multiple accounts to abuse promotions.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">8. Termination</h3>
              <p>We reserve the right to terminate or suspend your account at any time, without prior notice or liability, for any reason whatsoever, including breach of these terms.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">9. Modifications</h3>
              <p>We reserve the right to modify or replace these terms at any time. Continued use of the service after any such changes constitutes your consent to such changes.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">10. Disclaimer of Warranties</h3>
              <p>The service is provided "as is" without warranty of any kind. We do not warrant that the service will be uninterrupted, timely, secure, or error-free.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">11. Limitation of Liability</h3>
              <p>In no event shall Imperial Gaming be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, or other intangible losses.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">12. Contact</h3>
              <p>For questions about these terms, please contact us through our support channels.</p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-white">13. No Purchase Necessary</h3>
              <p>To receive FREE IGUSD without purchase, send a handwritten request with your name, email, and date of birth to: Imperial Gaming, PO Box [ADDRESS]. Limit one free request per person per day.</p>
            </section>

            <p className="text-xs text-gray-500 mt-8">Last Updated: February 2026</p>
          </div>
        </div>
      </div>
      </div>
    </PullToRefresh>
  );
}