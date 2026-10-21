import React, { useEffect, useState, useRef } from 'react';
import { currentIdentity } from '@/lib/supabaseIdentity';
import { supabase } from '@/lib/supabaseClient';
import { createSweepstakesRequests } from '@/lib/sweepstakesRequests';
const requests=createSweepstakesRequests(supabase);
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
  const pending=useRef(null);
  const [success,setSuccess]=useState('');
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [prizeCategory, setPrizeCategory] = useState('crypto');
  const [network, setNetwork] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    currentIdentity().then(setUser).catch(e=>setError(e.message));
  }, []);

  const { data: claims = [], error: historyError, isLoading: historyLoading } = useQuery({
    queryKey: ['prize-claims', user?.id],
    queryFn: () => requests.list('claim'),
    enabled: !!user?.email
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      const input={amount,prize_category:prizeCategory,network,wallet_address:walletAddress};
      if(!pending.current||JSON.stringify(pending.current.input)!==JSON.stringify(input))pending.current={id:crypto.randomUUID(),input};
      const row=await requests.submit('claim',input,pending.current.id);
      pending.current=null;
      setSuccess('Claim '+row.id+' submitted for review. No funds have been reserved or sent.');
      setAmount('');
      setWalletAddress('');
      setNetwork('');
      queryClient.invalidateQueries({ queryKey: ['prize-claims', user?.id] });
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
              <CardDescription className="text-gray-400">Requests are reviewed for entitlement and delivery details. Submission does not approve a prize or send funds.</CardDescription>
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
                  <label htmlFor="claim-amount" className="text-sm text-gray-300 mb-2 block">Amount</label>
                  <Input id="claim-amount" disabled={submitting} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-2 block">Prize Type</label>
                  <Select disabled={submitting} value={prizeCategory} onValueChange={setPrizeCategory}>
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
                      <label htmlFor="claim-network" className="text-sm text-gray-300 mb-2 block">Network</label>
                      <Input id="claim-network" disabled={submitting} value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="BTC, ETH, SOL, TRON..." className="bg-white/5 border-white/10 text-white" />
                    </div>
                    <div>
                      <label htmlFor="claim-address" className="text-sm text-gray-300 mb-2 block">Wallet Address</label>
                      <Input id="claim-address" disabled={submitting} value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="Paste wallet address" className="bg-white/5 border-white/10 text-white" />
                    </div>
                  </>
                )}

                {error && <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-300">{error}</div>}

                {success && <p role="status" className="text-green-300">{success}</p>}
                <Button type="submit" disabled={submitting || !user || user.kyc_status!=='approved' || user.role==='tester' || user.is_excluded} className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
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
              {historyError && <p role="alert">{historyError.message}</p>}
              {historyLoading && <p className="text-gray-400">Loading claims…</p>}
              {!historyError && !historyLoading && claims.length === 0 ? (
                <p className="text-gray-400">No claims yet.</p>
              ) : claims.map((claim) => (
                <div key={claim.id} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400 break-all">Reference: {claim.id}</p>
                    <p className="text-white font-semibold">{claim.prize_category === 'crypto' ? 'Crypto Prize' : 'Cash Equivalent'} · {claim.amount}</p>
                    <p className="text-xs text-gray-400">{format(new Date(claim.created_at), 'MMM d, yyyy h:mm a')}</p>
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