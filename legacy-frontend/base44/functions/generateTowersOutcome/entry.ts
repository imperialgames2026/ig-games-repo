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

const DIFFICULTY_MINES = { easy: 1, medium: 2, hard: 2, extreme: 2, nightmare: 3 };
const LEVELS = 9;
const TILES_PER_LEVEL = 3;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet, difficulty = 'easy', currency = 'IC' } = await req.json();

    if (!bet || bet <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    const minesPerLevel = DIFFICULTY_MINES[difficulty] || 1;
    const seed = generateSeed();
    const hash = await sha256(seed);

    // Generate mine layout for all 9 levels using crypto RNG
    const totalRandomsNeeded = LEVELS * TILES_PER_LEVEL;
    const randoms = cryptoRandoms(totalRandomsNeeded);

    const tileLayout = [];
    for (let level = 0; level < LEVELS; level++) {
      // Pick mine positions for this level using partial Fisher-Yates
      const positions = [0, 1, 2];
      for (let i = 0; i < minesPerLevel; i++) {
        const rand = randoms[level * TILES_PER_LEVEL + i];
        const j = i + Math.floor(rand * (TILES_PER_LEVEL - i));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      tileLayout.push(positions.slice(0, minesPerLevel)); // mine indices for this level
    }

    const gameRound = await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'towers',
      seed,
      hash,
      outcome: JSON.stringify({ tile_layout: tileLayout, difficulty, mines_per_level: minesPerLevel }),
      bet_amount: bet,
      win_amount: 0,
      difficulty,
      house_edge: 0.04,
    });

    return Response.json({
      success: true,
      round_id: gameRound.id,
      seed,
      hash,
      tile_layout: tileLayout,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});