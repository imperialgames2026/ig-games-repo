import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

// Explicitly pinned to disposable staging, never production.
const URL = 'https://qonqemhljgxlwpghkxhn.supabase.co';
const env = process.env;
assert.equal(env.ALLOW_DESTRUCTIVE_STAGING_TESTS, 'true', 'Staging test opt-in required');
for (const key of ['STAGING_SUPABASE_ANON_KEY', 'STAGING_PLAYER_EMAIL', 'STAGING_PLAYER_PASSWORD', 'STAGING_RECIPIENT_EMAIL', 'STAGING_RECIPIENT_PASSWORD']) {
  assert.ok(env[key], `Missing ${key}`);
}
const makeClient = () => createClient(URL, env.STAGING_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sender = makeClient(), recipient = makeClient();
async function login(client, email, password, role) {
  // Do not print emails, passwords, tokens, or full auth error objects in CI.
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    throw new Error(`${role} staging authentication failed (HTTP ${error.status ?? 'unknown'}, code ${error.code ?? 'unknown'}). Verify the ${role === 'sender' ? 'STAGING_PLAYER' : 'STAGING_RECIPIENT'} email/password secrets and project.`);
  }
  assert.ok(data.user, `${role} login returned no user`);
  return data.user.id;
}
const senderId = await login(sender, env.STAGING_PLAYER_EMAIL, env.STAGING_PLAYER_PASSWORD, 'sender');
const recipientId = await login(recipient, env.STAGING_RECIPIENT_EMAIL, env.STAGING_RECIPIENT_PASSWORD, 'recipient');
assert.notEqual(senderId, recipientId, 'Distinct staging accounts required');
async function balance(client, userId) {
  const { data, error } = await client.from('wallets').select('igt_balance').eq('user_id', userId).single();
  assert.ifError(error);
  return Number(data.igt_balance);
}
async function transfer(operationId, amount) {
  const { data: { session }, error } = await sender.auth.getSession();
  assert.ifError(error);
  assert.ok(session?.access_token);
  const response = await fetch(`${URL}/functions/v1/secure-wallet`, {
    method: 'POST',
    headers: { apikey: env.STAGING_SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'transfer', operation_id: operationId, amount, recipient_id: recipientId })
  });
  return { status: response.status, payload: await response.json() };
}
test('IGT transfer is atomic, idempotent, and conflict-safe', async () => {
  const beforeSender = await balance(sender, senderId), beforeRecipient = await balance(recipient, recipientId);
  assert.ok(beforeSender >= 10, 'Fund staging sender with at least 10 IGT');
  const id = randomUUID();
  const first = await transfer(id, 2);
  assert.equal(first.status, 200, JSON.stringify(first.payload));
  const replay = await transfer(id, 2);
  assert.equal(replay.status, 200, JSON.stringify(replay.payload));
  assert.deepEqual(replay.payload, first.payload);
  assert.equal(await balance(sender, senderId), beforeSender - 2);
  assert.equal(await balance(recipient, recipientId), beforeRecipient + 2);
  const conflict = await transfer(id, 3);
  assert.equal(conflict.status, 409, JSON.stringify(conflict.payload));
});
test('simultaneous independent IGT transfers both settle', async () => {
  const a = await balance(sender, senderId), b = await balance(recipient, recipientId);
  const results = await Promise.all([transfer(randomUUID(), 2), transfer(randomUUID(), 2)]);
  assert.ok(results.every(x => x.status === 200), JSON.stringify(results));
  assert.equal(await balance(sender, senderId), a - 4);
  assert.equal(await balance(recipient, recipientId), b + 4);
});
test('simultaneous duplicate requests debit only once', async () => {
  const a = await balance(sender, senderId), b = await balance(recipient, recipientId);
  const id = randomUUID();
  const results = await Promise.all([transfer(id, 2), transfer(id, 2)]);
  assert.ok(results.every(x => x.status === 200), JSON.stringify(results));
  assert.deepEqual(results[0].payload, results[1].payload);
  assert.equal(await balance(sender, senderId), a - 2);
  assert.equal(await balance(recipient, recipientId), b + 2);
});
