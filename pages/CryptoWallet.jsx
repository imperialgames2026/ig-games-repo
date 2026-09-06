import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import CryptoDepositPanel from '@/components/crypto/CryptoDepositPanel';
import CryptoWithdrawalPanel from '@/components/crypto/CryptoWithdrawalPanel';
import CryptoTransferList from '@/components/crypto/CryptoTransferList';

export default function CryptoWallet() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const { data: wallets = [] } = useQuery({
    queryKey: ['crypto-wallet', user?.email],
    queryFn: () => base44.entities.UserWallet.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['crypto-transfers', user?.email],
    queryFn: () => base44.entities.CryptoTransfer.filter({ user_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const wallet = wallets[0];
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0A0612]">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-black text-white mb-2">Crypto Wallet</h1>
          <p className="text-gray-400">Make crypto deposits, request crypto withdrawals, and track pending, confirmed, or failed status updates.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <CryptoDepositPanel user={user} />
          <CryptoWithdrawalPanel user={user} wallet={wallet} />
        </div>
        <CryptoTransferList transfers={transfers} />
      </div>
    </div>
  );
}