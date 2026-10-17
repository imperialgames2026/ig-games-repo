import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/solanaNetwork.js', import.meta.url), 'utf8');
test('read-only Solana frontend adapter forbids signing and transfers', () => {
  assert.match(source, /getHealth/);
  assert.match(source, /getTokenAccountsByOwner/);
  assert.match(source, /Unsupported Solana network/);
  assert.doesNotMatch(source, /sendTransaction|signTransaction|privateKey|secretKey/);
});
test('staking contract starts paused and has no stake transfer instruction', () => {
  const rust = readFileSync(new URL('../solana/programs/imperial_staking/src/lib.rs', import.meta.url), 'utf8');
  assert.match(rust, /pool\.is_paused = true/);
  assert.doesNotMatch(rust, /pub fn (stake|withdraw|claim_reward)\(/);
  assert.match(rust, /12_500/);
  assert.match(rust, /20_000/);
});
