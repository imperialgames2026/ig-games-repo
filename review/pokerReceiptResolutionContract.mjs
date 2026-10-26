// REVIEW CANDIDATE ONLY. No production imports, endpoint, SQL, or queue clearing.
// A schema check cannot prove that a server has implemented atomic finality.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const version=value=>Number.isSafeInteger(value)&&value>=0;
const unresolved=reason=>({state:'unresolved',canResume:false,reason});
const moves=new Set(['fold','check','call','allin','bet','raise']);

export function evaluatePokerReceiptResolution({pending,authenticatedActor,response,snapshot,minimumObservedVersion}={}){
 if(typeof authenticatedActor!=='string'||!UUID.test(authenticatedActor))return unresolved('authenticated_actor_required');
 const p=pending?.params;
 if(pending?.action!=='pokerAct'||typeof pending.requestId!=='string'||!UUID.test(pending.requestId)||
    !exact(p,['tableId','version','move','amount'])||typeof p.tableId!=='string'||!UUID.test(p.tableId)||
    !version(p.version)||!moves.has(p.move)||!Number.isSafeInteger(p.amount)||p.amount<0)
  return unresolved('invalid_original_request');
 // This draft has no reviewed manual disposition for already-rejected legacy,
 // ownership, or payload conflicts. A newly echoed payload cannot backfill it.
 if(pending.recovery)return unresolved('manual_reconciliation_contract_required');
 if(!record(response))return unresolved('missing_resolution');
 // Never infer a terminal outcome from absence, legacy amounts, or a snapshot.
 if(['legacy_unknown','not_found','pending','conflict'].includes(response.outcome))return unresolved(response.outcome);
 if(!exact(response,['protocol','actorId','tableId','actionId','request','outcome','resolutionId','finality','snapshotVersion','receipt']))
  return unresolved('invalid_resolution_shape');
 if(response.protocol!=='ig.poker.receipt-resolution.v1')return unresolved('unsupported_protocol');
 if(response.actorId!==authenticatedActor||response.tableId!==p.tableId||response.actionId!==pending.requestId)
  return unresolved('identity_or_receipt_mismatch');
 const request=response.request;
 if(!exact(request,['version','move','amount','systemTimeout'])||request.version!==p.version||request.move!==p.move||
    request.amount!==p.amount||request.systemTimeout!==false)return unresolved('original_inputs_unverified');
 if(response.resolutionId!==pending.requestId||
    !exact(response.finality,['durable','serialized','originalExecutionSealed'])||
    response.finality.durable!==true||response.finality.serialized!==true||response.finality.originalExecutionSealed!==true)
  return unresolved('terminal_finality_unverified');
 if(response.outcome==='committed'){
  const receipt=response.receipt;
  if(!exact(receipt,['accepted','tableId','version','action','timeout','chipsCommitted'])||
     receipt.accepted!==true||receipt.tableId!==p.tableId||!version(receipt.version)||
     receipt.version!==p.version+1||receipt.version>response.snapshotVersion||receipt.action!==p.move||
     receipt.timeout!==false||!Number.isSafeInteger(receipt.chipsCommitted)||receipt.chipsCommitted<0)
   return unresolved('committed_receipt_unverified');
 }else return unresolved('unknown_outcome'); // No negative/tombstone API is proposed.
 const committed={state:'committed',resolutionId:response.resolutionId,actionId:pending.requestId};
 // Historical/moved owners may own a receipt without permission to read current
 // table snapshots. Record the committed proof without authorizing new play.
 if(!version(minimumObservedVersion)||!version(response.snapshotVersion)||response.snapshotVersion<response.receipt.version)
  return unresolved('invalid_version_marker');
 if(!record(snapshot?.table)||snapshot.table.id!==p.tableId||!version(snapshot.table.version)||
    snapshot.table.version<response.snapshotVersion||!Array.isArray(snapshot.seats)||snapshot.table.version<minimumObservedVersion)
  return {...committed,canResume:false,reason:'snapshot_not_correlated_or_stale'};
 return {...committed,canResume:true};
}
