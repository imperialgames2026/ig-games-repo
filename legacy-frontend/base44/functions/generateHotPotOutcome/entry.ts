import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// --- Symbol definitions (weights + payouts match official HotPot paytable) ---
const SYMBOL_WEIGHTS = {
  WILD: 2,
  ZONGZI: 6, SUSHI: 8, TACO: 8,
  ONION: 10, STAR_ANISE: 10, BAO: 10,
  A: 12, K: 12, Q: 12, J: 14, '9': 15, '8': 15,
  RED_BALL: 4, GREEN_BALL: 4, PURPLE_BALL: 4,
};

const JACKPOT_WEIGHTS = { JP_MINI: 0.00004, JP_MINOR: 0.000012, JP_MAJOR: 0.0000067 }; // tuned to ultra-rare, GRAND only in bonus
const JACKPOT_THRESHOLDS = { JP_MINI: 1, JP_MINOR: 2, JP_MAJOR: 4 };

// Official paytable: 5x / 4x / 3x multipliers × bet
const SYMBOL_PAYOUTS = {
  WILD:       { 3: 5,  4: 10, 5: 37 },
  ZONGZI:     { 3: 5,  4: 10, 5: 37 },
  SUSHI:      { 3: 3,  4: 5,  5: 25 },
  TACO:       { 3: 3,  4: 5,  5: 25 },
  ONION:      { 3: 2,  4: 3,  5: 10 },
  STAR_ANISE: { 3: 2,  4: 3,  5: 10 },
  BAO:        { 3: 2,  4: 3,  5: 10 },
  A:          { 3: 1,  4: 2,  5: 4  },
  K:          { 3: 1,  4: 2,  5: 4  },
  Q:          { 3: 1,  4: 2,  5: 4  },
  J:          { 3: 1,  4: 2,  5: 4  },
  '9':        { 3: 1,  4: 2,  5: 4  },
  '8':        { 3: 1,  4: 2,  5: 4  },
};

const JACKPOT_MULTIPLIERS = { JP_MINI: 10, JP_MINOR: 50, JP_MAJOR: 250, JP_GRAND: 1000 };

const PAYLINES = [
  [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0],
  [1,0,0,0,1], [1,2,2,2,1],
  [0,1,1,1,0],
];

const COLS = 5;
const ROWS = 3;

// Build weighted pool from an object of { symbol: weight }
function buildPool(weightMap) {
  const pool = [];
  for (const [sym, w] of Object.entries(weightMap)) {
    for (let i = 0; i < w; i++) pool.push(sym);
  }
  return pool;
}

// Pick from pool using a crypto random value (0-1)
function pickFromPool(pool, rand) {
  return pool[Math.floor(rand * pool.length)];
}

// Generate N crypto randoms in one call
function cryptoRandoms(count) {
  const buf = new Uint32Array(count);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(v => v / (0xFFFFFFFF + 1));
}

async function sha256(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateGrid(randoms, pool) {
  const grid = [];
  let ri = 0;
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      col.push(pickFromPool(pool, randoms[ri++]));
    }
    grid.push(col);
  }
  return grid;
}

function checkPaylines(grid, bet) {
  let totalWin = 0;
  const winningCells = new Set();

  for (const line of PAYLINES) {
    const lineSyms = line.map((row, col) => grid[col][row]);
    // Wild substitution: find the "real" symbol
    const first = lineSyms[0] === 'WILD'
      ? (lineSyms.find(s => s !== 'WILD') || 'WILD')
      : lineSyms[0];

    if (!SYMBOL_PAYOUTS[first]) continue;

    let count = 0;
    for (const s of lineSyms) {
      if (s === first || s === 'WILD') count++;
      else break;
    }

    if (count >= 3) {
      const mult = SYMBOL_PAYOUTS[first][count] || 0;
      if (mult > 0) {
        totalWin += Math.round(mult * bet * 100) / 100;
        for (let i = 0; i < count; i++) winningCells.add(`${i},${line[i]}`);
      }
    }
  }

  return { totalWin: Math.round(totalWin * 100) / 100, winningCells: [...winningCells] };
}

