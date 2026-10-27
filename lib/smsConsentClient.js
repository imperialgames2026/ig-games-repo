// No SMS provider or Auth metadata is used here. Consent is not phone verification.
export function createSmsConsentClient(invoke, uuid=()=>crypto.randomUUID()) {
 let pending=null;
 return {
  async status(){const r=await invoke({action:'status'});if(r.error)throw Error('SMS preferences are unavailable. No delivery is enabled.');return r.data;},
  async save(payload){
   const encoded=JSON.stringify(payload);
   if(pending&&pending.encoded!==encoded&&payload.action!=='grant')pending=null;
   if(pending&&pending.encoded!==encoded)throw Error('The previous consent request is unresolved. Retry that request before changing it.');
   pending??={encoded,body:{...payload,requestId:uuid()}};
   const r=await invoke(pending.body);
   if(r.error)throw Error('Consent was not confirmed. Retry the same request; SMS delivery remains disabled.');
   const d=r.data;
   if(!d||d.requestId!==pending.body.requestId||d.deliveryEnabled!==false||!['granted','revoked'].includes(d.status)||!d.eventId||!d.recordedAt)throw Error('Consent response was not confirmed. Retry the same request.');
   pending=null;return d;
  },
  hasPending(){return pending!==null;},
 };
}
