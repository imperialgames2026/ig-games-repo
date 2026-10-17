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

// Multiplier pool by risk level
function getMultiplierPool(risk, segmentCount) {
  if (risk === 'low') {
    return Array.from({ length: segmentCount }, (_, i) => {
      const prob = i / segmentCount;
      if (prob < 0.2) return 0;
      if (prob < 0.3) return 1.48;
      return 1.18;
    });
  } else if (risk === 'medium') {
    return Array.from({ length: segmentCount }, (_, i) => {
      const prob = i / segmentCount;
      if (prob < 0.3) return 0;
      if (prob < 0.42) return 1.48;
      if (prob < 0.52) return 1.88;
      if (prob < 0.62) return 1.97;
      return 2.96;
    });
  } else {
    return Array.from({ length: segmentCount }, (_, i) => 
      i === segmentCount - 1 ? segmentCount * 0.98 : 0
    );
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, risk = 'low', segment_count = 10, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    const seed = generateSeed();
    const hash = await sha256(seed);

    // Select segment using crypto random
    const random = generateCryptoRandom();
    const pool = getMultiplierPool(risk, segment_count);
    const selectedIndex = Math.floor(random * segment_count);
    const multiplier = pool[selectedIndex];

    const winAmount = multiplier > 0 ? Math.round(bet_amount * multiplier * 100) / 100 : 0;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'wheel',
      seed,
      hash,
      outcome: JSON.stringify({ risk, segment_count, selected_index: selectedIndex, multiplier }),
      bet_amount,
      win_amount: winAmount,
      difficulty: risk,
      house_edge: 0.04,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      segment_index: selectedIndex,
      multiplier,
      win_amount: winAmount,
    });
  } catch (error) {
    console.error('Wheel outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});