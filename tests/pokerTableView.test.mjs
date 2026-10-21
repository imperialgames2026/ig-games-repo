import test from 'node:test';
import assert from 'node:assert/strict';
import { isPokerId, pokerTableView, pokerTurnSeconds } from '../lib/pokerTableView.js';

const snapshot = (status = 'playing') => ({
  table: { variant: 'holdem', status, ownerId: 'alice', currentBet: 100,
    minRaise: 60, turnIndex: 7, turnDeadlineAt: '2026-10-20T12:00:10Z' },
  serverNow: '2026-10-20T12:00:00Z',
  seats: [
    { user_id: 'alice', seat_no: 7, stack: 35, street_bet: 80, committed: 80, acted: false },
    { user_id: 'bob', seat_no: 0, stack: 0, street_bet: 100, committed: 100, all_in: true },
    { user_id: 'carol', seat_no: 3, stack: 300, street_bet: 100, committed: 100 },
  ],
});

test('short stacks show the actual all-in call and cannot offer an unaffordable full raise', () => {
  const value = snapshot();
  value.seats[0].stack = 10;
  const view = pokerTableView(value, 'alice');
  assert.equal(view.due, 20);
  assert.equal(view.callAmount, 10);
  assert.equal(view.minRaise, 160);
  assert.equal(view.maxRaise, 90);
  assert.equal(view.canRaise, false);
  assert.equal(view.canAllIn, true);
  assert.equal(view.pot, 280);
});

test('a short all-in does not reopen raising for a seat that has already acted', () => {
  const value = snapshot();
  value.seats[0].stack = 500;
  value.seats[0].acted = true;
  const view = pokerTableView(value, 'alice');
  assert.equal(view.canRaise, false);
  assert.equal(view.canAllIn, false);
  assert.equal(view.callAmount, 20);
});

test('the owner can deal another completed hand only with two funded seats', () => {
  const value = snapshot('complete');
  assert.equal(pokerTableView(value, 'alice').canDeal, true);
  assert.equal(pokerTableView(value, 'carol').canDeal, false);
  value.seats[2].stack = 0;
  assert.equal(pokerTableView(value, 'alice').canDeal, false);
  value.seats[2].stack = 100;
  assert.equal(pokerTableView(value, 'alice', 'omaha').canDeal, false);
});

test('folded/all-in players and a page for the wrong variant never receive turn controls', () => {
  const value = snapshot();
  assert.equal(pokerTableView(value, 'alice').myTurn, true);
  assert.equal(pokerTableView(value, 'alice', 'omaha').myTurn, false);
  value.seats[0].folded = true;
  assert.equal(pokerTableView(value, 'alice').myTurn, false);
  value.seats[0].folded = false;
  value.seats[0].all_in = true;
  assert.equal(pokerTableView(value, 'alice').myTurn, false);
});

test('countdown uses server time despite device clock skew, and stops at zero', () => {
  const value = snapshot();
  const receipt = Date.parse('2030-01-01T00:00:00Z');
  assert.equal(pokerTurnSeconds(value, receipt, receipt), 10);
  assert.equal(pokerTurnSeconds(value, receipt, receipt + 2501), 8);
  assert.equal(pokerTurnSeconds(value, receipt, receipt + 12000), 0);
  value.table.status = 'complete';
  assert.equal(pokerTurnSeconds(value, receipt, receipt), null);
  value.table.status = 'playing';
  value.table.turnDeadlineAt = null;
  assert.equal(pokerTurnSeconds(value, receipt, receipt), null);
});

test('invite IDs reject malformed links before calling the poker service', () => {
  assert.equal(isPokerId('986e1764-1bcb-49b1-9311-6d496c0cc558'), true);
  assert.equal(isPokerId('--------986e17641bcb49b193116d496c0cc558'), false);
  assert.equal(isPokerId('https://example.com/PlayPoker'), false);
});
