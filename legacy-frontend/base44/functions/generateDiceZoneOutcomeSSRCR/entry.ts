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

    const { bet_amount, zone_start, zone_end, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });
    if (zone_start === undefined || zone_end === undefined) return Response.json({ error: 'Invalid zone' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Roll using crypto random (1-100)
    const random = generateCryptoRandom();
    const roll = Math.floor(random * 100) + 1;
    const isWin = roll >= zone_start && roll <= zone_end;
    
    const zoneSize = (zone_end - zone_start) + 1;
    const multiplier = (100 / zoneSize) * 0.96;
    const winAmount = isWin ? Math.round(bet_amount * multiplier * 100) / 100 : 0;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'dice-zone',
      seed,
      hash,
      outcome: JSON.stringify({ roll, zone_start, zone_end, isWin, multiplier }),
      bet_amount,
      win_amount: winAmount,
      house_edge: 0.04,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      roll,
      is_win: isWin,
      multiplier: parseFloat(multiplier.toFixed(2)),
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('Dice Zone outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});