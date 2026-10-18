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

function generateCryptoRandoms(count) {
  const buf = new Uint32Array(count);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(v => v / (0xFFFFFFFF + 1));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, bet_type = 'pass', currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Roll two dice using crypto random
    const randoms = generateCryptoRandoms(2);
    const d1 = Math.floor(randoms[0] * 6) + 1;
    const d2 = Math.floor(randoms[1] * 6) + 1;
    const total = d1 + d2;

    let winAmount = 0;
    let result = null;

    if (bet_type === 'pass') {
      if (total === 7 || total === 11) {
        winAmount = bet_amount * 2;
        result = 'win';
      } else if (total === 2 || total === 3 || total === 12) {
        result = 'lose';
      } else {
        result = 'point_established';
      }
    } else if (bet_type === 'any_seven') {
      if (total === 7) {
        winAmount = bet_amount * 5;
        result = 'win';
      } else {
        result = 'lose';
      }
    } else if (bet_type === 'field') {
      if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
        winAmount = (total === 2 || total === 12 ? bet_amount * 3 : bet_amount * 2);
        result = 'win';
      } else {
        result = 'lose';
      }
    }

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'craps',
      seed,
      hash,
      outcome: JSON.stringify({ d1, d2, total, bet_type, result }),
      bet_amount,
      win_amount: winAmount,
      house_edge: 0.04,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      dice: [d1, d2],
      total,
      result,
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('Craps outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});