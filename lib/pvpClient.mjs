// One shared transport contract. Requests never carry caller actor/role claims.
export function createPvpClient(invoke,actorId,uuid=()=>crypto.randomUUID(),retention=null){
 let pending=null,knownRejected=false,retentionError=null;
 if(retention)try{pending=retention.read();}catch{retentionError='Stored move cannot be verified. Reconciliation is required before another move.';}
 const retain=next=>{if(retentionError)throw Error(retentionError);if(retention)retention.write(next);};
 function validate(data){const s=data?.snapshot;if(!s||s.protocol!=='ig.pvp.snapshot.v1'||s.viewerId!==actorId||!Number.isSafeInteger(s.revision)||s.revision<1||s.view?.id!==s.roomId||s.view?.version!==s.revision||data.financialExecutionEnabled!==false)throw Error('Private game response was not confirmed');return data;}
 return {
  async snapshot(roomId){const s=validate(await invoke({op:'snapshot',roomId})).snapshot;if(s.roomId!==roomId)throw Error('Wrong private room response');return s;},
  async mutate(payload){
   if(retentionError)throw Error(retentionError);
   const encoded=JSON.stringify(payload);if(pending&&pending.encoded!==encoded)throw Error('Retry the unresolved original move before choosing another');
   if(!pending){const next={encoded,body:{...payload,requestId:uuid()}};retain(next);pending=next;}
   let data;try{data=validate(await invoke(pending.body));}catch(e){knownRejected=['ROOM_VERSION_CONFLICT','WAITING_FOR_PLAYERS','GAME_ACTION_REJECTED','SEAT_UNAVAILABLE','INVALID_REQUEST_FIELDS','GAME_NOT_REVIEWED','REQUEST_TOO_LARGE','INVALID_ACTION','CALLER_AUTHORITY_FORBIDDEN','INVALID_NONMONETARY_BID','INVALID_INVITEE','INVALID_ROOM','REQUEST_ID_REQUIRED'].includes(e.code);throw e;}
   if(data.receipt?.protocol!=='ig.pvp.receipt.v1'||data.receipt?.requestId!==pending.body.requestId||data.receipt?.roomId!==data.snapshot.roomId||data.receipt.operation!==pending.body.op||!Number.isSafeInteger(data.receipt.version)||data.receipt.version<1||data.receipt.version>data.snapshot.revision||(pending.body.roomId&&pending.body.roomId!==data.snapshot.roomId))throw Error('Move receipt was not confirmed');retain(null);pending=null;knownRejected=false;return data;
  },
  async retry(){if(!pending)throw Error('No unresolved move');return this.mutate(JSON.parse(pending.encoded));},
  hasPending:()=>!!pending,
  pendingProblem:()=>retentionError,
  isKnownRejected:()=>knownRejected,
  discardKnownRejected(){if(!knownRejected)throw Error('Unknown move outcome must be retried');retain(null);pending=null;knownRejected=false;},
 };
}
export function createActorBoundPvpInvoker(client,actorId,{localUrl=null,fetcher=fetch}={}){
 return async body=>{
  const {data,error}=await client.auth.getSession(),session=data?.session;
  if(error||!actorId||session?.user?.id!==actorId||!session.access_token)throw Error('Account changed; reopen the room after signing in');
  const auth={Authorization:'Bearer '+session.access_token};
  if(localUrl){
   if(localUrl!=='/api/pvp-local-review')throw Error('Only the same-origin local review endpoint is allowed');
   const r=await fetcher(localUrl,{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify(body),credentials:'omit'});const data=await r.json();
   if(!r.ok)throw Object.assign(Error(data.error||'PVP_UNAVAILABLE'),{status:r.status,code:data.error});return data;
  }
  const result=await client.functions.invoke('pvp-games-review',{body,headers:auth});if(result.error)throw result.error;return result.data;
 };
}
