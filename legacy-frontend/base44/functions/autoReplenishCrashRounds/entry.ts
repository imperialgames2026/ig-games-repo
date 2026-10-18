import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TARGET_PENDING = 50;  // reduced target to avoid timeout
const GENERATE_COUNT = 20;  // generate this many at a time
const HOUSE_EDGE = 0.07;

function fastHash(seed) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') +
         (h * 0x9e3779b9 >>> 0).toString(16).padStart(8, '0') +
         (h ^ (h >>> 16)).toString(16).padStart(8, '0') +
         (h * 0x85ebca6b >>> 0).toString(16).padStart(8, '0');
}

function generateSeed() {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('') + '-' + Date.now().toString(36);
}

function randomF() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 0x100000000;
}

function makeCrashPoint() {
  const r = randomF();
  let cp;
  if (r < 0.80)      cp = 1.01 + Math.pow(randomF(), 0.5) * 0.49;
  else if (r < 0.90) cp = 2 + randomF() * 5;
  else if (r < 0.95) cp = 7 + randomF() * 16;
  else if (r < 0.98) cp = 23 + randomF() * 23;
  else               cp = 46 + randomF() * 104;
  return Math.min(150, Math.max(1.01, Math.round(cp * 100) / 100));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Single query to count pending rounds (limit 51 to detect if >= TARGET_PENDING)
    const pending = await base44.asServiceRole.entities.CrashRound.filter({ status: 'pending' }, 'round_number', TARGET_PENDING + 1);

    if (pending.length >= TARGET_PENDING) {
      console.log(`Skipping — already have ${pending.length} pending rounds`);
      return Response.json({ skipped: true, pending: pending.length });
    }

    // Get highest round number
    const latest = await base44.asServiceRole.entities.CrashRound.list('-round_number', 1);
    const nextRoundNumber = (latest[0]?.round_number || 0) + 1;

    // Build rounds array and bulk create
    const rounds = [];
    for (let i = 0; i < GENERATE_COUNT; i++) {
      const seed = generateSeed();
      rounds.push({
        round_number: nextRoundNumber + i,
        seed,
        hash: fastHash(seed),
        crash_point: makeCrashPoint(),
        status: 'pending',
        house_edge: HOUSE_EDGE
      });
    }

    await base44.asServiceRole.entities.CrashRound.bulkCreate(rounds);

    console.log(`Auto-replenished ${GENERATE_COUNT} rounds. Was at ${pending.length} pending.`);
    return Response.json({ success: true, generated: GENERATE_COUNT, was_pending: pending.length });
  } catch (error) {
    console.error('autoReplenishCrashRounds error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});