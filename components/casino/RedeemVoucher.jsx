import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function RedeemVoucher({ user, wallet, onBet }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const redeemMutation = useMutation({
    mutationFn: async (voucherCode) => {
      // Fetch the voucher
      const vouchers = await base44.entities.Voucher.filter({ code: voucherCode.toUpperCase() });
      if (vouchers.length === 0) {
        throw new Error('Voucher not found');
      }

      const voucher = vouchers[0];

      // Check if active
      if (!voucher.is_active) {
        throw new Error('This voucher is inactive');
      }

      // Check expiration
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        throw new Error('This voucher has expired');
      }

      // Check max uses
      if (voucher.max_uses !== -1 && voucher.times_used >= voucher.max_uses) {
        throw new Error('This voucher has reached its use limit');
      }

      // Check if user already redeemed (per-user limit)
      const redemptions = await base44.entities.VoucherRedemption.filter({
        user_email: user.email,
        voucher_code: voucherCode.toUpperCase(),
      });

      if (redemptions.length > 0) {
        throw new Error('You have already redeemed this voucher');
      }

      // Apply rewards to wallet
      if (voucher.tokens_reward > 0 || voucher.cat_dollars_reward > 0) {
        await onBet(0, voucher.tokens_reward + (voucher.cat_dollars_reward * 1000), 'voucher', 0);
      }

      // Create redemption record
      await base44.entities.VoucherRedemption.create({
        user_email: user.email,
        voucher_code: voucherCode.toUpperCase(),
        tokens_received: voucher.tokens_reward,
        cat_dollars_received: voucher.cat_dollars_reward,
        redeemed_at: new Date().toISOString(),
      });

      // Increment voucher use count
      await base44.entities.Voucher.update(voucher.id, {
        times_used: voucher.times_used + 1,
      });

      return voucher;
    },
    onSuccess: (voucher) => {
      queryClient.invalidateQueries(['wallet-layout']);
      toast.success(`Redeemed! +${voucher.tokens_reward} IC${voucher.cat_dollars_reward > 0 ? ` +${voucher.cat_dollars_reward} ID` : ''}`);
      setCode('');
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to redeem voucher');
    },
  });

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast.error('Please enter a voucher code');
      return;
    }
    setIsRedeeming(true);
    await redeemMutation.mutateAsync(code.trim());
    setIsRedeeming(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Gift className="w-4 h-4" />
          Redeem Voucher
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1A1528] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>Redeem Voucher Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Voucher Code</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              disabled={isRedeeming}
            />
          </div>

          <Button
            onClick={handleRedeem}
            disabled={isRedeeming || !code.trim()}
            className="w-full bg-gradient-to-r from-pink-500 to-pink-600"
          >
            {isRedeeming ? 'Redeeming...' : 'Redeem'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}