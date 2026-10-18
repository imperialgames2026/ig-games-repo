import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SCATTER = '💼'; // Accumulator symbol

// Symbol weights - higher = more common
const SYMBOL_WEIGHTS = [
  { symbol: '💎', weight: 1 },   // Top - extremely rare
  { symbol: '👑', weight: 3 },   // High value
  { symbol: '🏆', weight: 8 },   // Medium-high
  { symbol: '💰', weight: 20 },  // Medium
  { symbol: '🎯', weight: 50 },  // Medium-low
  { symbol: '⭐', weight: 80 },  // Common
];

const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((s, x) => s + x.weight, 0); // 162

const PAYLINES = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 1, 1, 0],
];

const PAYOUTS = {
  '💎': { 5: 2.5, 4: 1.4, 3: 0.8 },
  '👑': { 5: 2.2, 4: 1.3, 3: 0.75 },
  '🏆': { 5: 2.0, 4: 1.2, 3: 0.7 },
  '💰': { 5: 1.8, 4: 1.1, 3: 0.65 },
  '🎯': { 5: 1.6, 4: 1.0, 3: 0.6 },
  '⭐': { 5: 1.4, 4: 0.9, 3: 0.5 },
};

const HOUSE_EDGE = 0.07; // 93% RTP

async function hashSeed(seed) {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSeed() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
  return `${crypto.randomUUID()}-${hex}-${Date.now().toString(36)}`;
}

async function generateCryptoRandom() {
  const array = new Uint8Array(1);
  crypto.getRandomValues(array);
  return array[0] / 256;
}

function selectWeightedSymbol() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const rand = (array[0] / (0xFFFFFFFF + 1)) * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const { symbol, weight } of SYMBOL_WEIGHTS) {
    cumulative += weight;
    if (rand < cumulative) return symbol;
  }
  return '⭐';
}

async function generateSymbolGrid() {
  const grid = [];
  for (let i = 0; i < 3; i++) {
    const row = [];
    for (let j = 0; j < 5; j++) {
      // 3% scatter chance, 97% weighted symbol
      const scatterRoll = new Uint32Array(1);
      crypto.getRandomValues(scatterRoll);
      if ((scatterRoll[0] / (0xFFFFFFFF + 1)) < 0.03) {
        row.push(SCATTER);
      } else {
        row.push(selectWeightedSymbol());
      }
    }
    grid.push(row);
  }
  return grid;
}

function calculateWins(grid, bet, paylineMultiplier) {
  let totalWin = 0;

  PAYLINES.forEach(payline => {
    const symbols = payline.map((row, col) => grid[row][col]);
    const firstSymbol = symbols[0];

    if (firstSymbol === SCATTER) return;

    let matchCount = 1;
    for (let i = 1; i < symbols.length; i++) {
      if (symbols[i] === firstSymbol) {
        matchCount++;
      } else {
        break;
      }
    }

    if (matchCount >= 3) {
      const basePayout = PAYOUTS[firstSymbol]?.[matchCount] || 0;
      const winAmount = basePayout * bet * paylineMultiplier;
      totalWin += winAmount;
    }
  });

  return totalWin;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { bet, accumulator } = body;

    if (!bet || bet <= 0) {
      return Response.json({ error: 'Invalid bet' }, { status: 400 });
    }

    const seed = generateSeed();
    const hash = await hashSeed(seed);
    const grid = await generateSymbolGrid();

    // Count scatters for accumulator
    let scatterCount = 0;
    grid.forEach(row => {
      row.forEach(symbol => {
        if (symbol === SCATTER) scatterCount++;
      });
    });

    // keep premium slot payouts controlled and flatter
    const activeLines = Math.min(10, Math.max(5, PAYLINES.length));
    const paylineMultiplier = 0.5;

    let winAmount = calculateWins(grid, bet, paylineMultiplier);

    // Apply house edge
    if (winAmount > 0) {
      winAmount = Math.floor(winAmount * (1 - HOUSE_EDGE) * 100) / 100;
    }

    // Check bonus trigger
    const newAccumulator = accumulator + scatterCount;
    const bonusTriggered = newAccumulator >= 5;
    const resetAccumulator = bonusTriggered ? 0 : newAccumulator;

    // Store game round
    await base44.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'premium-slot',
      seed,
      hash,
      outcome: JSON.stringify({
        grid,
        scatterCount,
        paylineMultiplier,
        bonusTriggered,
      }),
      bet_amount: bet,
      win_amount: winAmount,
      house_edge: HOUSE_EDGE,
    });

    return Response.json({
      grid,
      winAmount,
      scatterCount,
      newAccumulator: resetAccumulator,
      bonusTriggered,
      seed,
      hash,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});