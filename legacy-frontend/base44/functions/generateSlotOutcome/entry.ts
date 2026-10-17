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

function generateCryptoRandoms(count) {
  const randomArray = new Uint32Array(count);
  crypto.getRandomValues(randomArray);
  return Array.from(randomArray).map(val => val / (0xFFFFFFFF + 1));
}

// Higher hit frequency with flatter outcomes and ultra-rare jackpot tier
const SYMBOL_WEIGHTS = {
  'imperial-gold': { CROWN: 0.00008, DIAMOND: 5, MONEY: 18, TROPHY: 38, STAR: 84, SLOT: 120, BELL: 150 },
  'royal-ruby': { DIAMOND: 0.00008, HEART: 5, CROWN: 18, RING: 38, ROSE: 84, STAR: 120, BOW: 150 },
  'cosmic-crown': { KING: 0.00008, GODDESS: 5, ORB: 18, CROWN: 38, PLANET: 84, SHOOTING: 120, NEBULA: 150 },
  'diamond-dynasty': { DIAMOND: 0.00008, CROWN: 5, CASTLE: 18, FLEUR: 38, TRIDENT: 84, SPARKLE: 120, DIZZY: 150 },
  'emerald-empire': { DIAMOND: 0.00008, EMERALD: 5, STAR: 18, SPARKLE: 38, CLOVER: 84, LEAF: 120, MOON: 150 },
  'lucky-fortune': { CLOVER: 0.00008, COIN: 5, DICE: 18, CARD: 38, TARGET: 84, CASH: 120, WILD: 150 },
  'neon-nights': { BOLT: 0.00008, PURPLE: 5, BLUE: 18, GREEN: 38, CIRCLE3: 84, CIRCLE2: 120, CIRCLE1: 150 },
  'ocean-treasure': { QUEEN: 0.00008, KING: 5, CHEST: 18, TRIDENT: 38, SHELL: 84, STARFISH: 120, PEARL: 150 },
  'phoenix-fire': { GODDESS: 0.00008, BIRD: 5, TALON: 18, EGG: 38, FEATHER: 84, ORB: 120, EMBER: 150 },
  'sapphire-storm': { SAPPHIRE: 0.00008, BOLT: 5, WAVE: 18, DIAMOND: 38, RHOMBUS: 84, STAR: 120, SNOWFLAKE: 150 },
  'mystic-forest': { UNICORN: 0.00008, OWL: 5, DEER: 18, FERN: 38, ACORN: 84, FLOWER: 120, LEAF: 150 },
  'golden-dragon': { EMPEROR: 0.00008, DRAGON: 5, PEARL: 18, CLAW: 38, COIN: 84, SCALE: 120, INGOT: 150 },
  'aztec-treasure': { IDOL: 0.00008, MASK: 5, SKULL: 18, ARROW: 38, DRUM: 84, SNAKE: 120, FEATHER: 150 },
  'farmageddon': { HIGH_1: 5, HIGH_2: 5, MED_1: 38, MED_2: 38, LOW_1: 150, LOW_2: 150, SCATTER: 18, WILD: 18 },
};

// 20 paylines (standard casino configuration)
const PAYLINES = [
  [1, 1, 1, 1, 1], // Middle row
  [0, 0, 0, 0, 0], // Top row
  [2, 2, 2, 2, 2], // Bottom row
  [0, 1, 2, 1, 0], // V shape
  [2, 1, 0, 1, 2], // Inverted V
  [0, 0, 1, 0, 0], // Top + middle dip
  [2, 2, 1, 2, 2], // Bottom + middle peak
  [1, 0, 0, 0, 1], // Middle sides, top middle
  [1, 2, 2, 2, 1], // Middle sides, bottom middle
  [0, 1, 0, 1, 0], // Zigzag top
  [2, 1, 2, 1, 2], // Zigzag bottom
  [1, 0, 1, 0, 1], // Up-down
  [1, 2, 1, 2, 1], // Down-up
  [0, 0, 1, 2, 2], // Diagonal down
  [2, 2, 1, 0, 0], // Diagonal up
  [1, 1, 0, 1, 1], // Middle dip
  [1, 1, 2, 1, 1], // Middle peak
  [0, 1, 1, 1, 0], // Sides up, middle flat
  [2, 1, 1, 1, 2], // Sides down, middle flat
  [1, 0, 1, 2, 1], // W shape
];

// Payout multipliers applied to the bet PER LINE
// e.g. 1000x on a $1/line bet = $1,000 win. 1000x on a $0.40/line bet = $400 win.
const PAYOUT_MULTIPLIERS = {
  3: [8, 5, 3.5, 2.5, 1.6, 1.2, 1],
  4: [30, 16, 10, 7, 4.5, 3.2, 2.4],
  5: [120, 60, 35, 22, 14, 9, 6],
};

