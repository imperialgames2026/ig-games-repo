import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [wallets, positions, pools] = await Promise.all([
      base44.entities.UserWallet.filter({ user_email: user.email }),
      base44.entities.StakingPosition.filter({ user_email: user.email }),
      base44.asServiceRole.entities.StakingPool.filter({ key: 'main_pool' }),
    ]);

    const wallet = wallets[0] || null;
    const pool = pools[0] || {
      total_staked_id: 0,
      base_hourly_rate: 0.0025,
      hourly_reward_budget: 0,
      total_rewards_paid: 0,
      active_stakers: 0,
    };

    const activePositions = positions
      .filter((position) => position.status === 'active')
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

    const userActiveStake = activePositions.reduce((sum, position) => sum + (position.amount_id || 0), 0);
    const estimatedNextHourlyReward = pool.total_staked_id > 0
      ? Number((((pool.hourly_reward_budget || 0) * userActiveStake) / pool.total_staked_id).toFixed(4))
      : 0;

    return Response.json({
      wallet,
      pool,
      positions: activePositions,
      stats: {
        userActiveStake,
        estimatedNextHourlyReward,
        ownershipPercent: pool.total_staked_id > 0 ? Number(((userActiveStake / pool.total_staked_id) * 100).toFixed(2)) : 0,
      }
    });
  } catch (error) {
    console.error('getStakingDashboard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});