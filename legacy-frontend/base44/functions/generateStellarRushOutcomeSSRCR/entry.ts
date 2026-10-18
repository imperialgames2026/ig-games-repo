import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DIFFICULTIES = {
  easy: { winChance: 0.84, multiplierStep: 1.18 },
  medium: { winChance: 0.70, multiplierStep: 1.30 },
  hard: { winChance: 0.55, multiplierStep: 1.40 },
  daredevil: { winChance: 0.34, multiplierStep: 1.75 },
};

const DEFAULT_SETTINGS = {
  lose_weight: 100,
  sx_weight: 100,
  mx_weight: 35,
  lx_weight: 12,
  xl_weight: 4,
  xxl_weight: 1,
  is_active: true,
};

async function sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSeed() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${crypto.randomUUID()}-${hex}-${Date.now().toString(36)}`;
}

function generateCryptoRandom() {
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  return randomArray[0] / (0xFFFFFFFF + 1);
}

function roundTwo(value) {
  return Math.round(value * 100) / 100;
}

function getCategory(multiplier) {
  if (multiplier <= 6) return 'sx';
  if (multiplier <= 16) return 'mx';
  if (multiplier <= 33) return 'lx';
  if (multiplier <= 133) return 'xl';
  return 'xxl';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet_amount, difficulty = 'hard', current_multiplier = 1, steps = 1, currency = 'IC' } = await req.json();
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.hard;
    const moveCount = Math.max(1, Math.min(2, Number(steps) || 1));
    const betAmount = Number(bet_amount) || 0;

    if (betAmount < 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    const configured = await base44.asServiceRole.entities.OriginalGameSetting.filter({ game_slug: 'stellar-rush' });
    const settings = { ...DEFAULT_SETTINGS, ...(configured[0] || {}) };
    const seed = generateSeed();
    const hash = await sha256(seed);

    let current = Number(current_multiplier) || 1;
    const moves = [];
    let survived = true;
    let crashMultiplier = null;

    for (let i = 0; i < moveCount; i += 1) {
      const target = roundTwo(current * diff.multiplierStep);
      const category = getCategory(target);
      const categoryWeight = Number(settings[`${category}_weight`]) || 0;
      const loseWeight = Number(settings.lose_weight) || 0;
      const totalWeight = Math.max(1, categoryWeight + loseWeight);
      const weightedWin = !settings.is_active || generateCryptoRandom() < (categoryWeight / totalWeight);
      const difficultyWin = generateCryptoRandom() < diff.winChance;
      const stepSurvived = weightedWin && difficultyWin;

      moves.push({ step: i + 1, target_multiplier: target, category: category.toUpperCase(), survived: stepSurvived });

      if (!stepSurvived) {
        survived = false;
        crashMultiplier = target;
        break;
      }

      current = target;
    }

    const finalMultiplier = survived ? current : 0;

    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'stellar-rush',
      seed,
      hash,
      outcome: JSON.stringify({ difficulty, steps: moveCount, moves, survived, final_multiplier: finalMultiplier, crash_multiplier: crashMultiplier, currency }),
      bet_amount: betAmount,
      win_amount: 0,
      difficulty,
      house_edge: 0.02,
    });

    return Response.json({
      success: true,
      seed,
      hash,
      survived,
      moves,
      final_multiplier: finalMultiplier,
      crash_multiplier: crashMultiplier,
      next_multiplier: roundTwo((survived ? current : (Number(current_multiplier) || 1)) * diff.multiplierStep),
    });
  } catch (error) {
    console.error('Stellar Rush SSRCR error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});