import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Log an IGT ledger event: stake, unstake, burn, payout, house-recovered wagers, admin adjustments
 * Updates TokenConfig balances and creates an immutable ledger record
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      event_type,      // stake, unstake, burn, staking_payout, house_wager_recovered, admin_adjustment
      from_account,    // treasury, user, pool, house, etc.
      to_account,      // treasury, user, pool, house, etc.
      user_email,      // optional, if user-specific
      amount,          // IGT amount
      description,     // human-readable text
    } = payload;

    if (!event_type || !from_account || !to_account || amount === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch current TokenConfig for IGT
    const configs = await base44.asServiceRole.entities.TokenConfig.filter({ token_type: 'IGT' });
    let config = configs[0];

    if (!config) {
      return Response.json({ error: 'IGT TokenConfig not found' }, { status: 404 });
    }

    // Calculate deltas based on event_type
    let treasuryDelta = 0,
      stakedDelta = 0,
      burnedDelta = 0,
      houseDelta = 0;

    if (event_type === 'stake') {
      // User staking: treasury → staked pool
      treasuryDelta = -amount;
      stakedDelta = amount;
    } else if (event_type === 'unstake') {
      // User unstaking: staked pool → treasury
      treasuryDelta = amount;
      stakedDelta = -amount;
    } else if (event_type === 'burn') {
      // Burning (1% unstake fee): out of circulation
      treasuryDelta = -amount; // removed from treasury
      burnedDelta = amount;    // added to burned total
      stakedDelta = -amount;   // removed from staked
    } else if (event_type === 'staking_payout') {
      // Hourly rewards: treasury → users (via staked pool increase)
      treasuryDelta = -amount;
      stakedDelta = amount;
    } else if (event_type === 'house_wager_recovered') {
      // House edge / wager returns: add to house ecosystem
      houseDelta = amount;
      // treasury stays same, but house track increases
    } else if (event_type === 'admin_adjustment') {
      // Admin can adjust treasury directly
      treasuryDelta = from_account === 'treasury' ? -amount : amount;
    }

    // Update TokenConfig
    const updatedConfig = {
      treasury_vault: Math.max(0, (config.treasury_vault || 0) + treasuryDelta),
      total_staked: Math.max(0, (config.total_staked || 0) + stakedDelta),
      total_burned: Math.max(0, (config.total_burned || 0) + burnedDelta),
      total_house_wager_recovered: Math.max(0, (config.total_house_wager_recovered || 0) + houseDelta),
    };

    await base44.asServiceRole.entities.TokenConfig.update(config.id, updatedConfig);

    // Create immutable ledger record
    await base44.asServiceRole.entities.IGTLedger.create({
      event_type,
      from_account,
      to_account,
      user_email: user_email || null,
      amount,
      treasury_delta: treasuryDelta,
      staked_delta: stakedDelta,
      burned_delta: burnedDelta,
      house_delta: houseDelta,
      treasury_balance_after: updatedConfig.treasury_vault,
      staked_total_after: updatedConfig.total_staked,
      burned_total_after: updatedConfig.total_burned,
      house_total_after: updatedConfig.total_house_wager_recovered,
      description: description || `${event_type} event: ${amount} IGT moved from ${from_account} to ${to_account}`,
    });

    console.log(`IGT Ledger logged: ${event_type} | ${amount} IGT | ${description || ''}`);

    return Response.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('logIGTLedgerEvent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});