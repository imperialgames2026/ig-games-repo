import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePokerInvite } from '../lib/pokerInvite.js';

const tableId = '3ca56789-1234-4123-9234-123456789abc';
test('a bare room ID uses the selected game and only creates an internal destination', () => {
  assert.deepEqual(parsePokerInvite(`  ${tableId.toUpperCase()}  `, 'omaha'), {
    tableId, variant: 'omaha', fromLink: false, destination: '/PlayOmaha?tableId=' + tableId,
  });
  assert.equal(parsePokerInvite(tableId).destination, '/PlayPoker?tableId=' + tableId);
});
test('full and relative poker invitations select the variant in the invite', () => {
  const invite = parsePokerInvite('https://imperialgaming.llc/PlayOmaha?tableId=' + tableId, 'holdem');
  assert.equal(invite.variant, 'omaha'); assert.equal(invite.fromLink, true);
  assert.equal(parsePokerInvite('/PlayPoker?tableId=' + tableId).variant, 'holdem');
});
test('pasted destinations cannot redirect away from the poker application', () => {
  const invite = parsePokerInvite('https://example.invalid/PlayOmaha?tableId=' + tableId + '&returnTo=https://example.invalid');
  assert.equal(invite.destination, '/PlayOmaha?tableId=' + tableId);
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', 'https://person:secret@example.invalid/PlayPoker?tableId=' + tableId, '//example.invalid/login?tableId=' + tableId]) assert.equal(parsePokerInvite(value), null);
});
test('invalid, duplicate and unrelated room parameters are rejected', () => {
  for (const value of ['', null, 'not-a-room', '/PlayPoker?tableId=invalid', '/PlayPoker?tableId=' + tableId + '&tableId=' + tableId, '/Profile?tableId=' + tableId, '/PlayOmaha#tableId=' + tableId]) assert.equal(parsePokerInvite(value), null);
});
