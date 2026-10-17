import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Copy, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const DEPOSIT_ADDRESSES = {
  BTC: { network: 'Bitcoin', address: 'bc1qimperialgamingvaultbtc0000000000000000' },
  ETH: { network: 'Ethereum', address: '0xImperialGamingVaultEth000000000000000000' },
  USDT: { network: 'TRC20', address: 'TImperialGamingVaultUsdt00000000000000000' },
  USDC: { network: 'Ethereum', address: '0xImperialGamingVaultUsdc0000000000000000' },
  SOL: { network: 'Solana', address: 'ImperialGamingVaultSol1111111111111111111' },
};

export default function CryptoDepositPanel({ user }) {
  const queryClient = useQueryClient();
  const [asset, setAsset] = useState('USDT');
  const [amountID, setAmountID] = useState('');
  const [txHash, setTxHash] = useState('');
  const depositConfig = useMemo(() => DEPOSIT_ADDRESSES[asset], [asset]);

  const submitMutation = useMutation({
    mutationFn: () => base44.entities.CryptoTransfer.create({
      user_email: user.email,
      transfer_type: 'deposit',
      asset,
      network: depositConfig.network,
      wallet_address: depositConfig.address,
      tx_hash: txHash,
      amount_id: Number(amountID || 0),
      status: txHash ? 'pending' : 'awaiting_review',
      reference_code: `DEP-${Date.now()}`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crypto-transfers', user.email] });
      setAmountID('');
      setTxHash('');
      toast.success('Deposit submitted for tracking.');
    },
  });

  return (
    <Card className="bg-[#1A1528] border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-pink-400" /> Crypto Deposit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
          <p className="text-xs text-gray-400">Network</p>
          <p className="text-white font-bold">{depositConfig.network}</p>
          <p className="text-xs text-gray-400 mt-2">Deposit Address</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-pink-300 break-all flex-1">{depositConfig.address}</p>
            <Button type="button" size="icon" variant="outline" className="border-white/10" onClick={() => { navigator.clipboard.writeText(depositConfig.address); toast.success('Address copied'); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Expected IGUSD Credit</Label>
          <Input value={amountID} onChange={(e) => setAmountID(e.target.value)} type="number" placeholder="0.00" className="bg-white/5 border-white/10 text-white" />
        </div>

        <div className="space-y-2">
          <Label className="text-white">Transaction Hash</Label>
          <Input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="Paste blockchain tx hash after sending" className="bg-white/5 border-white/10 text-white" />
        </div>

        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !amountID} className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
          {submitMutation.isPending ? 'Submitting...' : 'Submit Deposit'}
        </Button>
      </CardContent>
    </Card>
  );
}