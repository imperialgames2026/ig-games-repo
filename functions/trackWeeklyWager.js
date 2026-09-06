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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_email, amount = 0, currency = 'IC' } = await req.json();
    const targetEmail = user_email || user.email;
    const weekKey = getWeekKey();
    const rows = await base44.asServiceRole.entities.WeeklyWager.filter({ user_email: targetEmail, week_key: weekKey }, '-created_date', 1);
    const current = rows[0];

    const currentIC = Number(current?.total_ic_wagered || 0);
    const currentID = Number(current?.total_id_wagered || 0);
    const nextIC = currency === 'IC' ? currentIC + Number(amount) : currentIC;
    const nextID = currency === 'ID' ? currentID + Number(amount) : currentID;
    const weeklyGoal = Number(current?.weekly_goal || 10000);
    const goalReached = nextIC >= weeklyGoal;
    const weeklyBonusAmount = goalReached ? Math.max(Number(current?.weekly_bonus_amount || 0), Math.floor(nextIC * 0.01)) : Number(current?.weekly_bonus_amount || 0);
    const rakebackAmount = Math.max(Number(current?.rakeback_amount || 0), Number((nextID * 0.02).toFixed(2)));

    if (current) {
      await base44.asServiceRole.entities.WeeklyWager.update(current.id, {
        total_ic_wagered: nextIC,
        total_id_wagered: nextID,
        goal_reached: goalReached,
        weekly_bonus_amount: weeklyBonusAmount,
        rakeback_amount: rakebackAmount,
      });
      return Response.json({ ok: true, updated: true, weekKey });
    }

    await base44.asServiceRole.entities.WeeklyWager.create({
      user_email: targetEmail,
      week_key: weekKey,
      total_ic_wagered: nextIC,
      total_id_wagered: nextID,
      weekly_goal: 10000,
      goal_reached: goalReached,
      weekly_bonus_amount: weeklyBonusAmount,
      rakeback_amount: rakebackAmount,
      reward_status: 'pending',
    });

    return Response.json({ ok: true, created: true, weekKey });
  } catch (error) {
    console.error('trackWeeklyWager error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});