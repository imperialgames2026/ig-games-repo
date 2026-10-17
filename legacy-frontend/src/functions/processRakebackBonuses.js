/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const getWeekKey = (date = new Date()) => {
  const temp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const weekKey = getWeekKey();
    const weeklyRows = await base44.asServiceRole.entities.WeeklyWager.filter({ week_key: weekKey, reward_status: 'pending' }, '-created_date', 500);
    let creditedCount = 0;

    for (const row of weeklyRows) {
      const walletRows = await base44.asServiceRole.entities.UserWallet.filter({ user_email: row.user_email }, '-created_date', 1);
      const wallet = walletRows[0];
      if (!wallet) continue;

      const weeklyBonusAmount = Number(row.weekly_bonus_amount || 0);
      const rakebackAmount = Number(row.rakeback_amount || 0);

      if (weeklyBonusAmount === 0 && rakebackAmount === 0) {
        await base44.asServiceRole.entities.WeeklyWager.update(row.id, {
          reward_status: 'credited',
          credited_at: new Date().toISOString(),
        });
        continue;
      }

      await base44.asServiceRole.entities.UserWallet.update(wallet.id, {
        tokens: (wallet.tokens || 0) + weeklyBonusAmount,
        cat_dollars: (wallet.cat_dollars || 0) + rakebackAmount,
      });

      if (weeklyBonusAmount > 0) {
        await base44.asServiceRole.entities.Transaction.create({
          user_email: row.user_email,
          type: 'weekly_bonus',
          amount: weeklyBonusAmount,
          cat_dollars: 0,
          description: `Weekly bonus credited for ${weekKey}`,
          status: 'completed',
          reference_id: row.id,
        });
      }

      if (rakebackAmount > 0) {
        await base44.asServiceRole.entities.Transaction.create({
          user_email: row.user_email,
          type: 'rakeback',
          amount: 0,
          cat_dollars: rakebackAmount,
          description: `Weekly rakeback credited for ${weekKey}`,
          status: 'completed',
          reference_id: row.id,
        });
      }

      await base44.asServiceRole.entities.WeeklyWager.update(row.id, {
        reward_status: 'credited',
        credited_at: new Date().toISOString(),
      });

      creditedCount += 1;
    }

    return Response.json({ ok: true, weekKey, creditedCount });
  } catch (error) {
    console.error('processRakebackBonuses error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});