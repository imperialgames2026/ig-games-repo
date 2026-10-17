import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cryptographic randomness utilities
function generateSeed() {
  return crypto.randomUUID() + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function hashSeed(seed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { game_slug, count = 10 } = await req.json();

    // Generate pre-determined outcomes for the next N rounds
    const outcomes = [];
    
    for (let i = 0; i < count; i++) {
      const seed = generateSeed();
      const hash = await hashSeed(seed);
      
      outcomes.push({
        game_slug,
        seed,
        hash,
        round_number: i + 1,
        status: 'pending',
      });
    }

    // Store outcomes in GameRound entity
    const createdRounds = [];
    for (const outcome of outcomes) {
      const round = await base44.asServiceRole.entities.GameRound.create({
        user_email: user.email,
        game_slug: outcome.game_slug,
        seed: outcome.seed,
        hash: outcome.hash,
        outcome: JSON.stringify({ pending: true }),
        bet_amount: 0,
        win_amount: 0,
        house_edge: 0.04,
      });
      createdRounds.push(round);
    }

    return Response.json({ 
      success: true, 
      rounds: createdRounds.length,
      hashes: createdRounds.map(r => r.hash),
    });
  } catch (error) {
    console.error('Generate outcomes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});