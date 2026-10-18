import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUE = {};
RANKS.forEach((r, i) => RANK_VALUE[r] = i + 1);

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

function generateCryptoRandom() {
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  return randomArray[0] / (0xFFFFFFFF + 1);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, current_rank, guess_type, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });
    if (!current_rank || !guess_type) return Response.json({ error: 'Invalid input' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Generate next card using crypto random
    const random = generateCryptoRandom();
    const nextRank = RANKS[Math.floor(random * 13)];

    const currentValue = RANK_VALUE[current_rank];
    const nextValue = RANK_VALUE[nextRank];

    let won = false;
    if (guess_type === 'higher') won = nextValue > currentValue;
    else if (guess_type === 'lower') won = nextValue < currentValue;
    else if (guess_type === 'same') won = nextValue === currentValue;

    const higherCount = 13 - currentValue;
    const lowerCount = currentValue - 1;
    const higherProb = higherCount / 13;
    const lowerProb = lowerCount / 13;
    const sameProb = 1 / 13;

    let stepMult = 0;
    if (guess_type === 'same') stepMult = 15;
    else if (guess_type === 'higher') stepMult = higherProb > 0 ? 0.98 / higherProb : 0;
    else if (guess_type === 'lower') stepMult = lowerProb > 0 ? 0.98 / lowerProb : 0;

    const winAmount = won ? Math.round(bet_amount * stepMult * 100) / 100 : 0;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'hilo',
      seed,
      hash,
      outcome: JSON.stringify({ current_rank, next_rank: nextRank, guess_type, won }),
      bet_amount,
      win_amount: winAmount,
      house_edge: 0.02,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      next_rank: nextRank,
      won,
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('HiLo outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});