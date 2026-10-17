import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Gift, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ReferralCodePrompt({ open, onClose, userEmail, onSuccess, prefillCode = '' }) {
  const [code, setCode] = useState(prefillCode);
  const [loading, setLoading] = useState(false);

  // When prefillCode changes (e.g. from URL param), update input
  useEffect(() => { if (prefillCode) setCode(prefillCode); }, [prefillCode]);

  const handleSubmit = async () => {
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = String(userEmail || '').trim().toLowerCase();
      const existingReferrals = await base44.entities.Referral.filter({ referred_email: normalizedEmail });
      if (existingReferrals.length > 0) {
        toast.error('This email has already used a referral code');
        setLoading(false);
        return;
      }

      // Check for special VIP code
      const isVIPCode = code === '399686';

      if (isVIPCode) {
        // VIP code: credit directly, no referral record
        const userWallets = await base44.entities.UserWallet.filter({ user_email: userEmail });
        if (userWallets.length > 0) {
          const wallet = userWallets[0];
          await base44.entities.UserWallet.update(wallet.id, {
            tokens: wallet.tokens + 100000,
            cat_dollars: (wallet.cat_dollars || 0) + 5,
          });
          await base44.entities.Transaction.create({
            user_email: userEmail,
            type: 'bonus',
            amount: 100000,
            description: 'VIP Code Bonus',
            balance_after: wallet.tokens + 100000,
          });
        }
        toast.success('VIP Code applied! +100,000 IC & +5 ID!');
        onSuccess();
        onClose();
        return;
      }

      // Find referrer by code
      const referrerWallets = await base44.entities.UserWallet.filter({ referral_code: code });
      if (referrerWallets.length === 0) {
        toast.error('Invalid referral code');
        setLoading(false);
        return;
      }

      const referrer = referrerWallets[0];
      if (referrer.user_email === userEmail) {
        toast.error('You cannot refer yourself');
        setLoading(false);
        return;
      }

      // Create referral record — automation will fire processReferralBonus to credit both users
      await base44.entities.Referral.create({
        referrer_email: referrer.user_email,
        referred_email: normalizedEmail,
        referral_code: code,
        total_commission_earned: 0,
        referred_user_total_spent: 0,
      });

      toast.success('Referral code applied! +500 IC bonus is on its way!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to apply referral code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1A1528] border-pink-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Gift className="w-6 h-6 text-pink-400" />
            Have a Referral Code?
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter your friend's 6-digit referral code to get bonus tokens!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="bg-white/5 border-white/10 text-white text-center text-2xl tracking-widest"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={loading || code.length !== 6}
              className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
            >
              {loading ? 'Applying...' : 'Apply Code'}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              Skip
            </Button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            You'll get 500 IC bonus when you enter a valid code
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}