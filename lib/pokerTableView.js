// Presentation derived from authenticated snapshots. The server remains the
// authority for turns, deadlines, cards and chip movements.
export const isPokerId = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const chips = value => Math.max(0, Number(value) || 0);
export function pokerTableView(snapshot, userId, variant = 'holdem') {
  const table = snapshot?.table;
  const seats = snapshot?.seats || [];
  const mySeat = seats.find(seat => seat.user_id === userId);
  const wrongVariant = !!table && table.variant !== variant;
  const due = mySeat ? Math.max(0, chips(table?.currentBet) - chips(mySeat.street_bet)) : 0;
  const myTurn = !!mySeat && !wrongVariant && !mySeat.folded && !mySeat.all_in &&
    table?.status === 'playing' && table.turnIndex === mySeat.seat_no;
  const maxRaise = chips(mySeat?.street_bet) + chips(mySeat?.stack);
  const minRaise = chips(table?.currentBet) + Math.max(1, chips(table?.minRaise || table?.bigBlind));
  const fundedSeats = seats.filter(seat => chips(seat.stack) > 0).length;
  return {
    table, seats, mySeat, wrongVariant, myTurn, due,
    callAmount: Math.min(due, chips(mySeat?.stack)),
    turn: seats.find(seat => seat.seat_no === table?.turnIndex),
    isOwner: !!userId && table?.ownerId === userId,
    canDeal: !wrongVariant && table?.ownerId === userId &&
      ['waiting', 'complete'].includes(table?.status) && fundedSeats >= 2,
    fundedSeats, minRaise, maxRaise,
    canRaise: myTurn && !mySeat.acted && maxRaise >= minRaise,
    canAllIn: myTurn && (!mySeat.acted || maxRaise <= chips(table?.currentBet)),
    pot: seats.reduce((sum, seat) => sum + chips(seat.committed), 0),
  };
}

// Use the server's clock plus elapsed time since receipt, avoiding an incorrect
// countdown when a tester's device clock is ahead of or behind the server.
export function pokerTurnSeconds(snapshot, receivedAt, now = Date.now()) {
  if (snapshot?.table?.status !== 'playing') return null;
  const deadline = Date.parse(snapshot.table.turnDeadlineAt);
  const serverNow = Date.parse(snapshot.serverNow);
  if (!Number.isFinite(deadline) || !Number.isFinite(serverNow) || !Number.isFinite(receivedAt)) return null;
  return Math.max(0, Math.ceil((deadline - serverNow - Math.max(0, now - receivedAt)) / 1000));
}

const messages = {
  JOIN_CLOSED: 'This hand has started. Ask the host for a new waiting table.',
  TABLE_FULL: 'This table is full. Ask the host to create another table.',
  INACTIVE_OR_STALE: 'The table has moved on. Refresh it before choosing another action.',
  TURN_DEADLINE_EXPIRED: 'Your turn expired. The server will check or fold automatically.',
  NOT_YOUR_TURN: 'The action belongs to another seat. Refresh the table.',
  NOT_REOPENED: 'A short all-in did not reopen raising. You can call or fold.',
  INVALID_RAISE: 'Choose a whole-chip raise within the displayed limits.',
  TIMEBANK_NOT_AVAILABLE: 'This turn cannot be extended. Refresh the table.',
  INVALID_PLAYER_COUNT: 'At least two players with chips are needed for the next hand.',
};
export function pokerErrorMessage(error) {
  const text = error?.message || 'Poker server unavailable. Refresh the table before retrying.';
  return messages[text] || text;
}
