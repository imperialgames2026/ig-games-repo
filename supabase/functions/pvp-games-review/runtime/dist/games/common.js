import {randomInt} from "node:crypto";
export const suits = ["C", "D", "H", "S"];
export const symbols = { C: "♣", D: "♦", H: "♥", S: "♠" };
export const names = ["South", "West", "North", "East"];
export const rankLabel = (r) =>
  ({ 1: "A", 11: "J", 12: "Q", 13: "K", 14: "A" })[r] || String(r);
export const cardText = (c) => rankLabel(c.r) + symbols[c.s];
export const pip = (c) => Math.min(c.r, 10);
// Hosted practice uses CSPRNG draws; local/browser authored rules remain unchanged.
// Persisted results and receipts, rather than a predictable 32-bit seed, define retries.
export function random(_s) { return randomInt(0, 0x100000000) / 0x100000000; }
export function shuffle(items, s) {
  let a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function deck(
  ranks = Array.from({ length: 13 }, (_, i) => i + 1),
  copies = 1,
) {
  return Array.from({ length: copies }, (_, copy) =>
    suits.flatMap((s) => ranks.map((r) => ({ id: `${s}${r}-${copy}`, s, r }))),
  ).flat();
}
export function sortHand(hand) {
  return hand.sort(
    (a, b) => suits.indexOf(a.s) - suits.indexOf(b.s) || a.r - b.r,
  );
}
export function deal(s, cards, n, players = 4) {
  const d = shuffle(cards, s);
  s.hands = Array.from({ length: players }, () => []);
  for (let i = 0; i < n * players; i++) s.hands[i % players].push(d.pop());
  s.hands.forEach(sortHand);
  return d;
}
export function log(s, text) {
  s.log ??= [];
  s.log.push(text);
  if (s.log.length > 300) s.log.shift();
  s.message = text;
}
export function requireThat(test, message) {
  if (!test) throw new Error(message);
}
export function take(hand, id) {
  const i = hand.findIndex((c) => c.id === id);
  requireThat(i >= 0, "That card is not in this hand.");
  return hand.splice(i, 1)[0];
}
export function initial(seed) {
  return {
    seed: seed >>> 0 || 1,
    initialSeed: seed >>> 0 || 1,
    round: 0,
    scores: [0, 0],
    phase: "play",
    log: [],
    over: false,
    rulesVersion: 1,
  };
}
export const clone = (s) => JSON.parse(JSON.stringify(s));
export function reduce(state, action, fn) {
  const next = clone(state);
  fn(next, action);
  return next;
}
export function finish(s, text) {
  s.over = true;
  s.phase = "finished";
  log(s, text);
}
export function team(p) {
  return p % 2;
}
export function winner(
  trick,
  trump = null,
  effective = (c) => c.s,
  strength = (c) => c.r,
) {
  const led = effective(trick[0].card);
  const score = (c) =>
    (effective(c) === trump ? 200 : effective(c) === led ? 100 : 0) +
    strength(c);
  return trick.reduce((w, p) => (score(p.card) > score(w.card) ? p : w)).player;
}
export function follow(hand, trick, effective = (c) => c.s) {
  if (!trick.length) return hand;
  const led = effective(trick[0].card),
    matching = hand.filter((c) => effective(c) === led);
  return matching.length ? matching : hand;
}
export function collect(s, win) {
  s.lastTrick = [...s.trick];
  s.trick = [];
  s.turn = win;
  s.taken[win]++;
  s.trickNumber++;
  log(s, `${names[win]} won trick ${s.trickNumber}.`);
}
