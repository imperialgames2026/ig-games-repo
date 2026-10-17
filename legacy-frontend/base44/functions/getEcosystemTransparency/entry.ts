import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetch comprehensive IGT ecosystem transparency data for dashboard display
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch TokenConfig for IGT
    const [configs, ledgerEntries, pools] = await Promise.all([
      base44.entities.TokenConfig.filter({ token_type: 'IGT' }),
      base44.asServiceRole.entities.IGTLedger.list('-created_date', 100), // Recent ledger
      base44.asServiceRole.entities.StakingPool.filter({ key: 'main_pool' }),
    ]);

    const config = configs[0] || {
      max_supply: 12000000000,
      treasury_vault: 6000000000,
      locked_supply: 6000000000,
      locked_until: '2028-05-23T00:00:00-04:00',
      total_staked: 0,
      total_burned: 0,
      total_house_wager_recovered: 0,
      next_payout_amount: 0,
    };

    const pool = pools[0] || {
      total_staked_igt: 0,
      total_burned_igt: 0,
      next_payout_amount: 0,
      active_stakers: 0,
    };

    const circulatingCap = Math.max(config.max_supply - config.locked_supply, 0);
    const lockedPercent = config.max_supply ? (config.locked_supply / config.max_supply) * 100 : 0;

    return Response.json({
      config,
      pool,
      stats: {
        max_supply: config.max_supply,
        locked_supply: config.locked_supply,
        locked_until: config.locked_until,
        locked_percent: lockedPercent,
        treasury_vault: config.treasury_vault,
        total_staked: config.total_staked,
        total_burned: config.total_burned,
        total_house_wager_recovered: config.total_house_wager_recovered,
        circulating_cap: circulatingCap,
        next_payout_amount: config.next_payout_amount,
        active_stakers: pool.active_stakers,
      },
      recent_ledger: ledgerEntries.slice(0, 50),
    });
  } catch (error) {
    console.error('getEcosystemTransparency error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});