import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateOriginalsOutcome, verifyOriginalsRound } from '../lib/originalsFairness.js';

const vectors = JSON.parse(readFileSync(new URL('./originalsFairnessVectors.json', import.meta.url)));
function proof(v) {
  return {
    commit: { phase: 'committed', id: 'round', game: v.game, server_seed_hash: v.hash, algorithm: 'hmac-sha256-v3', nonce: 0, practiceOnly: true },
    reveal: { phase: 'revealed', roundId: 'round', game: v.game, serverSeedHash: v.hash, serverSeed: v.serverSeed,
      clientSeed: v.clientSeed, algorithm: 'hmac-sha256-v3', nonce: 0, outcome: v.outcome, practiceOnly: true },
  };
}
for (const vector of vectors) {
  test(`${vector.game}: matches independent Python HMAC vector including Unicode seed`, async () => {
    assert.deepEqual(await calculateOriginalsOutcome(vector.serverSeed, vector.clientSeed, vector.game), vector.outcome);
    const { commit, reveal } = proof(vector);
    assert.equal(await verifyOriginalsRound(commit, reveal, { game: vector.game, clientSeed: vector.clientSeed }), true);
  });
}
test('rejects forged outcomes, altered identities, protocol downgrade and leaked commitments', async () => {
  const vector = vectors[0], { commit, reveal } = proof(vector);
  const expected = { game: vector.game, clientSeed: vector.clientSeed };
  for (const changed of [{ ...reveal, outcome: { coin: 'heads' } }, { ...reveal, roundId: 'other' },
    { ...reveal, game: 'wheel' }, { ...reveal, clientSeed: 'changed' }, { ...reveal, nonce: 1 },
    { ...reveal, practiceOnly: false }, { ...reveal, algorithm: 'hmac-sha256-v2' },
    { ...reveal, outcome: { ...reveal.outcome, payout: 100 } }]) {
    assert.equal(await verifyOriginalsRound(commit, changed, expected), false);
  }
  assert.equal(await verifyOriginalsRound({ ...commit, server_seed: vector.serverSeed }, reveal, expected), false);
});
test('Plinko path is bounded, sums to its bin and is independently verifiable', async () => {
  for (let i = 0; i < 32; i++) {
    const result = await calculateOriginalsOutcome(vectors[0].serverSeed, `path-${i}`, 'plinko');
    assert.equal(result.path.length, 12);
    assert.ok(result.path.every(n => n === 0 || n === 1));
    assert.equal(result.bin, result.path.reduce((a, b) => a + b, 0));
  }
});