// Count bonus balls and jackpot symbols
function analyzeGrid(grid, bet) {
  const balls = { red: 0, green: 0, purple: 0 };
  const jackpots = [];

  for (const col of grid) {
    for (const sym of col) {
      if (sym === 'RED_BALL')    balls.red++;    // Upsized
      if (sym === 'GREEN_BALL')  balls.green++;  // Yummy
      if (sym === 'PURPLE_BALL') balls.purple++; // Spicy
      if (JACKPOT_MULTIPLIERS[sym]) {
        jackpots.push({ sym, payout: Math.round(JACKPOT_MULTIPLIERS[sym] * bet * 100) / 100 });
      }
    }
  }

  return { balls, jackpots };
}

// Generate the Hold & Win bonus board outcome entirely on server
function generateBonusOutcome(triggerGrid, bet, isUpsized, isYummy, bonusRandoms) {
  const MAX_SPINS = isUpsized ? 4 : 3;
  const BALL_VALUES = [0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 5.00];

  // Initialize board(s) with balls from trigger grid
  function initBoard(grid) {
    return Array(COLS).fill(null).map((_, c) =>
      Array(ROWS).fill(null).map((_, r) => {
        const sym = grid[c][r];
        if (sym === 'RED_BALL' || sym === 'GREEN_BALL' || sym === 'PURPLE_BALL') {
          const color = sym === 'RED_BALL' ? 'red' : sym === 'GREEN_BALL' ? 'green' : 'purple';
          const valIdx = Math.floor(bonusRandoms.shift() * BALL_VALUES.length);
          return { value: Math.round(BALL_VALUES[valIdx] * bet * 10) / 10, color };
        }
        return null;
      })
    );
  }

  const board1 = initBoard(triggerGrid);
  const board2 = isYummy ? Array(COLS).fill(null).map(() => Array(ROWS).fill(null)) : null;

  let spinsLeft = MAX_SPINS;
  let totalWin = 0;
  let jackpotWon = null;

  // Simulate the spin cycles
  for (let spin = 0; spin < 20 && spinsLeft > 0; spin++) {
    let foundNew = false;

    for (const board of (board2 ? [board1, board2] : [board1])) {
      board.forEach((col, c) => {
        col.forEach((cell, r) => {
          if (cell !== null) return;
          const rand = bonusRandoms.shift() || 0;
          if (rand < 0.20) {
            const colors = ['red', 'green', 'purple'];
            const colorRand = bonusRandoms.shift() || 0;
            const valRand = bonusRandoms.shift() || 0;
            const valIdx = Math.floor(valRand * BALL_VALUES.length);
            board[c][r] = {
              value: Math.round(BALL_VALUES[valIdx] * bet * 10) / 10,
              color: colors[Math.floor(colorRand * 3)],
            };
            foundNew = true;
          }
        });
      });
    }

    if (foundNew) spinsLeft = MAX_SPINS;
    else spinsLeft--;

    // Check all-filled jackpot
    const allCells = [
      ...board1.flat(),
      ...(board2 ? board2.flat() : []),
    ].filter(Boolean);

    const allFilled = board1.flat().every(c => c !== null) ||
      (board2 && board2.flat().every(c => c !== null));

    if (allFilled) {
      const colorCounts = {};
      allCells.forEach(c => { colorCounts[c.color] = (colorCounts[c.color] || 0) + 1; });
      const max = Math.max(...Object.values(colorCounts));
      if (max >= 15)      jackpotWon = 'GRAND';
      else if (max >= 12) jackpotWon = 'MAJOR';
      else if (max >= 9)  jackpotWon = 'MINOR';
      else if (max >= 6)  jackpotWon = 'MINI';
      break;
    }
  }

  // Sum up all ball values
  const boardWin = [...board1.flat(), ...(board2 ? board2.flat() : [])]
    .filter(Boolean)
    .reduce((s, c) => s + c.value, 0);

  totalWin = Math.round(boardWin * 100) / 100;

  // Add jackpot payout
  if (jackpotWon) {
    totalWin += Math.round(JACKPOT_MULTIPLIERS[`JP_${jackpotWon}`] * bet * 100) / 100;
  }

  return { bonusWin: totalWin, jackpotWon, board1, board2 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bet, currency = 'IC', accumulated_balls = { red: 0, green: 0, purple: 0 } } = await req.json();

    if (!bet || bet <= 0) return Response.json({ error: 'Invalid bet' }, { status: 400 });

    // Generate seed + hash for audit trail
    const seed = crypto.randomUUID() + '-' + Date.now().toString(36);
    const hash = await sha256(seed);

    // Build symbol pool (jackpots unlocked by bet level)
    const pool = buildPool(SYMBOL_WEIGHTS);
    for (const [jp, threshold] of Object.entries(JACKPOT_THRESHOLDS)) {
      if (bet >= threshold) {
        const w = JACKPOT_WEIGHTS[jp];
        for (let i = 0; i < w; i++) pool.push(jp);
      }
    }

    // Generate 15 randoms for the 5×3 grid + extras for bonus
    const randoms = cryptoRandoms(150); // generous buffer
    const randQueue = [...randoms];

    const mainGrid = generateGrid(randQueue.splice(0, 15), pool);

    // Analyze grid
    const { balls: newBalls, jackpots } = analyzeGrid(mainGrid, bet);

    // Accumulate balls
    const accum = {
      red:    accumulated_balls.red    + newBalls.red,
      green:  accumulated_balls.green  + newBalls.green,
      purple: accumulated_balls.purple + newBalls.purple,
    };

    const totalBallsThisSpin = newBalls.red + newBalls.green + newBalls.purple;
    // Bonus triggers: 1+ scatter of any color triggers Stack N' Hit feature
    const bonusTriggered = totalBallsThisSpin >= 1;

    // Paylines
    const { totalWin: paylineWin, winningCells } = checkPaylines(mainGrid, bet);

    // Jackpot symbols payout
    const jackpotBonus = jackpots.reduce((s, j) => s + j.payout, 0);

    let spinWin = Math.round((paylineWin + jackpotBonus) * 100) / 100;
    let bonusResult = null;

    // If bonus triggered, resolve it fully on server
    if (bonusTriggered) {
      const upsized = newBalls.red > 0;
      const yummy   = newBalls.green > 0;
      const bonusRandoms = cryptoRandoms(300);
      bonusResult = generateBonusOutcome(mainGrid, bet, upsized, yummy, [...bonusRandoms]);
      spinWin = Math.round((spinWin + bonusResult.bonusWin) * 100) / 100;
    }

    // Store round
    await base44.asServiceRole.entities.GameRound.create({
      user_email: user.email,
      game_slug: 'hotpot',
      seed,
      hash,
      outcome: JSON.stringify({ grid: mainGrid, paylineWin, jackpotBonus, bonusTriggered, bonusResult }),
      bet_amount: bet,
      win_amount: spinWin,
      house_edge: 0.07,
    });

    // Reset accumulator if bonus triggered
    const nextAccum = bonusTriggered
      ? { red: 0, green: 0, purple: 0 }
      : accum;

    return Response.json({
      success: true,
      seed,
      hash,
      grid: mainGrid,
      winningCells,
      spin_win: spinWin,
      payline_win: paylineWin,
      jackpot_hits: jackpots,
      bonus_triggered: bonusTriggered,
      bonus_result: bonusResult,
      accumulated_balls: nextAccum,
      new_balls: newBalls,
    });

  } catch (error) {
    console.error('HotPot outcome error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});