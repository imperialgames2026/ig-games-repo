import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const wallet = readFileSync(new URL('../lib/solanaWallet.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../components/solana/DevnetWalletPanel.jsx', import.meta.url), 'utf8');
test('wallet connector enforces Devnet and uses read-only RPC', () => {
  assert.match(wallet, /assertDevnet\(\)/);
  assert.match(wallet, /getTokenAccountsByOwner/);
  assert.match(wallet, /getBalance/);
  assert.doesNotMatch(wallet, /signTransaction|sendTransaction|secretKey/);
});
test('wallet panel discloses restrictions', () => {
  assert.match(panel, /No deposits, staking or transfers enabled/);
  assert.match(panel, /Connect Phantom \(Devnet\)/);
});
