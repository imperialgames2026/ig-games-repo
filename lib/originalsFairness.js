import { sha256Hex } from './practiceFairDice.js';

export const ORIGINALS_GAMES = ['coin','hashdice','limbo','plinko','wheel'];
const encoder = new TextEncoder();
export async function calculateOriginalsOutcome(seed, clientSeed, game) {
  if (!/^[0-9a-f]{64}$/.test(seed) || typeof clientSeed !== 'string' || !clientSeed.length ||
      clientSeed.length > 128 || !ORIGINALS_GAMES.includes(game)) throw new TypeError('Invalid proof inputs');
  const bound = game === 'hashdice' ? 100000 : game === 'wheel' ? 20 : game === 'limbo' ? 4294967296 : 2;
  const limit = Math.floor(4294967296 / bound) * bound;
  const needed = game === 'plinko' ? 12 : 1;
  const key = await crypto.subtle.importKey('raw', encoder.encode(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const samples = [];
  for (let counter = 0; counter < 64 && samples.length < needed; counter++) {
    const digest = new DataView(await crypto.subtle.sign('HMAC', key, encoder.encode(`${game}:${clientSeed}:0:${counter}`)));
    for (let offset = 0; offset < 32 && samples.length < needed; offset += 4) {
      const value = digest.getUint32(offset, false);
      if (value < limit) samples.push(value % bound);
    }
  }
  if (samples.length !== needed) throw new Error('Proof sampling failed');
  if (game === 'coin') return { coin: samples[0] === 0 ? 'heads' : 'tails' };
  if (game === 'hashdice') return { roll: samples[0] };
  if (game === 'limbo') return { multiplier: Math.max(1, Math.min(1000000, Math.floor(98 * 4294967296 / (4294967296 - samples[0])) / 100)) };
  if (game === 'wheel') return { segment: samples[0], color: ['gold','blue','pink','purple'][samples[0] % 4] };
  return { path: samples, bin: samples.reduce((sum, n) => sum + n, 0), rows: 12 };
}
function equal(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const keys = Object.keys(a).sort(), other = Object.keys(b).sort();
  return Array.isArray(a) === Array.isArray(b) && keys.length === other.length &&
    keys.every((key, i) => key === other[i] && equal(a[key], b[key]));
}
export async function verifyOriginalsRound(commit, reveal, expected) {
  if (!commit || !reveal || !expected || !ORIGINALS_GAMES.includes(expected.game) ||
      commit.phase !== 'committed' || reveal.phase !== 'revealed' ||
      commit.game !== expected.game || reveal.game !== expected.game ||
      commit.id !== reveal.roundId || reveal.clientSeed !== expected.clientSeed ||
      commit.algorithm !== 'hmac-sha256-v3' || reveal.algorithm !== 'hmac-sha256-v3' ||
      commit.nonce !== 0 || reveal.nonce !== 0 || commit.practiceOnly !== true || reveal.practiceOnly !== true ||
      commit.server_seed_hash !== reveal.serverSeedHash ||
      !/^[0-9a-f]{64}$/.test(reveal.serverSeed) ||
      Object.hasOwn(commit, 'serverSeed') || Object.hasOwn(commit, 'server_seed')) return false;
  if (await sha256Hex(reveal.serverSeed) !== commit.server_seed_hash) return false;
  return equal(await calculateOriginalsOutcome(reveal.serverSeed, reveal.clientSeed, reveal.game), reveal.outcome);
}
