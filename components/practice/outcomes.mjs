export const pockets = Object.freeze([0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
export const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
// Rejection sampling avoids modulo bias. This source is local practice only.
export function draw(max, fill = a => globalThis.crypto.getRandomValues(a)) {
  const limit = Math.floor(4294967296 / max) * max;
  const a = new Uint32Array(1);
  do { fill(a); } while (a[0] >= limit);
  return a[0] % max;
}
export function createOutcome(game, random = draw) {
  if (!['roulette','craps'].includes(game)) throw new Error('Unsupported practice game');
  const values = game === 'roulette' ? [random(37)] : [random(6)+1, random(6)+1];
  return Object.freeze({version:1, mode:'practice', roundId:globalThis.crypto.randomUUID(), game, values:Object.freeze(values)});
}
export function validateOutcome(o) {
  const max = o?.game === 'roulette' ? 36 : 6;
  return o?.version === 1 && o.mode === 'practice' && typeof o.roundId === 'string' &&
    ['roulette','craps'].includes(o.game) && Array.isArray(o.values) &&
    o.values.length === (o.game === 'roulette' ? 1 : 2) &&
    o.values.every(n => Number.isInteger(n) && n >= (o.game === 'roulette' ? 0 : 1) && n <= max);
}
// Renderer has no settlement or wallet authority. Unity receives the same immutable message.
export function presentToUnity(instance, outcome) {
  if (!validateOutcome(outcome)) throw new Error('Invalid practice outcome');
  instance.SendMessage('PracticeBridge', 'PresentOutcome', JSON.stringify(outcome));
}
export function passLine(point, total) {
  if (!point) return [7,11].includes(total) ? {point:0,result:'win'} : [2,3,12].includes(total) ? {point:0,result:'lose'} : {point:total,result:'point'};
  return total === point ? {point:0,result:'win'} : total === 7 ? {point:0,result:'lose'} : {point,result:'roll'};
}
