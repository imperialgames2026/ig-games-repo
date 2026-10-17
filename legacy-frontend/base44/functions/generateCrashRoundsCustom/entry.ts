import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function fastHash(seed) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') +
         (h * 0x9e3779b9 >>> 0).toString(16).padStart(8, '0') +
         (h ^ (h >>> 16)).toString(16).padStart(8, '0') +
         (h * 0x85ebca6b >>> 0).toString(16).padStart(8, '0');
}

function generateSeed() {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('') + '-' + Date.now().toString(36);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // crashPoints: array of numbers (custom crash points)
    const crashPoints = body.crashPoints;
    if (!Array.isArray(crashPoints) || crashPoints.length === 0) {
      return Response.json({ error: 'crashPoints array required' }, { status: 400 });
    }
    if (crashPoints.length > 100) {
      return Response.json({ error: 'Max 100 rounds at a time' }, { status: 400 });
    }

    const existingRounds = await base44.asServiceRole.entities.CrashRound.list('-round_number', 1);
    const nextRoundNumber = (existingRounds[0]?.round_number || 0) + 1;

    const rounds = crashPoints.map((cp, i) => {
      const seed = generateSeed();
      const crashPoint = Math.max(1.00, Math.round(parseFloat(cp) * 100) / 100);
      return {
        round_number: nextRoundNumber + i,
        seed,
        hash: fastHash(seed),
        crash_point: crashPoint,
        status: 'pending',
        house_edge: 0.07
      };
    });

    await base44.asServiceRole.entities.CrashRound.bulkCreate(rounds);

    return Response.json({
      success: true,
      generated: rounds.length,
      starting_round: nextRoundNumber
    });
  } catch (error) {
    console.error('generateCrashRoundsCustom error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});