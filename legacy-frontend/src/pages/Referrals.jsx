import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { 
  Users, Copy, Gift, TrendingUp, DollarSign, 
  Share2, Check, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralsPage() {
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
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
    queryKey: ['wallet-referral', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];
  const referralCode = wallet?.referral_code || '------';
  const referralLink = referralCode !== '------'
    ? `${window.location.origin}/?ref=${referralCode}`
    : '';

  // Fetch referrals where user is the referrer
  const { data: myReferrals = [] } = useQuery({
    queryKey: ['my-referrals', user?.email],
    queryFn: () => base44.entities.Referral.filter({ referrer_email: user?.email }),
    enabled: !!user?.email,
  });

  // Calculate stats
  const totalReferrals = myReferrals.length;
  const totalEarned = myReferrals.reduce((sum, ref) => sum + (ref.total_commission_earned || 0), 0);
  const activeReferrals = myReferrals.filter(ref => ref.referred_user_total_spent > 0).length;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink || referralCode);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Imperial Casino',
        text: 'Join me on Imperial Casino and get bonus tokens!',
        url: referralLink,
      });
    } else {
      copyToClipboard();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0612] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0612] py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
            <Users className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-pink-400 font-medium">Referrals Program</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Invite Friends, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600">Earn Together</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Share your unique link and earn bonus tokens when your friends join and play!
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{totalReferrals}</div>
                  <div className="text-sm text-gray-400">Total Referrals</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">${totalEarned.toFixed(2)} ID</div>
                  <div className="text-sm text-gray-400">Commission Earned</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{activeReferrals}</div>
                  <div className="text-sm text-gray-400">Active Referrals</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code Card */}
        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-400" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-8 bg-white/5 rounded-xl border border-white/10">
              <div className="text-sm text-gray-400 mb-2">Share this code with friends</div>
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-pink-600 tracking-widest mb-4">
                {referralCode}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  setCopied(true);
                  toast.success('Code copied!');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="bg-pink-500 hover:bg-pink-600"
              >
                {copied ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                Copy Code
              </Button>
            </div>
            {referralLink && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                <span className="text-xs text-gray-400 flex-1 truncate">{referralLink}</span>
                <Button
                  size="sm"
                  onClick={copyToClipboard}
                  className="bg-pink-500 hover:bg-pink-600 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={shareLink}
                  variant="outline"
                  className="border-white/20 text-white shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="text-sm text-gray-400 text-center">
              Both you and your friend get <span className="text-green-400 font-bold">500 IC</span> when they sign up. You earn <span className="text-pink-400 font-bold">2% in ID</span> on every purchase they make, forever.
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-pink-400">1</span>
                </div>
                <h3 className="font-bold text-white mb-2">Share Your Link</h3>
                <p className="text-sm text-gray-400">
                  Send your unique referral link to friends via social media, email, or messaging
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-400">2</span>
                </div>
                <h3 className="font-bold text-white mb-2">They Sign Up</h3>
                <p className="text-sm text-gray-400">
                  Your referral creates an account using your link and gets a welcome bonus
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-400">3</span>
                </div>
                <h3 className="font-bold text-white mb-2">Earn Forever</h3>
                <p className="text-sm text-gray-400">
                  Get 2% of every purchase they make, for life — paid as Imperial Dollars!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral List */}
        {myReferrals.length > 0 && (
          <Card className="bg-gradient-to-br from-[#1A1528] to-[#0F0A1E] border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Your Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myReferrals.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div>
                      <div className="text-white font-medium">{ref.referred_email}</div>
                      <div className="text-sm text-gray-400">
                        Joined {new Date(ref.created_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">+${(ref.total_commission_earned || 0).toFixed(2)} ID</div>
                      <div className="text-xs text-gray-400">
                        ${(ref.referred_user_total_spent || 0).toFixed(2)} spent
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}