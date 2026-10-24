import { requireSupabase } from './supabaseClient';

/**
 * Server-authoritative PRACTICE poker transport.
 * Never accept balances, hole cards, winners, settlement amounts or user IDs
 * from the browser. All writes are checked by authenticated Edge Functions.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const moves = new Set(['fold', 'check', 'call', 'bet', 'raise', 'allin']);
const simple = value => typeof value === 'string' && UUID.test(value);
const version = value => Number.isSafeInteger(value) && value >= 0;
async function invokePoker(body) {
  const { data, error } = await requireSupabase().functions.invoke('poker-table-v1', { body });
  if (error || !data || data.error) throw new Error(data?.error || error?.message || 'Poker service unavailable');
  return data;
}
export const practicePoker = Object.freeze({
  create: () => invokePoker({ action: 'create' }),
  join: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'join', tableId });
  },
  snapshot: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'snapshot', tableId });
  },
  start: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'start', tableId });
  },
  act: ({ tableId, actionId, expectedVersion, move, amount = 0 }) => {
    if (!simple(tableId) || !simple(actionId) || !version(expectedVersion) || !moves.has(move) ||
        !Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid poker action');
    return invokePoker({ action: 'act', tableId, actionId, version: expectedVersion, move, amount });
  },
  advance: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'advance', tableId });
  },
  settle: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'settle', tableId });
  },
  sync: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'sync', tableId });
  },
  tick: tableId => {
    if (!simple(tableId)) throw new Error('Invalid table ID');
    return invokePoker({ action: 'tick', tableId });
  },
  history: (tableId, before = null) => {
    if (!simple(tableId) || (before !== null && (!Number.isSafeInteger(before) || before < 1))) throw new Error('Invalid history request');
    return invokePoker({ action: 'history', tableId, before });
  },
  replay: (tableId, handNo, from = 0) => {
    if (!simple(tableId) || !Number.isSafeInteger(handNo) || handNo < 1 || !version(from)) throw new Error('Invalid replay request');
    return invokePoker({ action: 'replay', tableId, handNo, from });
  },
});
