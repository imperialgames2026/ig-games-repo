import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Shield, LockKeyhole, Coins, TrendingUp } from 'lucide-react';
import IGTSupplyStatCard from '@/components/admin/IGTSupplyStatCard';
import IGTSupplyBar from '@/components/admin/IGTSupplyBar';

const TOTAL_SUPPLY = 12000000000;
const LOCKED_SUPPLY = 6000000000;

const formatIGT = (value) => `${Number(value || 0).toLocaleString()} IGT`;

export default function AdminIGTSupply() {
  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['admin-igt-user'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-igt-supply'],
    queryFn: async () => {
      const [configs, pools] = await Promise.all([
        base44.entities.TokenConfig.filter({ token_type: 'IGT' }),
        base44.entities.StakingPool.filter({ key: 'main_pool' }),
      ]);
      return { config: configs[0], pool: pools[0] };
    },
    enabled: isAdmin,
  });

  if (loadingUser) {
    return <div className="min-h-screen bg-[#0A0612] p-6 text-white">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0612] p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-red-300" />
          <h1 className="text-2xl font-black">Admin Access Required</h1>
          <p className="mt-2 text-white/60">Only admins can view the IGT supply dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen bg-[#0A0612] p-6 text-white">Loading…</div>;
  }

  const config = data?.config || {};
  const pool = data?.pool || {};
  const totalSupply = config.max_supply || TOTAL_SUPPLY;
  const lockedSupply = config.locked_supply || LOCKED_SUPPLY;
  const staked = pool.total_staked_igt || config.total_staked || 0;
  const lockedPercent = totalSupply ? (lockedSupply / totalSupply) * 100 : 0;
  const stakedPercent = totalSupply ? (staked / totalSupply) * 100 : 0;
  const liquidPercent = Math.max(0, 100 - lockedPercent - stakedPercent);

  return (
    <div className="min-h-screen bg-[#0A0612] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/15 via-white/[0.04] to-purple-500/10 p-6 shadow-2xl shadow-pink-950/30 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1 text-sm font-bold text-pink-200">
                <Shield className="h-4 w-4" /> Admin IGT Treasury View
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">IGT Supply Dashboard</h1>
              <p className="mt-3 max-w-2xl text-white/60">A simple admin view of the 6 billion locked IGT allocation against the 12 billion total supply, including active player staking.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-right">
              <p className="text-sm text-white/50">Active Stakers</p>
              <p className="text-3xl font-black text-pink-200 tabular-nums">{pool.active_stakers || 0}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <IGTSupplyStatCard label="Total Supply" value={formatIGT(totalSupply)} helper="Maximum native token supply." accent="pink" />
          <IGTSupplyStatCard label="Locked Supply" value={formatIGT(lockedSupply)} helper="Reserved and locked allocation." accent="amber" />
          <IGTSupplyStatCard label="Currently Staked" value={formatIGT(staked)} helper="IGT staked by active players." accent="violet" />
          <IGTSupplyStatCard label="Treasury Vault" value={formatIGT(config.treasury_vault)} helper="Current tracked IGT treasury balance." accent="emerald" />
        </div>

        <IGTSupplyBar lockedPercent={lockedPercent} stakedPercent={stakedPercent} liquidPercent={liquidPercent} />

        <section className="grid gap-4 md:grid-cols-3">
          <Metric icon={LockKeyhole} label="Locked vs Total" value={`${lockedPercent.toFixed(2)}%`} />
          <Metric icon={TrendingUp} label="Staked vs Total" value={`${stakedPercent.toFixed(4)}%`} />
          <Metric icon={Coins} label="Next Payout" value={formatIGT(pool.next_payout_amount || config.next_payout_amount)} />
        </section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <Icon className="mb-4 h-6 w-6 text-pink-300" />
      <p className="text-sm text-white/55">{label}</p>
      <p className="mt-2 text-2xl font-black text-white tabular-nums">{value}</p>
    </div>
  );
}