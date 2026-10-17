import React from 'react';
import { Button } from '@/components/ui/button';

export default function StakingPositions({ positions, onUnstake, loadingId }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#151020]/90 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Active positions</h2>
          <p className="mt-1 text-sm text-gray-400">Manage each locked balance separately.</p>
        </div>
      </div>
      <div className="space-y-3">
        {positions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">No active staking positions yet.</div>
        ) : (
          positions.map((position) => (
            <div key={position.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-white">{Number(position.amount_id || 0).toFixed(2)} ID staked</p>
                <p className="text-sm text-gray-400">Earned: {Number(position.total_rewards_paid || 0).toFixed(4)} ID</p>
              </div>
              <Button
                variant="outline"
                onClick={() => onUnstake(position.id)}
                disabled={loadingId === position.id}
                className="rounded-2xl border-pink-500/30 bg-transparent text-pink-300 hover:bg-pink-500/10 hover:text-pink-200"
              >
                {loadingId === position.id ? 'Unlocking...' : 'Unstake'}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}