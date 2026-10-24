export const ACTION_DURATION_MS = 5400;
export const validAmount = n => Number.isSafeInteger(n) && n >= 1;
export function validSelection(game, s) {
  return typeof s === 'string' && (game === 'craps' ? s === 'pass' : game === 'roulette' && (['red', 'black', 'even', 'odd'].includes(s) || /^(?:[0-9]|[12][0-9]|3[0-6])$/.test(s)));
}
export function validBet(b) {
  return b?.version === 1 && ['roulette', 'craps'].includes(b.game) && typeof b.locked === 'boolean' && Array.isArray(b.placements) && b.placements.length <= 41 && b.placements.every(p => validSelection(b.game, p.selection) && validAmount(p.amount)) && new Set(b.placements.map(p => p.selection)).size === b.placements.length;
}
export function betPixel(game, s) {
  if (game === 'craps') return {
    x: 895,
    y: 857
  };
  const outside = {
    red: 970,
    black: 1254,
    even: 686,
    odd: 1538
  };
  if (s in outside) return {
    x: outside[s],
    y: 880
  };
  const n = Number(s);
  if (n === 0) return {
    x: 165,
    y: 445
  };
  return {
    x: 260 + Math.floor((n - 1) / 3) * 142 + 71,
    y: 190 + (2 - (n - 1) % 3) * 170 + 85
  };
}
export function betPosition(game, s) {
  const p = betPixel(game, s);
  return game === 'craps' ? {
    x: (p.x / 2048 - .5) * 9.6,
    z: (.5 - p.y / 1024) * 4.25
  } : {
    x: 2.1 + (p.x / 2048 - .5) * 4.7,
    z: (.5 - p.y / 1024) * 3.4
  };
}
export function betFromPixel(game, x, y) {
  if (game === 'craps') return y >= 800 && y <= 980 && (x >= 80 && x <= 956 || x >= 1085 && x <= 1961) ? 'pass' : null;
  if (x >= 70 && x < 260 && y >= 190 && y < 700) return '0';
  if (x >= 260 && x < 1964 && y >= 190 && y < 700) return String(Math.floor((x - 260) / 142) * 3 + 3 - Math.floor((y - 190) / 170));
  if (x >= 260 && x < 1964 && y >= 815 && y <= 945) return [null, 'even', 'red', 'black', 'odd', null][Math.floor((x - 260) / 284)];
  return null;
}
export const betName = s => s === '0' ? 'green 0' : s === 'pass' ? 'pass line' : s;
// Inverse of CasinoScene.CameraView: a screen ray hits the felt plane. Keeping
// input in the frame avoids platform-dependent Unity mouse emulation on touch.
export function selectionAtScreen(game, x, y, aspect, camera = 'table', zoom = 1.12) {
  if (!['roulette', 'craps'].includes(game) || ![x, y, aspect, zoom].every(Number.isFinite) || aspect <= 0 || x < 0 || x > 1 || y < 0 || y > 1) return null;
  const tan = Math.tan(21 * Math.PI / 180),
    overhead = camera === 'overhead',
    z = overhead ? -.001 : -.85,
    n = Math.hypot(1, z),
    ny = 1 / n,
    nz = z / n;
  const distance = (Math.max(10.7 / (2 * tan * Math.max(.5, aspect)), (overhead ? 6 : 4.7) / (2 * tan)) + 1.9) / zoom;
  const sy = (y * 2 - 1) * tan,
    dx = (x * 2 - 1) * tan * aspect,
    dy = -ny - sy * nz,
    dz = -nz + sy * ny;
  if (Math.abs(dy) < 1e-6) return null;
  const t = (.02 - distance * ny) / dy;
  if (t < 0) return null;
  const px = t * dx,
    pz = distance * nz + t * dz;
  return game === 'roulette' ? betFromPixel(game, ((px - 2.1) / 4.7 + .5) * 2048, (.5 - pz / 3.4) * 1024) : betFromPixel(game, (px / 9.6 + .5) * 2048, (.5 - pz / 4.25) * 1024);
}
