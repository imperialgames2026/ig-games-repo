import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SUITS = ['S', 'H', 'D', 'C'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function buildDeck() {
  const deck = [];
  for (let d = 0; d < 6; d++) {
    for (const suit of SUITS) {
      for (const val of VALUES) {
        deck.push(`${val}${suit}`);
      }
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardValue(card) {
  const val = card.slice(0, -1);
  if (['J', 'Q', 'K'].includes(val)) return 10;
  if (val === 'A') return 11;
  return parseInt(val);
}

function calcScore(cards) {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    const v = card.slice(0, -1);
    if (v === 'A') { aces++; score += 11; }
    else if (['J', 'Q', 'K'].includes(v)) score += 10;
    else score += parseInt(v);
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

function isBlackjack(cards) {
  return cards.length === 2 && calcScore(cards) === 21;
}

function nextHandId(hands, currentHandId) {
  const idx = hands.findIndex(h => h.hand_id === currentHandId);
  for (let i = idx + 1; i < hands.length; i++) {
    if (hands[i].status === 'active' || hands[i].status === 'waiting') return hands[i].hand_id;
  }
  return null;
}

function determineResult(handCards, dealerCards) {
  const handScore = calcScore(handCards);
  const dealerScore = calcScore(dealerCards);
  const handBJ = isBlackjack(handCards);
  const dealerBJ = isBlackjack(dealerCards);
  if (handBJ && dealerBJ) return 'push';
  if (handBJ) return 'blackjack';
  if (dealerBJ) return 'lose';
  if (handScore > 21) return 'lose';
  if (dealerScore > 21) return 'win';
  if (handScore > dealerScore) return 'win';
  if (handScore < dealerScore) return 'lose';
  return 'push';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, table_id, hand_id, bet, currency, seat, insurance } = await req.json();

    // Load table
    const tables = await base44.asServiceRole.entities.BlackjackTable.filter({ id: table_id });
    if (!tables.length) return Response.json({ error: 'Table not found' }, { status: 404 });
    const table = tables[0];

    // Load or create round
    let round = null;
    if (table.current_round_id) {
      const rounds = await base44.asServiceRole.entities.BlackjackRound.filter({ id: table.current_round_id });
      round = rounds[0] || null;
    }

    // ── PLACE BET ──
    if (action === 'place_bet') {
      // Deduct from wallet
      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: user.email });
      if (!wallets.length) return Response.json({ error: 'Wallet not found' }, { status: 404 });
      const wallet = wallets[0];
      const balance = currency === 'IC' ? wallet.tokens : wallet.cat_dollars;
      if (balance < bet) return Response.json({ error: 'Insufficient balance' }, { status: 400 });

      // Deduct
      if (currency === 'IC') {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { tokens: balance - bet });
      } else {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { cat_dollars: balance - bet });
      }

      // Create or get betting round
      if (!round || round.status === 'complete') {
        const deck = shuffleDeck(buildDeck());
        round = await base44.asServiceRole.entities.BlackjackRound.create({
          table_id,
          status: 'betting',
          deck,
          dealer_cards: [],
          dealer_score: 0,
          hands: [],
          action_on_hand: null,
        });
        await base44.asServiceRole.entities.BlackjackTable.update(table.id, { current_round_id: round.id });
      }

      const handId = `${user.email}_seat${seat}_${Date.now()}`;
      const newHand = {
        hand_id: handId,
        user_email: user.email,
        display_name: user.full_name || user.email.split('@')[0],
        seat,
        cards: [],
        score: 0,
        bet,
        currency,
        status: 'waiting',
        insurance_bet: 0,
        doubled: false,
        result: 'pending',
      };

      const updatedHands = [...(round.hands || []), newHand];
      await base44.asServiceRole.entities.BlackjackRound.update(round.id, { hands: updatedHands });

      // Add to seated players if not already there
      const seated = table.seated_players || [];
      if (!seated.find(p => p.user_email === user.email && p.seat === seat)) {
        await base44.asServiceRole.entities.BlackjackTable.update(table.id, {
          seated_players: [...seated, { user_email: user.email, display_name: user.full_name || user.email.split('@')[0], seat }]
        });
      }

      return Response.json({ success: true, hand_id: handId, round_id: round.id });
    }

    // ── DEAL ──
    if (action === 'deal') {
      if (!round || round.status !== 'betting') return Response.json({ error: 'Not in betting phase' }, { status: 400 });
      if (!round.hands.length) return Response.json({ error: 'No bets placed' }, { status: 400 });

      let deck = [...round.deck];
      const hands = round.hands.map(h => ({ ...h }));

      // Deal 2 cards to each hand, then 2 to dealer
      for (const hand of hands) {
        hand.cards = [deck.shift(), deck.shift()];
        hand.score = calcScore(hand.cards);
        hand.status = isBlackjack(hand.cards) ? 'blackjack' : 'waiting';
      }
      const dealerCards = [deck.shift(), deck.shift()];
      const dealerScore = calcScore(dealerCards);

      // Set first non-blackjack hand as active
      const firstActive = hands.find(h => h.status === 'waiting');
      if (firstActive) firstActive.status = 'active';
      const actionOn = firstActive ? firstActive.hand_id : null;

      // If dealer shows Ace, insurance phase — mark status as playing (insurance offered client-side)
      const dealerShowsAce = dealerCards[0]?.slice(0, -1) === 'A';

      await base44.asServiceRole.entities.BlackjackRound.update(round.id, {
        status: actionOn ? 'playing' : 'dealer_turn',
        deck,
        dealer_cards: dealerCards,
        dealer_score: dealerScore,
        hands,
        action_on_hand: actionOn,
      });

      return Response.json({ success: true, dealer_shows_ace: dealerShowsAce });
    }

    // ── HIT ──
    if (action === 'hit') {
      if (!round || round.status !== 'playing') return Response.json({ error: 'Not playing' }, { status: 400 });
      const hands = round.hands.map(h => ({ ...h }));
      const hand = hands.find(h => h.hand_id === hand_id);
      if (!hand || hand.status !== 'active') return Response.json({ error: 'Not your turn' }, { status: 400 });

      let deck = [...round.deck];
      hand.cards.push(deck.shift());
      hand.score = calcScore(hand.cards);

      if (hand.score > 21) {
        hand.status = 'bust';
        hand.result = 'lose';
        // Move to next hand
        const next = nextHandId(hands, hand_id);
        if (next) hands.find(h => h.hand_id === next).status = 'active';
        const allDone = hands.every(h => ['bust', 'stand', 'blackjack', 'done'].includes(h.status));
        await base44.asServiceRole.entities.BlackjackRound.update(round.id, {
          deck, hands,
          action_on_hand: next,
          status: allDone ? 'dealer_turn' : 'playing',
        });
      } else {
        await base44.asServiceRole.entities.BlackjackRound.update(round.id, { deck, hands });
      }

      return Response.json({ success: true });
    }

    // ── STAND ──
    if (action === 'stand') {
      if (!round || round.status !== 'playing') return Response.json({ error: 'Not playing' }, { status: 400 });
      const hands = round.hands.map(h => ({ ...h }));
      const hand = hands.find(h => h.hand_id === hand_id);
      if (!hand || hand.status !== 'active') return Response.json({ error: 'Not your turn' }, { status: 400 });

      hand.status = 'stand';
      const next = nextHandId(hands, hand_id);
      if (next) hands.find(h => h.hand_id === next).status = 'active';
      const allDone = hands.every(h => ['bust', 'stand', 'blackjack', 'done'].includes(h.status));

      await base44.asServiceRole.entities.BlackjackRound.update(round.id, {
        hands,
        action_on_hand: next,
        status: allDone ? 'dealer_turn' : 'playing',
      });
      return Response.json({ success: true });
    }

    // ── DOUBLE DOWN ──
    if (action === 'double') {
      if (!round || round.status !== 'playing') return Response.json({ error: 'Not playing' }, { status: 400 });
      const hands = round.hands.map(h => ({ ...h }));
      const hand = hands.find(h => h.hand_id === hand_id);
      if (!hand || hand.status !== 'active' || hand.cards.length !== 2) return Response.json({ error: 'Cannot double' }, { status: 400 });

      // Deduct extra bet
      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: user.email });
      const wallet = wallets[0];
      const balance = hand.currency === 'IC' ? wallet.tokens : wallet.cat_dollars;
      if (balance < hand.bet) return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      if (hand.currency === 'IC') {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { tokens: balance - hand.bet });
      } else {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { cat_dollars: balance - hand.bet });
      }

      let deck = [...round.deck];
      hand.cards.push(deck.shift());
      hand.score = calcScore(hand.cards);
      hand.bet *= 2;
      hand.doubled = true;
      hand.status = hand.score > 21 ? 'bust' : 'stand';
      if (hand.score > 21) hand.result = 'lose';

      const next = nextHandId(hands, hand_id);
      if (next) hands.find(h => h.hand_id === next).status = 'active';
      const allDone = hands.every(h => ['bust', 'stand', 'blackjack', 'done'].includes(h.status));

      await base44.asServiceRole.entities.BlackjackRound.update(round.id, {
        deck, hands,
        action_on_hand: next,
        status: allDone ? 'dealer_turn' : 'playing',
      });
      return Response.json({ success: true });
    }

    // ── INSURANCE ──
    if (action === 'insurance') {
      if (!round || round.status !== 'playing') return Response.json({ error: 'Not playing' }, { status: 400 });
      const hands = round.hands.map(h => ({ ...h }));
      const hand = hands.find(h => h.hand_id === hand_id);
      if (!hand) return Response.json({ error: 'Hand not found' }, { status: 400 });

      const insBet = hand.bet / 2;
      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: user.email });
      const wallet = wallets[0];
      const balance = hand.currency === 'IC' ? wallet.tokens : wallet.cat_dollars;
      if (balance < insBet) return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      if (hand.currency === 'IC') {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { tokens: balance - insBet });
      } else {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { cat_dollars: balance - insBet });
      }

      hand.insurance_bet = insBet;
      await base44.asServiceRole.entities.BlackjackRound.update(round.id, { hands });
      return Response.json({ success: true });
    }

    // ── SPLIT ──
    if (action === 'split') {
      if (!round || round.status !== 'playing') return Response.json({ error: 'Not playing' }, { status: 400 });
      const hands = round.hands.map(h => ({ ...h }));
      const hand = hands.find(h => h.hand_id === hand_id);
      if (!hand || hand.status !== 'active') return Response.json({ error: 'Not your turn' }, { status: 400 });
      if (hand.cards.length !== 2) return Response.json({ error: 'Can only split on first two cards' }, { status: 400 });
      if (hand.cards[0].slice(0, -1) !== hand.cards[1].slice(0, -1)) return Response.json({ error: 'Cards must be a pair to split' }, { status: 400 });
      if (hand.is_split_child) return Response.json({ error: 'Cannot split a split hand again' }, { status: 400 });

      // Deduct extra bet equal to original bet
      const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: user.email });
      const wallet = wallets[0];
      const balance = hand.currency === 'IC' ? wallet.tokens : wallet.cat_dollars;
      if (balance < hand.bet) return Response.json({ error: 'Insufficient balance for split' }, { status: 400 });
      if (hand.currency === 'IC') {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { tokens: balance - hand.bet });
      } else {
        await base44.asServiceRole.entities.UserWallet.update(wallet.id, { cat_dollars: balance - hand.bet });
      }

      let deck = [...round.deck];
      // Keep one card in current hand, move second to new hand, deal one new card to each
      const [card1, card2] = hand.cards;
      hand.cards = [card1, deck.shift()];
      hand.score = calcScore(hand.cards);
      hand.status = calcScore(hand.cards) === 21 ? 'blackjack' : 'active';

      const newHandId = `${user.email}_split_${Date.now()}`;
      const newHand = {
        hand_id: newHandId,
        user_email: hand.user_email,
        display_name: hand.display_name,
        seat: hand.seat,
        cards: [card2, deck.shift()],
        score: 0,
        bet: hand.bet,
        currency: hand.currency,
        status: 'waiting',
        insurance_bet: 0,
        doubled: false,
        result: 'pending',
        is_split_child: true,
      };
      newHand.score = calcScore(newHand.cards);
      if (newHand.score === 21) newHand.status = 'blackjack';

      // Insert new hand right after current hand in order
      const currentIdx = hands.findIndex(h => h.hand_id === hand_id);
      hands.splice(currentIdx + 1, 0, newHand);

      await base44.asServiceRole.entities.BlackjackRound.update(round.id, { deck, hands, action_on_hand: hand.status === 'active' ? hand_id : newHandId });

      return Response.json({ success: true, new_hand_id: newHandId });
    }

    // ── DEALER TURN + SETTLE ──
    if (action === 'dealer_turn') {
      if (!round || round.status !== 'dealer_turn') return Response.json({ error: 'Not dealer turn' }, { status: 400 });

      let deck = [...round.deck];
      let dealerCards = [...round.dealer_cards];
      // Dealer draws to 17
      while (calcScore(dealerCards) < 17) {
        dealerCards.push(deck.shift());
      }
      const dealerScore = calcScore(dealerCards);
      const dealerBJ = isBlackjack(dealerCards);

      const hands = round.hands.map(h => ({ ...h }));

      // Settle each hand
      for (const hand of hands) {
        if (hand.status === 'bust') {
          hand.result = 'lose';
          hand.status = 'done';
          continue;
        }

        const result = determineResult(hand.cards, dealerCards);
        hand.result = result;
        hand.status = 'done';

        // Credit winnings
        const wallets = await base44.asServiceRole.entities.UserWallet.filter({ user_email: hand.user_email });
        if (!wallets.length) continue;
        const wallet = wallets[0];
        let payout = 0;

        if (result === 'blackjack') payout = hand.bet + hand.bet * 1.5;
        else if (result === 'win') payout = hand.bet * 2;
        else if (result === 'push') payout = hand.bet;
        else payout = 0;

        // Insurance payout
        if (hand.insurance_bet > 0) {
          if (dealerBJ) payout += hand.insurance_bet * 3; // 2:1 pays back bet + 2x
        }

        if (payout > 0) {
          if (hand.currency === 'IC') {
            await base44.asServiceRole.entities.UserWallet.update(wallet.id, { tokens: wallet.tokens + payout });
          } else {
            await base44.asServiceRole.entities.UserWallet.update(wallet.id, { cat_dollars: wallet.cat_dollars + payout });
          }
        }

        // Log transaction
        await base44.asServiceRole.entities.Transaction.create({
          user_email: hand.user_email,
          type: payout > hand.bet ? 'win' : payout === hand.bet ? 'win' : 'loss',
          amount: payout > 0 ? payout - hand.bet : -hand.bet,
          game_slug: 'blackjack-multiplayer',
          description: `Blackjack: ${result}`,
          cat_dollars: hand.currency === 'ID' ? (payout > 0 ? payout - hand.bet : -hand.bet) : 0,
        });
      }

      await base44.asServiceRole.entities.BlackjackRound.update(round.id, {
        status: 'complete',
        deck,
        dealer_cards: dealerCards,
        dealer_score: dealerScore,
        hands,
        action_on_hand: null,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Blackjack error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});