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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, chosen_side, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });
    if (!chosen_side || !['heads', 'tails'].includes(chosen_side)) return Response.json({ error: 'Invalid side' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Flip using crypto random
    const random = generateCryptoRandom();
    const outcome = random < 0.5 ? 'heads' : 'tails';
    const won = outcome === chosen_side;
    const winAmount = won ? Math.round(bet_amount * 1.98 * 100) / 100 : 0;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'coinflip',
      seed,
      hash,
      outcome: JSON.stringify({ outcome, chosen_side, won }),
      bet_amount,
      win_amount: winAmount,
      house_edge: 0.01,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      outcome,
      won,
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('Coin flip outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});