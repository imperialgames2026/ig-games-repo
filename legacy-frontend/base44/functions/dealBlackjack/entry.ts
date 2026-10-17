import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SUITS = ['S', 'H', 'D', 'C'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cryptoShuffle(deck) {
  const arr = [...deck];
  const randoms = new Uint32Array(arr.length);
  crypto.getRandomValues(randoms);
  // Fisher-Yates using crypto random values
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randoms[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const deck = cryptoShuffle(buildDeck());

    // Deal: player gets index 0,2 — dealer gets index 1,3 — rest is remaining deck
    const playerHand = [deck[0], deck[2]];
    const dealerHand = [deck[1], deck[3]];
    const remaining = deck.slice(4);

    return Response.json({ playerHand, dealerHand, deck: remaining });
  } catch (error) {
    console.error('dealBlackjack error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});