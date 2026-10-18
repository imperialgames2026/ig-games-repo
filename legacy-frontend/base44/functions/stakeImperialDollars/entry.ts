import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();
    const stakeAmount = Number(amount || 0);

    if (!stakeAmount || stakeAmount <= 0) {
      return Response.json({ error: 'Invalid stake amount' }, { status: 400 });
    }

    const wallets = await base44.entities.UserWallet.filter({ user_email: user.email });
    const wallet = wallets[0];

    if (!wallet) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if ((wallet.cat_dollars || 0) < stakeAmount) {
      return Response.json({ error: 'Not enough ID balance' }, { status: 400 });
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

    const nextWallet = {
      cat_dollars: Number(((wallet.cat_dollars || 0) - stakeAmount).toFixed(4)),
      staked_cat_dollars: Number(((wallet.staked_cat_dollars || 0) + stakeAmount).toFixed(4)),
      last_tx_type: 'bonus',
      last_tx_description: `Locked ${stakeAmount.toFixed(2)} ID into staking`,
    };

    await base44.entities.UserWallet.update(wallet.id, nextWallet);

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.StakingPosition.create({
      user_email: user.email,
      amount_id: stakeAmount,
      status: 'active',
      started_at: now,
      last_rewarded_at: now,
      total_rewards_paid: 0,
      reward_multiplier_snapshot: Math.max(1, Number(((pool.total_staked_id || 0) + stakeAmount).toFixed(4))),
    });

    await base44.asServiceRole.entities.StakingPool.update(pool.id, {
      total_staked_id: Number(((pool.total_staked_id || 0) + stakeAmount).toFixed(4)),
      active_stakers: (pool.active_stakers || 0) + 1,
      hourly_reward_budget: Number((((pool.total_staked_id || 0) + stakeAmount) * (pool.base_hourly_rate || 0.0025)).toFixed(4)),
    });

    await base44.asServiceRole.entities.Transaction.create({
      user_email: user.email,
      type: 'bonus',
      amount: 0,
      cat_dollars: -stakeAmount,
      balance_after: wallet.tokens || 0,
      description: `Staked ${stakeAmount.toFixed(2)} ID`,
      notes: 'Imperial Dollars locked into staking pool',
      status: 'completed',
    }, {
      user: { email: user.email }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('stakeImperialDollars error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});