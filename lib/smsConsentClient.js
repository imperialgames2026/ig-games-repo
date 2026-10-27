// No SMS provider or Auth metadata is used here. Consent is not phone verification.
export function createSmsConsentClient(invoke, uuid=()=>crypto.randomUUID()) {
 let pending=null;
 return {
  async status(){const r=await invoke({action:'status'});if(r.error||!r.data||!Number.isSafeInteger(r.data.revision)||r.data.revision<0||r.data.deliveryEnabled!==false)throw Error('SMS preferences are unavailable. No delivery is enabled.');return r.data;},
  async save(payload){
   const encoded=JSON.stringify(payload);
   if(pending&&pending.encoded!==encoded&&payload.action!=='grant')pending=null;
   if(pending&&pending.encoded!==encoded)throw Error('The previous consent request is unresolved. Retry that request before changing it.');
   if(!pending){let expectedRevision;
    if(payload.action==='grant'){const state=await this.status();expectedRevision=state.revision;}
    pending={encoded,body:{...payload,...(payload.action==='grant'?{expectedRevision}:{}),requestId:uuid()}};
   }
   const r=await invoke(pending.body);
   if(r.error)throw Error('Consent was not confirmed. Retry the same request; SMS delivery remains disabled.');
   const d=r.data;
   if(!d||d.requestId!==pending.body.requestId||d.deliveryEnabled!==false||!Number.isSafeInteger(d.revision)||d.revision<0||!['granted','revoked'].includes(d.status)||!d.eventId||!d.recordedAt)throw Error('Consent response was not confirmed. Retry the same request.');
   pending=null;return d;
  },
  hasPending(){return pending!==null;},
 };
}

export function createActorBoundSmsInvoker(client, actorId) {
 return async body=>{
  const {data,error}=await client.auth.getSession();const session=data?.session;
  if(error||!actorId||session?.user?.id!==actorId||!session.access_token)throw Error('Account changed. Review SMS preferences again after signing in.');
  // Pin this request to the checked account token, not a later global SDK session.
  return client.functions.invoke('sms-consent',{body,headers:{Authorization:'Bearer '+session.access_token}});
 };
}