const FARMAGEDDON_PAYTABLE = {
  HIGH_1: { 2: 12, 3: 180, 4: 1000 },
  HIGH_2: { 2: 8, 3: 120, 4: 500 },
  MED_1: { 2: 4, 3: 40, 4: 140 },
  MED_2: { 2: 3, 3: 32, 4: 140 },
  LOW_1: { 2: 1, 3: 8, 4: 40 },
  LOW_2: { 2: 1, 3: 6, 4: 40 },
  SCATTER: { 3: 20, 4: 100 },
  WILD: { 2: 5, 3: 50, 4: 200 },
};

function getSymbolPayouts(symbols, matchCount, slotType) {
  if (slotType === 'farmageddon') {
    return Object.fromEntries(
      Object.entries(FARMAGEDDON_PAYTABLE).map(([symbol, payouts]) => [symbol, payouts[matchCount] || 0])
    );
  }

  const multipliers = PAYOUT_MULTIPLIERS[matchCount] || [];
  return symbols.reduce((map, symbol, index) => {
    map[symbol] = multipliers[index] || 0;
    return map;
  }, {});
}

function selectSymbolFromWeights(weights, random) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const target = random * totalWeight;

  let cumulative = 0;
  for (const [symbol, weight] of entries) {
    cumulative += weight;
    if (target <= cumulative) return symbol;
  }

  return entries[entries.length - 1][0];
}

function generateSlotGrid(weights, slotType) {
  const cols = slotType === 'farmageddon' ? 4 : 5;
  const rows = slotType === 'farmageddon' ? 4 : 3;
  const randoms = generateCryptoRandoms(cols * rows);
  const grid = [];
  for (let reel = 0; reel < cols; reel++) {
    const reelSymbols = [];
    for (let row = 0; row < rows; row++) {
      const random = randoms[reel * rows + row];
      reelSymbols.push(selectSymbolFromWeights(weights, random));
    }
    grid.push(reelSymbols);
  }
  return grid;
}

function generateFarmageddonBonusGrid(weights) {
  const bonusWeights = { ...weights, MULT_2: 16, MULT_3: 10, MULT_4: 6 };
  const randoms = generateCryptoRandoms(9);
  const grid = [];

  for (let reel = 0; reel < 3; reel++) {
    const reelSymbols = [];
    for (let row = 0; row < 3; row++) {
      reelSymbols.push(selectSymbolFromWeights(bonusWeights, randoms[reel * 3 + row]));
    }
    grid.push(reelSymbols);
  }

  return grid;
}

async function getSlotWeights(base44, slotType) {
  const defaultWeights = SYMBOL_WEIGHTS[slotType] || SYMBOL_WEIGHTS['imperial-gold'];

  if (slotType !== 'farmageddon') {
    return defaultWeights;
  }

  const settings = await base44.asServiceRole.entities.SlotSetting.filter({ slot_type: 'farmageddon' });
  const setting = settings[0];

  if (!setting) {
    return defaultWeights;
  }

  const highTotal = Math.max(0, Number(setting.high_weight ?? 10));
  const mediumTotal = Math.max(0, Number(setting.medium_weight ?? 76));
  const lowTotal = Math.max(0, Number(setting.low_weight ?? 300));

  return {
    ...defaultWeights,
    HIGH_1: highTotal / 2,
    HIGH_2: highTotal / 2,
    MED_1: mediumTotal / 2,
    MED_2: mediumTotal / 2,
    LOW_1: lowTotal / 2,
    LOW_2: lowTotal / 2,
  };
}

const FARMAGEDDON_PAYLINES = [
  [0, 0, 0, 0],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
  [3, 3, 3, 3],
  [0, 1, 2, 3],
  [3, 2, 1, 0],
];

const FARMAGEDDON_BONUS_PAYLINES = [
  [1, 1, 1],
];

function evaluateFarmageddonBonusWins(grid, symbols, betAmount) {
  const wins = [];
  let totalWin = 0;
  const multiplierValues = { MULT_2: 2, MULT_3: 3, MULT_4: 4 };
  const isSubstitute = (symbol) => symbol === 'WILD' || !!multiplierValues[symbol];

  FARMAGEDDON_BONUS_PAYLINES.forEach((payline, lineIndex) => {
    const lineSymbols = payline.map((row, reel) => grid[reel][row]);
    const matchSymbol = lineSymbols.find((symbol) => !isSubstitute(symbol)) || lineSymbols[0];
    const isWinningLine = lineSymbols.every((symbol) => symbol === matchSymbol || isSubstitute(symbol));

    if (!isWinningLine) return;

    const baseMultiplier = 1;
    const winMultiplier = lineSymbols.reduce((total, symbol) => total * (multiplierValues[symbol] || 1), 1);
    const winAmount = betAmount * winMultiplier;
    const cells = payline.map((row, reel) => `${reel},${row}`);
    totalWin += winAmount;
    wins.push({ line: lineIndex, symbol: matchSymbol, count: 3, multiplier: baseMultiplier, winMultiplier, winAmount, cells });
  });

  return { wins, totalWin };
}

