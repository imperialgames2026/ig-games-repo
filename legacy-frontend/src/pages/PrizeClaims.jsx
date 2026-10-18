import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Gift, ShieldCheck, Wallet, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const statusStyles = {
  submitted: 'bg-yellow-500/20 text-yellow-300',
  kyc_required: 'bg-orange-500/20 text-orange-300',
  under_review: 'bg-blue-500/20 text-blue-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300'
};

export default function PrizeClaims() {
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [prizeCategory, setPrizeCategory] = useState('crypto');
  const [network, setNetwork] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin(window.location.href));
  }, []);

  const { data: claims = [] } = useQuery({
    queryKey: ['prize-claims', user?.email],
    queryFn: () => base44.entities.PrizeClaim.filter({ user_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) return;
    if (user.kyc_status !== 'approved') {
      setError('Please complete KYC before submitting a prize claim.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (prizeCategory === 'crypto' && !walletAddress.trim()) {
      setError('Enter a wallet address for crypto prize delivery.');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.PrizeClaim.create({
        user_email: user.email,
        claim_type: 'sweepstakes_prize',
        prize_category: prizeCategory,
        amount: Number(amount),
        currency: prizeCategory === 'crypto' ? 'CRYPTO' : 'USD',
        wallet_address: walletAddress,
        network,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      });
      setAmount('');
      setWalletAddress('');
      setNetwork('');
      queryClient.invalidateQueries({ queryKey: ['prize-claims', user?.email] });
    } catch (err) {
      setError(err.message || 'Unable to submit prize claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0612] py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-3">Prize Claims</h1>
          <p className="text-gray-400">Submit and track sweepstakes prize claims with a full audit trail.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-[#1A1528] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Gift className="w-5 h-5 text-pink-400" /> Submit Claim</CardTitle>
              <CardDescription className="text-gray-400">Crypto and cash-equivalent claims are recorded here.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {user?.kyc_status !== 'approved' && (
                  <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-yellow-300 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> KYC must be approved before prize fulfillment.</div>
                    <a href="/KYCVerification"><Button type="button" className="bg-gradient-to-r from-pink-500 to-pink-600"><ShieldCheck className="w-4 h-4 mr-2" /> Complete KYC</Button></a>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Amount</label>
                  <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Prize Type</label>
                  <Select value={prizeCategory} onValueChange={setPrizeCategory}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1528] border-white/10">
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="cash_equivalent">Cash Equivalent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {prizeCategory === 'crypto' && (
                  <>
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Network</label>
                      <Input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="BTC, ETH, SOL, TRON..." className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Wallet Address</label>
                      <Input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Paste wallet address" className="bg-white/5 border-white/10 text-white" />
                    </div>
                  </>
                )}

                {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300">{error}</div>}

                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                  {submitting ? 'Submitting...' : 'Submit Prize Claim'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1528] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-pink-400" /> Claim History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {claims.length === 0 ? (
                <p className="text-gray-400">No claims yet.</p>
              ) : claims.map((claim) => (
                <div key={claim.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">{claim.prize_category === 'crypto' ? 'Crypto Prize' : 'Cash Equivalent'} · {claim.amount}</p>
                    <p className="text-xs text-gray-400">{format(new Date(claim.created_date), 'MMM d, yyyy h:mm a')}</p>
                    {claim.wallet_address && <p className="text-xs text-gray-500 break-all mt-1">{claim.wallet_address}</p>}
                  </div>
                  <Badge className={statusStyles[claim.status] || 'bg-white/10 text-white'}>{claim.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}