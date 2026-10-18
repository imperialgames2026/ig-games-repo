import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateSeed() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${crypto.randomUUID()}-${hex}-${Date.now().toString(36)}`;
}

function cryptoRandoms(count) {
  const buf = new Uint32Array(count);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(v => v / (0xFFFFFFFF + 1));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet, mines_count = 3, currency = 'IC' } = await req.json();

    if (!bet || bet <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });
    if (mines_count < 1 || mines_count > 24) return Response.json({ error: 'Invalid mines count' }, { status: 400 });

    const GRID_SIZE = 25;

    // Generate seed + hash
    const seed = generateSeed();
    const hash = await sha256(seed);

    // Place mines using crypto RNG — Fisher-Yates shuffle on indices
    const randoms = cryptoRandoms(GRID_SIZE);
    const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
    // Partial Fisher-Yates for mines_count positions
    for (let i = 0; i < mines_count; i++) {
      const j = i + Math.floor(randoms[i] * (GRID_SIZE - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const minePositions = indices.slice(0, mines_count);

    // Store round
    const gameRound = await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'mines',
      seed,
      hash,
      outcome: JSON.stringify({ mine_positions: minePositions, mines_count, grid_size: GRID_SIZE }),
      bet_amount: bet,
      win_amount: 0, // updated on cashout
      difficulty: `${mines_count}-mines`,
      house_edge: 0.02,
    });

    return Response.json({
      success: true,
      round_id: gameRound.id,
      seed,
      hash,
      mine_positions: minePositions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});