import {
  initial,
  deck,
  deal,
  take,
  log,
  finish,
  requireThat,
  reduce,
  follow,
  winner,
  collect,
  names,
} from "./common.js";
export function create(seed = 1) {
  const s = { ...initial(seed), dealer: 3, target: 500, bags: [0, 0] };
  newRound(s);
  return s;
}
function newRound(s) {
  s.round++;
  deal(s, deck(Array.from({ length: 13 }, (_, i) => i + 2)), 13);
  s.bids = [null, null, null, null];
  s.taken = [0, 0, 0, 0];
  s.trick = [];
  s.lastTrick = [];
  s.trickNumber = 0;
  s.broken = false;
  s.trump = "S";
  s.phase = "bid";
  s.turn = (s.dealer + 1) % 4;
  log(
    s,
    `Hand ${s.round}. Bid 0–13; zero is a nil bid. Spades are always trump.`,
  );
}
export function legalCards(s, p = s.turn) {
  if (s.phase !== "play" || s.over) return [];
  let legal = follow(s.hands[p], s.trick);
  if (!s.trick.length && !s.broken) {
    const plain = legal.filter((c) => c.s !== "S");
    if (plain.length) legal = plain;
  }
  return legal;
}
export function handScore(bids, taken, bags) {
  const delta = [0, 0],
    nextBags = [...bags];
  for (let team = 0; team < 2; team++) {
    const players = [team, team + 2];
    const contract = players.reduce((n, p) => n + bids[p], 0),
      supported = players.reduce((n, p) => n + (bids[p] > 0 ? taken[p] : 0), 0),
      nilTricks = players.reduce(
        (n, p) => n + (bids[p] === 0 ? taken[p] : 0),
        0,
      );
    const extras = Math.max(0, supported - contract) + nilTricks;
    delta[team] =
      supported >= contract
        ? 10 * contract + Math.max(0, supported - contract)
        : -10 * contract;
    delta[team] += nilTricks;
    for (const p of players)
      if (bids[p] === 0) delta[team] += taken[p] === 0 ? 100 : -100;
    nextBags[team] += extras;
    const penalties = Math.floor(nextBags[team] / 10);
    delta[team] -= penalties * 100;
    nextBags[team] %= 10;
  }
  return { delta, bags: nextBags };
}
export function apply(s, a) {
  return reduce(s, a, (n, a) => {
    requireThat(!n.over, "Match finished.");
    if (a.type === "next") {
      requireThat(n.phase === "round", "Finish this hand first.");
      n.dealer = (n.dealer + 1) % 4;
      newRound(n);
      return;
    }
    if (a.type === "bid") {
      requireThat(
        n.phase === "bid" && n.bids[n.turn] === null,
        "Bidding is closed for this seat.",
      );
      requireThat(
        Number.isInteger(a.amount) && a.amount >= 0 && a.amount <= 13,
        "Bid a whole number from 0 to 13.",
      );
      n.bids[n.turn] = a.amount;
      log(n, `${names[n.turn]} bids ${a.amount === 0 ? "nil" : a.amount}.`);
      n.turn = (n.turn + 1) % 4;
      if (n.bids.every((b) => b !== null)) {
        n.phase = "play";
        n.turn = (n.dealer + 1) % 4;
        log(
          n,
          `${names[n.turn]} leads. Spades cannot lead until broken unless holding only spades.`,
        );
      }
      return;
    }
    requireThat(
      a.type === "play" && legalCards(n).some((c) => c.id === a.id),
      "Follow suit; spades cannot lead before broken unless you hold only spades.",
    );
    const card = take(n.hands[n.turn], a.id);
    if (card.s === "S") n.broken = true;
    n.trick.push({ player: n.turn, card });
    if (n.trick.length === 4) {
      const win = winner(n.trick, "S");
      collect(n, win);
      if (n.trickNumber === 13) {
        const scored = handScore(n.bids, n.taken, n.bags);
        n.scores = n.scores.map((v, t) => v + scored.delta[t]);
        n.bags = scored.bags;
        n.phase = "round";
        log(
          n,
          `Hand change ${scored.delta.join(" / ")}. Bags ${n.bags.join(" / ")}. Match ${n.scores.join(" – ")}.`,
        );
        if (Math.max(...n.scores) >= n.target && n.scores[0] !== n.scores[1])
          finish(
            n,
            `${n.scores[0] > n.scores[1] ? "South + North" : "West + East"} wins the Spades match.`,
          );
      }
    } else n.turn = (n.turn + 1) % 4;
  });
}
export function bot(s) {
  const hand = s.hands[s.turn];
  if (s.phase === "bid") {
    const spades = hand.filter((c) => c.s === "S");
    if (
      spades.length <= 2 &&
      spades.every((c) => c.r <= 9) &&
      hand.every((c) => c.r <= 11)
    )
      return { type: "bid", amount: 0 };
    let amount = hand.filter((c) => c.r === 14).length;
    amount += hand.filter(
      (c) => c.r === 13 && hand.filter((x) => x.s === c.s).length >= 2,
    ).length;
    amount += Math.max(0, spades.length - 3);
    amount += spades.filter((c) => c.r >= 11 && c.r <= 12).length;
    return { type: "bid", amount: Math.max(1, Math.min(10, amount)) };
  }
  const legal = legalCards(s),
    cost = (c) => (c.s === "S" ? 20 : 0) + c.r,
    ordered = [...legal].sort((a, b) => cost(a) - cost(b));
  if (!s.trick.length) return { type: "play", id: ordered[0].id };
  const winning = ordered.filter(
      (c) => winner([...s.trick, { player: s.turn, card: c }], "S") === s.turn,
    ),
    losing = ordered.filter((c) => !winning.includes(c));
  const nil = s.bids[s.turn] === 0,
    current = winner(s.trick, "S"),
    partner = (s.turn + 2) % 4,
    need =
      s.taken[s.turn] + s.taken[partner] < s.bids[s.turn] + s.bids[partner];
  let choice;
  if (nil || !need) choice = losing.at(-1) || ordered[0];
  else if (current === partner && s.bids[partner] !== 0)
    choice = losing.at(-1) || ordered[0];
  else choice = winning[0] || losing.at(-1) || ordered[0];
  return { type: "play", id: choice.id };
}
