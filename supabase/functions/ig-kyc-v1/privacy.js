// Non-biometric authorization, queue and retention orchestration.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STATUSES=['pending','all','draft','submitted','escalated','needs_changes','approved','rejected','cancelled','expired'];
export function validateQueue(input){
 if(input.status!==undefined&&!STATUSES.includes(input.status))throw Error('Invalid queue status');
 if(input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>100))throw Error('Invalid queue size');
 if(input.cursor!==undefined){
  const c=input.cursor;
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join(',')!=='created_at,id'||!UUID.test(c.id)||typeof c.created_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(c.created_at)||!Number.isFinite(Date.parse(c.created_at)))throw Error('Invalid queue cursor');
 }
}
export async function issueUpload(rpc,storage,kind){
 const s=await rpc('upload');
 if(kind==='id_back'&&s.document_type==='passport')throw Object.assign(Error('Passport needs its photo page only'),{code:'22023'});
 const {data,error}=await storage.createSignedUploadUrl(`${s.user_id}/${s.id}/${kind}`,{upsert:false});
 if(error||!data)throw Error('Storage unavailable');
 // PR49 864c9d0: only release the token after reauthorization, extending the
 // deletion fence relative to completed issuance rather than request start.
 await rpc('upload');
 return {path:data.path,token:data.token};
}
export async function reviewQueue(rpc,db,input){
 validateQueue(input);
 // Existing service-only RPC rechecks current reviewer role/exclusion.
 await rpc('queue');
 const size=input.limit??25,status=input.status??'pending';
 let q=db.from('ig_kyc_submissions').select('id,user_id,status,revision,document_type,country,created_at,submitted_at,reviewed_at,expires_at,evidence_deleted_at');
 if(status==='pending')q=q.in('status',['submitted','escalated']);
 else if(status!=='all')q=q.eq('status',status);
 if(input.cursor){const c=input.cursor;q=q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);}
 const {data,error}=await q.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(size+1);
 if(error)throw Error('Queue unavailable');
 const rows=data.slice(0,size),last=rows.at(-1);
 return {rows,next_cursor:data.length>size?{created_at:last.created_at,id:last.id}:null};
}
export async function purgeExpired(rpc,db,bucket,id){
 const expired=await rpc('worker_expired');
 if(!expired.some(x=>x.id===id))throw Object.assign(Error('Evidence is not due for deletion'),{code:'40001'});
 // Durable reservation precedes network I/O; failures/crashes need no callback.
 const s=await rpc('worker_attempt');
 // Always remove predictable unfinalized keys, including late cancelled uploads.
 const {error}=await db.storage.from(bucket).remove(['id_front','id_back','selfie'].map(k=>`${s.user_id}/${s.id}/${k}`));
 if(error)throw Error('Deletion incomplete');
 return rpc('worker_purged',{attempt:s.attempt});
}

// The detail RPC is service-only and returns the evolving database row. Keep
// all reservation state inside that boundary, including future cleanup fields.
export function redactReviewerDetail(result){
 return Object.fromEntries(Object.entries(result).filter(([key])=>
  !key.startsWith('cleanup_')&&!['face_lease','face_lease_until'].includes(key)));
}
