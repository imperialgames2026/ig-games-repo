import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current/next pending round
    const pendingRounds = await base44.asServiceRole.entities.CrashRound.filter(
      { status: 'pending' },
      'round_number',
      1
    );

    if (pendingRounds.length === 0) {
      // No pending rounds - need to generate more
      return Response.json({ 
        error: 'No rounds available',
        action: 'generate_more'
      }, { status: 503 });
    }

    const round = pendingRounds[0];

    // Mark as live
    await base44.asServiceRole.entities.CrashRound.update(round.id, {
      status: 'live',
      started_at: new Date().toISOString()
    });

    return Response.json({
      id: round.id,
      round_number: round.round_number,
      hash: round.hash, // Seed is hidden, only hash shown to players
      crash_point: round.crash_point,
      started_at: round.started_at
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});