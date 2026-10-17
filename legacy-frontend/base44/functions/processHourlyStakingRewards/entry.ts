import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (user?.role && user.role !== 'admin' && user.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const pools = await base44.asServiceRole.entities.StakingPool.filter({ key: 'main_pool' });
    let pool = pools[0];

    if (!pool) {
      pool = await base44.asServiceRole.entities.StakingPool.create({
        key: 'main_pool',
        total_staked_id: 0,
        base_hourly_rate: 0.0025,
        hourly_reward_budget: 0,
        total_rewards_paid: 0,
        active_stakers: 0,
      });
    }

    const positions = await base44.asServiceRole.entities.StakingPosition.filter({ status: 'active' });
    const activePositions = positions.filter((position) => (position.amount_id || 0) > 0);
    const totalStaked = activePositions.reduce((sum, position) => sum + (position.amount_id || 0), 0);
    const hourlyBudget = Number((totalStaked * (pool.base_hourly_rate || 0.0025)).toFixed(4));

    if (totalStaked <= 0 || activePositions.length === 0 || hourlyBudget <= 0) {
      await base44.asServiceRole.entities.StakingPool.update(pool.id, {
        total_staked_id: Number(totalStaked.toFixed(4)),
        active_stakers: activePositions.length,
        hourly_reward_budget: hourlyBudget,
        last_payout_at: new Date().toISOString(),
      });
      return Response.json({ success: true, paidPositions: 0, totalRewardsPaid: 0 });
    }

    let totalRewardsPaid = 0;

    for (const position of activePositions) {
      const reward = Number(((hourlyBudget * (position.amount_id || 0)) / totalStaked).toFixed(4));
      if (reward <= 0) continue;

      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: position.user_email });
      const wallet = wallets[0];
      if (!wallet) continue;

      await base44.asServiceRole.entities.UserWallet.update(wallet.id, {
        cat_dollars: Number(((wallet.cat_dollars || 0) + reward).toFixed(4)),
        total_staking_rewards: Number(((wallet.total_staking_rewards || 0) + reward).toFixed(4)),
        last_tx_type: 'bonus',
        last_tx_description: `Hourly staking reward paid: ${reward.toFixed(4)} ID`,
      });

      await base44.asServiceRole.entities.StakingPosition.update(position.id, {
        last_rewarded_at: new Date().toISOString(),
        total_rewards_paid: Number(((position.total_rewards_paid || 0) + reward).toFixed(4)),
      });

      await base44.asServiceRole.entities.Transaction.create({
        user_email: position.user_email,
        type: 'bonus',
        amount: 0,
        cat_dollars: reward,
        balance_after: wallet.tokens || 0,
        description: `Hourly staking reward`,
        notes: `Pool reward payout for ${Number(position.amount_id || 0).toFixed(2)} ID staked`,
        status: 'completed',
      }, {
        user: { email: position.user_email }
      });

      totalRewardsPaid += reward;
    }

    await base44.asServiceRole.entities.StakingPool.update(pool.id, {
      total_staked_id: Number(totalStaked.toFixed(4)),
      active_stakers: activePositions.length,
      hourly_reward_budget: hourlyBudget,
      total_rewards_paid: Number(((pool.total_rewards_paid || 0) + totalRewardsPaid).toFixed(4)),
      last_payout_at: new Date().toISOString(),
    });

    return Response.json({ success: true, paidPositions: activePositions.length, totalRewardsPaid: Number(totalRewardsPaid.toFixed(4)) });
  } catch (error) {
    console.error('processHourlyStakingRewards error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});