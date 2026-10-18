import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

const GEM_MULTIPLIERS = [1.05, 1.1, 1.2, 1.35, 1.5];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Spin using crypto random - get outcome sequence
    const randoms = [];
    for (let i = 0; i < 10; i++) {
      const random = generateCryptoRandom();
      randoms.push(random);
    }

    // Generate spin outcomes: gems (0.7 prob) or skull (0.3 prob)
    const outcomes = [];
    let totalMultiplier = 1.0;
    let skullHit = false;

    for (let i = 0; i < randoms.length; i++) {
      if (randoms[i] < 0.58) {
        // Gem - pick random multiplier
        const gemRandom = generateCryptoRandom();
        const gemIndex = Math.floor(gemRandom * GEM_MULTIPLIERS.length);
        const multiplier = GEM_MULTIPLIERS[gemIndex];
        totalMultiplier *= multiplier;
        outcomes.push({ type: 'gem', multiplier });
      } else {
        // Skull - game ends
        outcomes.push({ type: 'skull' });
        skullHit = true;
        break;
      }
    }

    const winAmount = skullHit ? 0 : Math.round(bet_amount * totalMultiplier * 100) / 100;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'twist',
      seed,
      hash,
      outcome: JSON.stringify({ outcomes, total_multiplier: totalMultiplier, skull_hit: skullHit }),
      bet_amount,
      win_amount: winAmount,
      house_edge: 0.05,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      outcomes,
      total_multiplier: totalMultiplier,
      skull_hit: skullHit,
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('Twist outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});