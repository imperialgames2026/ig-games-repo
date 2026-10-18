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

    const { user_email, amount = 0, currency = 'IC', displayName } = await req.json();
    const targetEmail = user_email || user.email;
    const weekKey = getWeekKey();

    const tournaments = await base44.asServiceRole.entities.WeeklyTournament.filter({ status: 'active' });
    const tournament = tournaments?.[0];
    if (!tournament) {
      return Response.json({ ok: true, skipped: true, reason: 'no active tournament' });
    }

    const rows = await base44.asServiceRole.entities.WeeklyWager.filter({ tournament_id: tournament.id, user_email: targetEmail }, '-created_date', 1);
    const current = rows[0];

    const currentTotal = Number(current?.total_wagered || 0);
    const currentID = Number(current?.total_id_wagered || 0);
    const nextIC = currency === 'IC' ? currentTotal + Number(amount) : currentTotal;
    const nextID = currency === 'ID' ? currentID + Number(amount) : currentID;

    if (current) {
      await base44.asServiceRole.entities.WeeklyWager.update(current.id, {
        total_wagered: nextIC,
        total_id_wagered: nextID,
        display_name: displayName || current.display_name || user.full_name || user.email,
        last_updated: new Date().toISOString(),
      });
      return Response.json({ ok: true, updated: true, weekKey, tournamentId: tournament.id });
    }

    await base44.asServiceRole.entities.WeeklyWager.create({
      tournament_id: tournament.id,
      user_email: targetEmail,
      display_name: displayName || user.full_name || user.email,
      total_wagered: nextIC,
      total_id_wagered: nextID,
      last_updated: new Date().toISOString(),
    });

    return Response.json({ ok: true, created: true, weekKey });
  } catch (error) {
    console.error('trackWeeklyWager error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});