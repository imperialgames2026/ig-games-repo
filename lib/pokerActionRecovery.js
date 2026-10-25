// Current snapshots/replays do not correlate a receipt UUID with its actor and
// original requested amount. A refreshed table alone never resolves a receipt.
export function pokerReconciliationReason(message=''){
 if(message.includes('LEGACY_RECEIPT_REFRESH_REQUIRED'))return 'legacy_receipt';
 if(message.includes('RECEIPT_ACTOR_MISMATCH'))return 'actor_mismatch';
 if(message.includes('RECEIPT_PAYLOAD_MISMATCH'))return 'payload_mismatch';
 return null;
}
// Consistency check for the response to the original exact request plus its
// subsequent snapshot. This does not repair the existing SQL actor/payload
// binding gap, and cannot resolve any receipt already marked for reconciliation.
export function canConfirmPokerAction(pending,ack,snapshot){
 if(!pending||pending.recovery)return false;
 const p=pending.params;
 return ack?.accepted===true&&ack.tableId===p.tableId&&ack.version===p.version+1&&ack.action===p.move&&ack.timeout===false&&Number.isSafeInteger(ack.chipsCommitted)&&ack.chipsCommitted>=0&&snapshot?.table?.id===p.tableId&&Number.isSafeInteger(snapshot.table.version)&&snapshot.table.version>=ack.version&&Array.isArray(snapshot.seats);
}
export function pokerRecoveryView(pending,snapshot){
 if(!pending)return null;
 const current=snapshot?.table?.id===pending.params.tableId&&Number.isSafeInteger(snapshot.table.version)&&snapshot.table.version>pending.params.version&&Array.isArray(snapshot.seats);
 const reasons={legacy_receipt:'The server found an older receipt but cannot verify its original inputs.',actor_mismatch:'The server rejected the receipt ownership.',payload_mismatch:'The server rejected the receipt inputs.'};
 return {
  retryAllowed:!pending.recovery,
  title:pending.recovery?'Poker action needs reconciliation':'Poker action is not yet confirmed',
  message:pending.recovery?(reasons[pending.recovery]+' New actions at this table stay paused. '+(current?'The table view is updated, but it cannot establish this request’s outcome.':'Refresh the table view to review its current state.')):'Retry the original request or refresh the table. A refresh alone does not confirm this action.',
  reference:pending.requestId,
 };
}
