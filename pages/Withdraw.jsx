import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Wallet, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400',    icon: CheckCircle },
  paid:     { label: 'Paid',     color: 'bg-green-500/20 text-green-400',  icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400',      icon: XCircle },
};

export default function Withdraw() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const u = await base44.auth.me();
        if (!u) { base44.auth.redirectToLogin(); return; }
        setUser(u);
      } catch (e) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallet-withdraw', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ['withdrawal-requests', user?.email],
    queryFn: () => base44.entities.WithdrawalRequest.filter({ user_email: user?.email }, '-created_date', 20),
    enabled: !!user?.email,
  });

  // Check if user has ever paid with crypto
  const { data: cryptoTxns = [] } = useQuery({
    queryKey: ['crypto-txns', user?.email],
    queryFn: () => base44.entities.Transaction.filter({ user_email: user?.email, payment_method: 'crypto' }, '-created_date', 1),
    enabled: !!user?.email,
  });

  const hasPaidWithCrypto = cryptoTxns.length > 0;

  const wallet = wallets[0];
  const kycRequired = user?.role !== 'admin' && user?.role !== 'superadmin';
  const needsKYC = kycRequired && user?.kyc_status !== 'approved';

  const submitMutation = useMutation({
    mutationFn: async ({ amount, paymentMethod, paymentDetails }) => {
      // Deduct balance first
      await base44.entities.UserWallet.update(wallet.id, {
        cat_dollars: wallet.cat_dollars - amount,
      });
      // Create withdrawal request
      return base44.entities.WithdrawalRequest.create({
        user_email: user.email,
        user_name: user.full_name || user.email,
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wallet-withdraw']);
      queryClient.invalidateQueries(['withdrawal-requests']);
      setSuccess('Withdrawal request submitted! We will process it within 1-3 business days.');
      setAmount('');
      setPaymentMethod('');
      setPaymentDetails('');
    },
    onError: (err) => {
      setError(err.message || 'Failed to submit request. Please try again.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amt = parseFloat(amount);
    if (needsKYC) return setError('Identity verification is required before you can request a withdrawal.');
    if (!amt || amt <= 0) return setError('Please enter a valid amount.');
    if (amt < 100) return setError('Minimum withdrawal is $100.00 ID.');
    if (amt > (wallet?.cat_dollars || 0)) return setError('Insufficient Imperial Dollars balance.');
    
    // Check 3x wager requirement
    const wagerRequired = wallet?.total_deposited * 3;
    if ((wallet?.total_wagered || 0) < wagerRequired) {
      const remainingWager = wagerRequired - (wallet?.total_wagered || 0);
      return setError(`You must wager $${remainingWager.toFixed(2)} more before withdrawing. Total wagering requirement: 3x your deposits.`);
    }
    
    if (!paymentMethod) return setError('Please select a payment method.');
    if (!paymentDetails.trim()) return setError('Please enter your payment details.');

    submitMutation.mutate({ amount: amt, paymentMethod, paymentDetails });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0A0612]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Withdraw Funds</h1>
          <p className="text-gray-400">Request a payout of your Imperial Dollar (ID). Imperial Coin is not withdrawable.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card className="bg-[#1A1528] border-white/10">
              <CardHeader>
                <CardTitle className="text-white">New Withdrawal Request</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {needsKYC && (
                    <Alert className="border-yellow-500/20 bg-yellow-500/5">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-yellow-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <span>You must complete KYC before submitting a withdrawal request.</span>
                        <div className="flex flex-wrap gap-2">
                          <a href="/KYCVerification" className="inline-flex">
                            <Button type="button" className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">Start KYC</Button>
                          </a>
                          <a href="/PrizeClaims" className="inline-flex">
                            <Button type="button" variant="outline">Prize Claims</Button>
                          </a>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label className="text-white">Amount (Imperial Dollar)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="10"
                        step="0.01"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <p className="text-sm text-gray-400">
                      Available: <span className="text-pink-400 font-bold">${(wallet?.cat_dollars || 0).toFixed(2)} ID</span> · Min: $100.00 ID
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1528] border-white/10">
                        <SelectItem value="bank_transfer">Bank Transfer / Debit Card</SelectItem>
                        {hasPaidWithCrypto && (
                          <SelectItem value="crypto">Cryptocurrency</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {!hasPaidWithCrypto && (
                      <p className="text-xs text-gray-500">Crypto withdrawal is only available if you have previously deposited using crypto.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">
                      {paymentMethod === 'crypto' ? 'Crypto Wallet Address & Network' : 'Bank / Card Details'}
                    </Label>
                    <Textarea
                      placeholder={
                        paymentMethod === 'crypto'
                          ? 'e.g. 0x1234...abcd (ETH / BTC / USDT — specify network)'
                          : 'e.g. Bank name, account number, routing number, or Zelle/Venmo handle'
                      }
                      value={paymentDetails}
                      onChange={(e) => setPaymentDetails(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[80px]"
                    />
                  </div>

                  {error && (
                    <Alert className="border-red-500/20 bg-red-500/5">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <AlertDescription className="text-red-400">{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert className="border-green-500/20 bg-green-500/5">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription className="text-green-400">{success}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={submitMutation.isPending || needsKYC}
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-bold h-12"
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Withdrawal Request'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Wallet className="w-5 h-5" />
                  Your Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 mb-1">Imperial Dollar (withdrawable)</p>
                <p className="text-3xl font-bold text-pink-400">${(wallet?.cat_dollars || 0).toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1528] border-white/10">
              <CardHeader>
                <CardTitle className="text-sm text-white">Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><p className="text-gray-400">Exchange rate</p><p className="text-green-400 font-bold">1 ID = $1.00 USD</p></div>
                <div><p className="text-gray-400">Minimum withdrawal</p><p className="text-white font-medium">$100.00 ID</p></div>
                <div><p className="text-gray-400">Wager requirement</p><p className="text-white font-medium">3x deposits</p></div>
                <div><p className="text-gray-400">Total wagered</p><p className="text-white font-medium">${(wallet?.total_wagered || 0).toFixed(2)}</p></div>
                <div><p className="text-gray-400">Processing time</p><p className="text-white font-medium">1-3 business days</p></div>
                <div><p className="text-gray-400">IC withdrawable?</p><p className="text-white font-medium">No — ID only</p></div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Past Requests */}
        {myRequests.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">My Withdrawal History</h2>
            <div className="space-y-3">
              {myRequests.map((req) => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <Card key={req.id} className="bg-[#1A1528] border-white/10">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <Icon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-white font-bold">${req.amount.toFixed(2)} ID</p>
                          <p className="text-gray-400 text-sm capitalize">{req.payment_method?.replace('_', ' ')} · {format(new Date(req.created_date), 'MMM d, yyyy')}</p>
                          {req.admin_note && <p className="text-gray-300 text-xs mt-1 italic">Note: {req.admin_note}</p>}
                        </div>
                      </div>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}