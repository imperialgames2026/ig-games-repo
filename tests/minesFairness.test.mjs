import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMinesBoard, verifyMinesRound } from '../lib/minesFairness.js';
import { sha256Hex } from '../lib/practiceFairDice.js';
const seed = 'ab'.repeat(32), clientSeed = 'client:unicode-🎲';
test('Mines matches independent Python HMAC/shuffle vectors at minimum, typical and maximum mine counts', async () => {
 assert.deepEqual(await calculateMinesBoard(seed,clientSeed,1),[7]);
 assert.deepEqual(await calculateMinesBoard(seed,clientSeed,3),[0,12,18]);
 assert.deepEqual(await calculateMinesBoard(seed,clientSeed,24),[0,1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24]);
});
test('Mines verifies completed transcripts and rejects hidden/forged or impossible outcomes', async () => {
 const commit = { roundId: 'round',mineCount: 3,serverSeedHash: await sha256Hex(seed),algorithm: 'hmac-sha256-mines-v1',practiceOnly: true };
 const ended = { ...commit,serverSeed: seed,clientSeed,phase: 'ended',mines: [0,12,18],picks: [1,2],endReason: 'stopped' };
 assert.equal(await verifyMinesRound(commit,ended),true);
 assert.equal(await verifyMinesRound(commit,{ ...ended,picks: [1,0],endReason: 'mine' }),true);
 for (const changed of [{ ...ended,phase: 'active' },{ ...ended,mines: [0,1,2] },{ ...ended,picks: [1,1] },
  { ...ended,picks: [0,1],endReason: 'mine' },{ ...ended,picks: [0] },{ ...ended,roundId: 'other' },
  { ...ended,clientSeed: 'altered' },{ ...ended,endReason: 'cleared' },{ ...ended,mineCount: 24 }]) {
  assert.equal(await verifyMinesRound(commit,changed),false);
 }
});
