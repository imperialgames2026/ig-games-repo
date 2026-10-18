import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { positionId } = await req.json();
    if (!positionId) {
      return Response.json({ error: 'Position is required' }, { status: 400 });
    }

    const positions = await base44.entities.StakingPosition.filter({ id: positionId, user_email: user.email });
    const position = positions[0];

    if (!position || position.status !== 'active') {
      return Response.json({ error: 'Active stake not found' }, { status: 404 });
    }

    const wallets = await base44.entities.UserWallet.filter({ user_email: user.email });
    const wallet = wallets[0];
    const pools = await base44.asServiceRole.entities.StakingPool.filter({ key: 'main_pool' });
    const pool = pools[0];

    if (!wallet || !pool) {
      return Response.json({ error: 'Missing staking data' }, { status: 404 });
    }

    const unstakeAmount = Number(position.amount_id || 0);

    await base44.entities.UserWallet.update(wallet.id, {
      cat_dollars: Number(((wallet.cat_dollars || 0) + unstakeAmount).toFixed(4)),
      staked_cat_dollars: Number(Math.max(0, (wallet.staked_cat_dollars || 0) - unstakeAmount).toFixed(4)),
      last_tx_type: 'bonus',
      last_tx_description: `Unlocked ${unstakeAmount.toFixed(2)} ID from staking`,
    });

    await base44.entities.StakingPosition.update(position.id, {
      status: 'unstaked',
      ended_at: new Date().toISOString(),
    });

    await base44.asServiceRole.entities.StakingPool.update(pool.id, {
      total_staked_id: Number(Math.max(0, (pool.total_staked_id || 0) - unstakeAmount).toFixed(4)),
      active_stakers: Math.max(0, (pool.active_stakers || 0) - 1),
      hourly_reward_budget: Number((Math.max(0, (pool.total_staked_id || 0) - unstakeAmount) * (pool.base_hourly_rate || 0.0025)).toFixed(4)),
    });

    await base44.asServiceRole.entities.Transaction.create({
      user_email: user.email,
      type: 'bonus',
      amount: 0,
      cat_dollars: unstakeAmount,
      balance_after: wallet.tokens || 0,
      description: `Unstaked ${unstakeAmount.toFixed(2)} ID`,
      notes: 'Imperial Dollars returned from staking pool',
      status: 'completed',
    }, {
      user: { email: user.email }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('unstakeImperialDollars error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});