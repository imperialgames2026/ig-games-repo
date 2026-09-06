import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { toast } from '@/components/ui/use-toast';
import StakingHero from '@/components/staking/StakingHero';
import StakingStats from '@/components/staking/StakingStats';
import StakingForm from '@/components/staking/StakingForm';
import StakingPositions from '@/components/staking/StakingPositions';
import TokenTransparency from '@/components/staking/TokenTransparency';

export default function Staking() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState('');
  const [unstakingId, setUnstakingId] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['staking-dashboard'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getStakingDashboard', {});
      return response.data;
    },
  });

  const { data: tokenConfig } = useQuery({
    queryKey: ['token-config-igt'],
    queryFn: async () => {
      const configs = await base44.entities.TokenConfig.filter({ token_type: 'IGT' });
      return configs[0];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staking-dashboard'] });

  const stakeMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('stakeImperialTokens', { amount: Number(amount) });
      return response.data;
    },
    onSuccess: () => {
      setAmount('');
      refresh();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Stake created', description: 'Your IGT is now earning hourly rewards.' });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: async (positionId) => {
      const response = await base44.functions.invoke('unstakeImperialTokens', { positionId });
      return response.data;
    },
    onMutate: (positionId) => setUnstakingId(positionId),
    onSuccess: () => {
      setUnstakingId(null);
      refresh();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Stake released', description: 'Your IGT has been returned to your wallet.' });
    },
    onSettled: () => setUnstakingId(null),
  });

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="min-h-screen bg-[#0A0612] px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <StakingHero />
          <TokenTransparency tokenConfig={tokenConfig} />
          <StakingStats stats={data?.stats} pool={data?.pool} wallet={data?.wallet} />
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <StakingForm
              amount={amount}
              setAmount={setAmount}
              onStake={() => stakeMutation.mutate()}
              loading={stakeMutation.isPending}
              available={data?.wallet?.igt_tokens}
            />
            <StakingPositions
              positions={data?.positions || []}
              onUnstake={(positionId) => unstakeMutation.mutate(positionId)}
              loadingId={unstakingId}
            />
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}