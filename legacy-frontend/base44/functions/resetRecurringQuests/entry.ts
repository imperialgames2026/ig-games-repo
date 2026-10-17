import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getExpiry(questType, now = new Date()) {
  const current = new Date(now);

  if (questType === 'daily') {
    return new Date(Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate() + 1,
      0, 0, 0, 0,
    )).toISOString();
  }

  const day = current.getUTCDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const end = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate(),
    0, 0, 0, 0,
  ));
  end.setUTCDate(end.getUTCDate() + daysUntilNextMonday);
  return end.toISOString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const quests = await base44.asServiceRole.entities.Quest.list();
    const recurringQuests = quests.filter((quest) => quest.is_active && ['daily', 'weekly'].includes(quest.quest_type));
    const users = await base44.asServiceRole.entities.User.list();

    for (const appUser of users) {
      for (const quest of recurringQuests) {
        const existing = await base44.asServiceRole.entities.UserQuest.filter({
          user_email: appUser.email,
          quest_id: quest.id,
        });

        const activeRecord = existing.find((item) => item.expires_at && new Date(item.expires_at) > new Date());
        if (activeRecord) continue;

        await base44.asServiceRole.entities.UserQuest.create({
          user_email: appUser.email,
          quest_id: quest.id,
          progress: 0,
          is_completed: false,
          is_claimed: false,
          expires_at: getExpiry(quest.quest_type),
        }, {
          bypassRls: true,
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('resetRecurringQuests error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});