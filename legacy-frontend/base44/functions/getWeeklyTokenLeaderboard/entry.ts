import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function displayNameForUser(user, email) {
  if (user?.username) return user.username;
  if (user?.full_name) return user.full_name;
  return String(email || 'Player').split('@')[0] || 'Player';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weekStart = getWeekStart();
    const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 10000);
    const winsThisWeek = transactions.filter((transaction) => {
      const createdAt = new Date(transaction.created_date || 0);
      return transaction.type === 'win' && Number(transaction.amount) > 0 && createdAt >= weekStart;
    });

    const totalsByEmail = new Map();
    for (const transaction of winsThisWeek) {
      const email = transaction.user_email;
      if (!email) continue;
      totalsByEmail.set(email, (totalsByEmail.get(email) || 0) + Number(transaction.amount || 0));
    }

    const topEmails = [...totalsByEmail.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const users = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    const usersByEmail = new Map(users.map((appUser) => [appUser.email, appUser]));

    const leaderboard = topEmails.map(([email, totalWon], index) => {
      const leaderboardUser = usersByEmail.get(email);
      return {
        rank: index + 1,
        name: displayNameForUser(leaderboardUser, email),
        total_won: totalWon,
      };
    });

    return Response.json({
      success: true,
      week_start: weekStart.toISOString(),
      leaderboard,
    });
  } catch (error) {
    console.error('getWeeklyTokenLeaderboard error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});