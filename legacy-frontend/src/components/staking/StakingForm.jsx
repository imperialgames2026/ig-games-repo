import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function StakingForm({ amount, setAmount, onStake, loading, available }) {
  return (
    <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-[#1A1528] to-[#120d1d] p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white">Stake your IGT</h2>
        <p className="mt-2 text-sm text-gray-400">Available to lock: {Number(available || 0).toFixed(2)} IGT</p>
      </div>
      <div className="space-y-4">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter IGT amount"
          className="h-14 rounded-2xl border-white/10 bg-black/20 text-lg text-white"
        />
        <Button onClick={onStake} disabled={loading} className="h-12 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 text-base font-bold hover:from-pink-600 hover:to-pink-700">
          {loading ? 'Locking stake...' : 'Lock IGT into staking'}
        </Button>
      </div>
    </div>
  );
}