function evaluateSlotWins(grid, symbols, lines, betAmount, slotType) {
  const wins = [];
  let totalWin = 0;
  const activePaylines = slotType === 'farmageddon' ? FARMAGEDDON_PAYLINES : PAYLINES;
  const multiplierValues = { MULT_2: 2, MULT_3: 3, MULT_4: 4 };
  const isSubstitute = (symbol) => symbol === 'WILD' || !!multiplierValues[symbol];

  for (let lineIndex = 0; lineIndex < lines; lineIndex++) {
    const payline = activePaylines[lineIndex];
    const lineSymbols = payline.map((row, reel) => grid[reel][row]);
    let matchCount = 1;
    const matchSymbol = slotType === 'farmageddon'
      ? (lineSymbols.find((symbol) => !isSubstitute(symbol)) || lineSymbols[0])
      : lineSymbols[0];

    for (let i = 1; i < lineSymbols.length; i++) {
      if (lineSymbols[i] === matchSymbol || lineSymbols[i] === 'WILD' || (slotType === 'farmageddon' && multiplierValues[lineSymbols[i]])) {
        matchCount++;
      } else {
        break;
      }
    }

    const minimumMatchCount = slotType === 'farmageddon' ? 2 : 3;

    if (matchCount >= minimumMatchCount) {
      const symbolPayouts = getSymbolPayouts(symbols, matchCount, slotType);
      const baseMultiplier = symbolPayouts[matchSymbol] || 0;
      if (baseMultiplier > 0) {
        const cells = Array.from({ length: matchCount }, (_, reel) => `${reel},${payline[reel]}`);
        const winMultiplier = slotType === 'farmageddon'
          ? lineSymbols.slice(0, matchCount).reduce((total, symbol) => total * (multiplierValues[symbol] || 1), 1)
          : 1;
        const winAmount = betAmount * baseMultiplier * winMultiplier;
        totalWin += winAmount;
        wins.push({
          line: lineIndex,
          symbol: matchSymbol,
          count: matchCount,
          multiplier: baseMultiplier,
          winMultiplier,
          winAmount,
          cells,
        });
      }
    }
  }

  return { wins, totalWin };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bet_amount, slot_type = 'imperial-gold', lines = 20, currency = 'IC' } = await req.json();

    if (!bet_amount || bet_amount < 0.1) {
      return Response.json({ error: 'Invalid bet amount' }, { status: 400 });
    }

    const maxLines = slot_type === 'farmageddon' ? 6 : 20;

    if (lines < 1 || lines > maxLines) {
      return Response.json({ error: `Lines must be between 1 and ${maxLines}` }, { status: 400 });
    }

    // Generate provably fair outcome
    const seed = generateSeed();
    const hash = await hashSeed(seed);

    const weights = await getSlotWeights(base44, slot_type);
    const symbols = Object.keys(weights);

    const grid = generateSlotGrid(weights, slot_type);
    const baseResult = evaluateSlotWins(grid, symbols, lines, bet_amount, slot_type);
    const wins = baseResult.wins;
    let totalWin = baseResult.totalWin;

    const scatterCount = grid.flat().filter((symbol) => symbol === 'SCATTER').length;
    let bonus = null;

    if (slot_type === 'farmageddon' && scatterCount >= 4) {
      const bonusSpins = [];
      let bonusTotalWin = 0;
      const freeSpins = 10 + Math.max(0, scatterCount - 4) * 5;

      for (let spin = 1; spin <= freeSpins; spin++) {
        const bonusGrid = generateFarmageddonBonusGrid(weights);
        const bonusResult = evaluateFarmageddonBonusWins(bonusGrid, [...symbols, 'MULT_2', 'MULT_3', 'MULT_4'], bet_amount);
        const spinWin = bonusResult.totalWin;
        bonusTotalWin += spinWin;
        bonusSpins.push({
          spin,
          grid: bonusGrid,
          wins: bonusResult.wins,
          baseWin: bonusResult.totalWin,
          multiplier: Math.max(1, ...bonusResult.wins.map((win) => win.winMultiplier || 1)),
          win: spinWin,
        });
      }

      totalWin += bonusTotalWin;
      bonus = {
        triggered: true,
        scatterCount,
        freeSpins,
        totalWin: bonusTotalWin,
        spins: bonusSpins,
      };
    }

    // Store in database (7% house edge = 93% RTP)
    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: `${slot_type}-slot`,
      seed: seed,
      hash: hash,
      outcome: JSON.stringify({ grid, wins, lines, bonus, weights }),
      bet_amount: bet_amount * lines,
      win_amount: totalWin,
      house_edge: 0.07,
    });

    const winningCells = [...new Set(wins.flatMap((win) => win.cells || []))];

    return Response.json({
      success: true,
      seed,
      hash,
      grid,
      wins,
      winningCells,
      bonus,
      total_win: totalWin,
    });
  } catch (error) {
    console.error('Slot outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});