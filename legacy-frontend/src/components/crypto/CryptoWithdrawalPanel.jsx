import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoWithdrawalPanel({ user, wallet }) {
  const queryClient = useQueryClient();
  const kycRequired = user?.role !== 'admin' && user?.role !== 'superadmin';
  const needsKYC = kycRequired && user?.kyc_status !== 'approved';
  const [asset, setAsset] = useState('USDT');
  const [network, setNetwork] = useState('TRC20');
  const [address, setAddress] = useState('');
  const [amountID, setAmountID] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (needsKYC) {
        throw new Error('KYC required before withdrawal');
      }
      const amount = Number(amountID || 0);
      await base44.entities.CryptoTransfer.create({
        user_email: user.email,
        transfer_type: 'withdrawal',
        asset,
        network,
        wallet_address: address,
        amount_id: amount,
        status: 'awaiting_review',
        reference_code: `WDR-${Date.now()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crypto-transfers', user.email] });
      setAddress('');
      setAmountID('');
      toast.success('Withdrawal submitted for admin review.');
    },
  });

  return (
    <Card className="bg-[#1A1528] border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-green-400" /> Crypto Withdrawal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-400">Withdrawals require admin approval before any blockchain payout is sent.</p>
        {needsKYC && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-400">
            Complete KYC before requesting a withdrawal. <a href="/KYCVerification" className="text-pink-400 underline">Start KYC</a>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-white">Available IGUSD</Label>
          <p className="text-2xl font-black text-green-400">{(wallet?.cat_dollars || 0).toFixed(2)} IGUSD</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white">Asset</Label>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1A1528] border-white/10">
                <SelectItem value="BTC">BTC</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="SOL">SOL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white">Network</Label>
            <Input value={network} onChange={(e) => setNetwork(e.target.value)} className="bg-white/5 border-white/10 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-white">Wallet Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter your blockchain wallet address" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div className="space-y-2">
          <Label className="text-white">Amount in IGUSD</Label>
          <Input value={amountID} onChange={(e) => setAmountID(e.target.value)} type="number" placeholder="0.00" className="bg-white/5 border-white/10 text-white" />
        </div>
        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !address || !amountID || needsKYC} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700">
          {submitMutation.isPending ? 'Submitting...' : 'Request Withdrawal'}
        </Button>
      </CardContent>
    </Card>
  );
}