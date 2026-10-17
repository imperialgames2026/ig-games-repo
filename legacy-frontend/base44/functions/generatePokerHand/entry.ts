import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Provably fair poker hand generator
// SHA-256 hash of serverSeed + clientSeed + handNumber is committed before cards are dealt

function generateServerSeed() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push(r + s);
  return deck;
}

function shuffleDeck(deck, seed) {
  const arr = [...deck];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const rng = (max) => {
    hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
    hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
    hash ^= hash >>> 15;
    return Math.abs(hash) % max;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tableId, handNumber, playerEmails, clientSeed } = await req.json();

    const serverSeed = generateServerSeed();
    const combinedSeed = `${serverSeed}:${clientSeed || 'imperial'}:${handNumber}`;
    const handHash = await sha256(combinedSeed);

    const deck = shuffleDeck(buildDeck(), combinedSeed);

    // Deal cards: 2 hole cards per player, then 5 community
    const holeCards = {};
    let deckIdx = 0;
    for (const email of playerEmails) {
      holeCards[email] = [deck[deckIdx++], deck[deckIdx++]];
    }
    const communityCards = [deck[deckIdx], deck[deckIdx+1], deck[deckIdx+2], deck[deckIdx+3], deck[deckIdx+4]];

    // Deduct two separate amounts per hand:
    // 1. Regular ante (ante_bb_multiplier BB) → goes to current hand pot (visible)
    // 2. Bomb pot contribution (bomb_pot_bb_multiplier BB) → goes to hidden bomb_pot_fund
    try {
      const tables = await base44.asServiceRole.entities.SitAndGoTable.filter({ id: tableId });
      const table = tables[0];
      if (table) {
        const antePerPlayer = (table.ante_enabled && table.ante_bb_multiplier > 0)
          ? table.big_blind * table.ante_bb_multiplier : 0;
        const bombContribPerPlayer = (table.bomb_pot_enabled && table.bomb_pot_bb_multiplier > 0)
          ? table.big_blind * table.bomb_pot_bb_multiplier : 0;

        if (antePerPlayer > 0 || bombContribPerPlayer > 0) {
          const activePlayers = table.seated_players || [];
          let totalAnte = 0;
          let totalBombContrib = 0;

          const updatedPlayers = activePlayers.map(p => {
            if (playerEmails.includes(p.user_email)) {
              const anteDeduct = Math.min(antePerPlayer, p.stack);
              const remaining = p.stack - anteDeduct;
              const bombDeduct = Math.min(bombContribPerPlayer, remaining);
              totalAnte += anteDeduct;
              totalBombContrib += bombDeduct;
              return { ...p, stack: remaining - bombDeduct };
            }
            return p;
          });

          await base44.asServiceRole.entities.SitAndGoTable.update(table.id, {
            seated_players: updatedPlayers,
            pot: (table.pot || 0) + totalAnte,
            bomb_pot_fund: (table.bomb_pot_fund || 0) + totalBombContrib
          });

          console.log(`Hand #${handNumber}: Ante +${totalAnte} ID to pot, Bomb pot contrib +${totalBombContrib} ID to hidden fund`);
        }
      }
    } catch (anteErr) {
      console.error('Ante/bomb pot deduction error:', anteErr);
    }

    return Response.json({
      serverSeed,
      handHash,
      holeCards,
      communityCards,
      deck: deck.slice(0, deckIdx + 5)
    });
  } catch (error) {
    console.error('generatePokerHand error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});