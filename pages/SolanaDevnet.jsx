import React from 'react';
import DevnetWalletPanel from '@/components/solana/DevnetWalletPanel';

export default function SolanaDevnet() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-bold text-white">Imperial Games — Solana Devnet</h1>
      <p className="text-gray-300">
        Connect a wallet to view test-network balances. This does not link a wallet
        to your casino account, transfer assets, or credit your Supabase balance.
      </p>
      <DevnetWalletPanel />
    </main>
  );
}
