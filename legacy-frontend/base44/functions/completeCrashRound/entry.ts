import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roundId } = body;

    if (!roundId) {
      return Response.json({ error: 'roundId required' }, { status: 400 });
    }

    // Mark round as completed
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.CrashRound.update(roundId, {
      status: 'completed',
      ended_at: now
    });

    // Check if we're running low on pending rounds, trigger generation if needed
    const pendingCount = await base44.asServiceRole.entities.CrashRound.filter({ status: 'pending' });
    
    if (pendingCount.length < 50) {
      // Trigger generation in background (you could use a scheduled task for this)
      // For now, just log it - in production use a queue or trigger function
      console.log('Low on pending crash rounds, consider running generateCrashRounds');
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});