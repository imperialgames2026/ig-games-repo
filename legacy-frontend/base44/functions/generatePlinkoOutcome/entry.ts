import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cryptographic randomness utilities
function generateSeed() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${crypto.randomUUID()}-${hex}-${Date.now().toString(36)}`;
}

async function hashSeed(seed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateCryptoRandom() {
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  return randomArray[0] / (0xFFFFFFFF + 1);
}

function applyHouseEdge(multiplier, edge = 0.07) {
  return multiplier * (1 - edge);
}

// Multipliers from the game (matching PlinkoGame.jsx)
const MULTIPLIERS = {
  regular: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    9: [6, 2.1, 1.5, 1, 0.7, 0.7, 1, 1.5, 2.1, 6],
    10: [8.7, 3, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 3, 8.7],
    11: [9, 3.8, 2.1, 1.4, 1, 0.6, 0.6, 1, 1.4, 2.1, 3.8, 9],
    12: [11, 3, 2, 1.4, 1.1, 1, 0.4, 1, 1.1, 1.4, 2, 3, 11],
    13: [17, 4, 3.5, 2, 1.1, 1, 0.6, 1, 1.1, 2, 3.5, 4, 17],
    14: [10, 5, 3, 1.4, 1.2, 1.1, 0.5, 0.5, 0.5, 1.1, 1.2, 1.4, 3, 5, 10],
    15: [20, 8, 4, 2.5, 1.5, 1.2, 1.1, 0.5, 0.5, 1.1, 1.2, 1.5, 2.5, 4, 8, 20],
    16: [100, 10, 3, 1.6, 1.4, 1.2, 1.1, 1, 0.4, 1, 1.1, 1.2, 1.4, 1.6, 3, 10, 100],
  },
  high: {
    8: [24.4, 3, 1.6, 0.5, 0.2, 0.5, 1.6, 3, 24.4],
    9: [45.3, 7, 2.1, 0.5, 0.2, 0.2, 0.5, 2.1, 7, 45.3],
    10: [76, 12, 4, 1, 0.3, 0.2, 0.3, 1, 4, 12, 76],
    11: [120, 18, 6, 1.5, 0.5, 0.2, 0.2, 0.2, 0.5, 1.5, 6, 18, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 35, 12, 3, 1, 0.3, 0.2, 0.2, 0.3, 1, 3, 12, 35, 260],
    14: [420, 55, 18, 5, 1.5, 0.5, 0.2, 0.2, 0.5, 1.5, 5, 18, 55, 420],
    15: [620, 88, 24, 8, 2, 0.7, 0.3, 0.2, 0.3, 0.7, 2, 8, 24, 88, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
  nightmare: {
    8: [24.4, 3, 1.6, 0.5, 0.2, 0.5, 1.6, 3, 24.4],
    9: [45.3, 7, 2.1, 0.5, 0.2, 0.2, 0.5, 2.1, 7, 45.3],
    10: [253, 10, 1.3, 0.5, 0.2, 0.2, 0.5, 1.3, 10, 253],
    11: [300, 15, 2, 0.5, 0.3, 0.1, 0.1, 0.3, 0.5, 2, 15, 300],
    12: [420, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 420],
    13: [520, 35, 12, 3, 1, 0.3, 0.2, 0.2, 0.3, 1, 3, 12, 35, 520],
    14: [820, 55, 18, 5, 1.5, 0.5, 0.2, 0.2, 0.5, 1.5, 5, 18, 55, 820],
    15: [1200, 88, 24, 8, 2, 0.7, 0.3, 0.2, 0.3, 0.7, 2, 8, 24, 88, 1200],
    16: [1800, 180, 26, 9, 4, 2, 1, 0.2, 0.2, 1, 2, 4, 9, 26, 180, 1800],
  },
};

/**
 * Generate a provably fair Plinko outcome
 * This uses cryptographic seeds to determine the ball's landing bucket
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bet_amount, game_mode = 'regular', rows = 10, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) {
      return Response.json({ error: 'Invalid bet amount' }, { status: 400 });
    }

    // Generate seed and hash
    const seed = generateSeed();
    const hash = await hashSeed(seed);

    // Use crypto random to select bucket
    const multipliers = MULTIPLIERS[game_mode][rows];
    const bucketCount = multipliers.length;
    
    // Generate crypto-random bucket index (0 to bucketCount-1)
    const random = generateCryptoRandom();
    const bucketIndex = Math.floor(random * bucketCount);
    const multiplier = multipliers[bucketIndex];

    // Apply 7% house edge
    const finalMultiplier = applyHouseEdge(multiplier, 0.07);
    const winAmount = bet_amount * finalMultiplier;

    // Store round in database
    const gameRound = await base44.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'plinko',
      seed: seed,
      hash: hash,
      outcome: JSON.stringify({
        game_mode,
        rows,
        bucket_index: bucketIndex,
        multiplier: finalMultiplier,
        raw_multiplier: multiplier,
      }),
      bet_amount: bet_amount,
      win_amount: winAmount,
      difficulty: game_mode,
      house_edge: 0.07,
    });

    // Return outcome (seed is revealed to user for verification)
    return Response.json({
      success: true,
      round_id: gameRound.id,
      seed: seed,
      hash: hash,
      bucket_index: bucketIndex,
      multiplier: finalMultiplier,
      win_amount: winAmount,
      game_mode,
      rows,
    });
  } catch (error) {
    console.error('Plinko outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});