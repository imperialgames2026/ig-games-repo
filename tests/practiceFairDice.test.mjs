import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, webcrypto } from 'node:crypto';
import { sha256Hex, calculatePracticeDice, verifyPracticeDice } from '../lib/practiceFairDice.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

test('practice dice SHA-256 commitment matches an independent hash', async () => {
  const seed = 'imperial-staging-verifiable-server-seed';
  assert.equal(await sha256Hex(seed), createHash('sha256').update(seed).digest('hex'));
});

test('practice dice result matches independently calculated HMAC samples', async () => {
  const serverSeed = 'secret-unique-seed';
  const clientSeed = 'user-controlled-seed';
  const nonce = 3;
  const bytes = createHmac('sha256', serverSeed)
    .update(clientSeed + ':' + nonce + ':0').digest();
  const sample = bytes.readUInt32BE(0);
  assert.ok(sample < 4294967292);
  const firstDie = sample % 6 + 1;
  const outcome = await calculatePracticeDice(serverSeed, clientSeed, nonce);
  assert.equal(outcome.dice[0], firstDie);
  assert.ok(outcome.dice.every(n => Number.isInteger(n) && n >= 1 && n <= 6));
  assert.equal(outcome.sum, outcome.dice[0] + outcome.dice[1]);
});

test('verified practice reveal rejects modified outcome, nonce and server seed', async () => {
  const serverSeed = 'private-seed', clientSeed = 'public-seed', nonce = 0;
  const serverHash = createHash('sha256').update(serverSeed).digest('hex');
  const commit = {
    id: 'round-1', game: 'dice', phase: 'committed',
    server_seed_hash: serverHash, nonce, algorithm: 'hmac-sha256-v2',
  };
  const reveal = {
    phase: 'revealed', roundId: 'round-1', game: 'dice',
    serverSeed, serverSeedHash: serverHash, clientSeed, nonce,
    outcome: await calculatePracticeDice(serverSeed, clientSeed, nonce),
    algorithm: 'hmac-sha256-v2',
  };
  assert.equal(await verifyPracticeDice(commit, reveal, clientSeed), true);
  assert.equal(await verifyPracticeDice(commit, {
    ...reveal, outcome: { ...reveal.outcome, sum: reveal.outcome.sum + 1 },
  }, clientSeed), false);
  assert.equal(await verifyPracticeDice(commit, {...reveal, nonce: 1}, clientSeed), false);
  assert.equal(await verifyPracticeDice(commit, {...reveal, serverSeed: 'wrong'}, clientSeed), false);
  assert.equal(await verifyPracticeDice(commit, {...reveal, roundId: 'round-2'}, clientSeed), false);
});
