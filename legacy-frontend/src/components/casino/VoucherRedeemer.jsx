import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function VoucherRedeemer({ user, wallet, onRedeemSuccess }) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const redeemMutation = useMutation({
    mutationFn: async (voucherCode) => {
      if (!user?.email) throw new Error('User not authenticated');
      
      // Find voucher by code
      const vouchers = await base44.entities.Voucher.filter({ code: voucherCode });
      if (vouchers.length === 0) throw new Error('Voucher code not found');
      
      const voucher = vouchers[0];
      
      // Check if voucher is active
      if (!voucher.is_active) throw new Error('Voucher is not active');
      
      // Check expiration
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        throw new Error('Voucher has expired');
      }
      
      // Check usage limit (max_uses = -1 means unlimited)
      if (voucher.max_uses !== -1 && voucher.times_used >= voucher.max_uses) {
        throw new Error('Voucher has reached its usage limit');
      }

      // Check if this user already redeemed this voucher (per-user 1x limit)
      const existingRedemptions = await base44.entities.VoucherRedemption.filter({
        user_email: user.email,
        voucher_code: voucherCode,
      });
      if (existingRedemptions.length > 0) {
        throw new Error('You have already redeemed this voucher');
      }

      // Update wallet with rewards
      const newTokens = (wallet?.tokens || 0) + (voucher.tokens_reward || 0);
      const newDollars = (wallet?.cat_dollars || 0) + (voucher.cat_dollars_reward || 0);
      const newFreeSpins = (wallet?.free_spins || 0) + (voucher.free_spins || 0);

      if (wallet) {
        const walletUpdate = { tokens: newTokens, cat_dollars: newDollars };
        if ((voucher.free_spins || 0) > 0) {
          walletUpdate.free_spins = newFreeSpins;
          walletUpdate.free_spin_bet_amount = voucher.free_spin_bet_amount || 0;
          walletUpdate.free_spin_game = voucher.free_spin_game || 'wheel';
        }
        await base44.entities.UserWallet.update(wallet.id, walletUpdate);
      }

      // Record redemption for this user
      await base44.entities.VoucherRedemption.create({
        user_email: user.email,
        voucher_code: voucherCode,
        tokens_received: voucher.tokens_reward || 0,
        cat_dollars_received: voucher.cat_dollars_reward || 0,
        redeemed_at: new Date().toISOString(),
      });

      // Increment global use count
      await base44.entities.Voucher.update(voucher.id, {
        times_used: (voucher.times_used || 0) + 1,
      });

      // Create transaction record
      await base44.entities.Transaction.create({
        user_email: user.email,
        type: 'bonus',
        amount: voucher.tokens_reward || 0,
        cat_dollars: voucher.cat_dollars_reward || 0,
        description: `Voucher redeemed: ${voucherCode}`,
        balance_after: newTokens,
      });

      return { reward_ic: voucher.tokens_reward, reward_id: voucher.cat_dollars_reward, free_spins: voucher.free_spins };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['wallet']);
      queryClient.invalidateQueries(['transactions']);
      const parts = [];
      if (result.reward_ic > 0) parts.push(`+${result.reward_ic} IC`);
      if (result.reward_id > 0) parts.push(`+${result.reward_id} ID`);
      if (result.free_spins > 0) parts.push(`+${result.free_spins} Free Spins`);
      toast.success(`Voucher redeemed! ${parts.join(' ')}`);
      setCode('');
      onRedeemSuccess?.();
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
    redeemMutation.mutate(code.toUpperCase());
  };

  return (
    <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Ticket className="w-5 h-5 text-pink-400" />
        <h3 className="font-bold text-white">Redeem Voucher</h3>
      </div>
      
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter voucher code"
          disabled={redeemMutation.isPending}
          onKeyPress={(e) => e.key === 'Enter' && handleRedeem()}
          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
        />
        <Button
          onClick={handleRedeem}
          disabled={redeemMutation.isPending || !code.trim()}
          className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 shrink-0"
        >
          {redeemMutation.isPending ? 'Redeeming...' : 'Redeem'}
        </Button>
      </div>
      
      <p className="text-xs text-gray-400">Enter your voucher code to claim rewards</p>
    </div>
  );
}