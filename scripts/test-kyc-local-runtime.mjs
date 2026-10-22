// Requires a separately started disposable core or full-platform fixture stack.
// Its ephemeral local connection metadata is never printed or committed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHmac,createHash,randomBytes,randomUUID} from 'node:crypto';
import http from 'node:http';
import {setTimeout} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {Image} from 'imagescript';
assert.match(process.argv[2]||'',/^\/tmp\/ig-kyc-(?:core|platform)-[^/]+\/runtime-info\.json$/);
const c=JSON.parse(readFileSync(process.argv[2],'utf8'));
const fullSchema=c.SCHEMA_MODE==='full-platform';
assert.match(c.DB_CONTAINER,fullSchema?/^supabase_db_ig-kyc-platform-[a-f0-9-]+$/:/^ig-kyc-core-[a-f0-9-]+-db$/);
const origin=c.API_URL;
assert.equal(origin,'http://127.0.0.1:54321');
const sql=input=>execFileSync('docker',['exec','-i',c.DB_CONTAINER,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const service=createClient(origin,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const image=new Image(240,240);image.fill(0x123456ff);const png=await image.encode();
async function account(role='player'){
 const email=`privacy-${randomUUID()}@example.invalid`,password=randomUUID()+'-Synthetic8!';
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null,'local account creation failed');
 const id=created.data.user.id;
 if(fullSchema){
  assert.equal(sql(`select count(*) from public.profiles where id='${id}';`),'1','real signup trigger creates profile');
  assert.equal(sql(`select role from public.user_roles where user_id='${id}';`),'player','real signup trigger creates player role');
  if(role!=='player')assert.equal((await service.from('user_roles').update({role}).eq('user_id',id)).error,null,'synthetic reviewer fixture');
 }else sql(`insert into public.profiles(id) values('${id}');insert into public.user_roles(user_id,role) values('${id}','${role}');`);
 const client=createClient(origin,c.ANON_KEY,{auth:{persistSession:false}});const signed=await client.auth.signInWithPassword({email,password});assert.equal(signed.error,null,'local login failed');
 return {id,client,token:signed.data.session.access_token};
}
const user=await account(),admin=await account('admin'),other=await account();
async function call(actor,action,payload={}){
 assert(!['worker_claim','worker_finish'].includes(action));
 const r=await fetch(origin+'/functions/v1/ig-kyc-v1',{method:'POST',headers:{apikey:c.ANON_KEY,authorization:'Bearer '+actor.token,'content-type':'application/json'},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(20000)});
 return {status:r.status,data:await r.json()};
}
const begin=async(actor=user)=>{const r=await call(actor,'begin',{full_name:'Synthetic Raster Fixture',birth_date:'1990-01-01',country:'US',document_type:'passport',consent:true,consent_version:'2026-10-22',face_consent:false});assert.equal(r.status,200,'begin');return r.data.result.id;};
async function upload(id,kind,bytes=png,actor=user){const r=await call(actor,'upload',{id,kind});assert.equal(r.status,200,'grant');const result=await actor.client.storage.from('ig-kyc-evidence').uploadToSignedUrl(r.data.path,r.data.token,bytes,{contentType:'image/png',upsert:false});assert.equal(result.error,null,'signed local upload');return r.data;}
assert.equal((await call({token:'synthetic.invalid.token'},'mine')).status,401,'forged auth rejected by actual Edge/Auth');
const id=await begin();await upload(id,'id_front');await upload(id,'selfie');
assert.equal((await call(user,'submit',{id})).status,200,'complete file submit');
assert.equal(sql(`select kyc_status from public.profiles where id='${user.id}';`),'pending_review');
assert.equal((await call(other,'detail',{id})).status,404);
assert.equal((await call(user,'queue',{status:'pending',limit:25})).status,403);
assert((await user.client.from('ig_kyc_submissions').select('id')).error,'direct table access denied');
assert((await user.client.storage.from('ig-kyc-evidence').download(`${user.id}/${id}/id_front`)).error,'direct private evidence access denied');
const detail=await call(admin,'detail',{id});assert.equal(detail.status,200);
assert.equal((await call(admin,'review',{id,revision:detail.data.result.revision,outcome:'needs_changes',reason:'Synthetic manual completeness check',customer_message:'Synthetic corrections requested',checks:{}})).status,200);
console.log('PASS real Edge/Auth/Storage/PostgREST: full synthetic PNG intake, ownership and manual needs-changes review; persisted pending profile');
sql(`insert into public.ig_kyc_submissions(user_id,full_name,birth_date,country,document_type,consent_version,face_consent,status,created_at)
 select '${user.id}','Synthetic Queue','1990-01-01','US','passport','2026-10-22',false,'rejected','2020-01-01T12:00:00Z' from generate_series(1,130);`);
const legacy=await call(admin,'queue');assert.equal(legacy.status,200);assert(Array.isArray(legacy.data.result));assert.equal(legacy.data.result.length,100);
let cursor,seen=[];do{const r=await call(admin,'queue',{status:'all',limit:25,...(cursor?{cursor}:{})});assert.equal(r.status,200);seen.push(...r.data.result.rows.map(x=>x.id));cursor=r.data.result.next_cursor;}while(cursor);
assert.equal(seen.length,131);assert.equal(new Set(seen).size,131);
const filtered=await call(admin,'queue',{status:'rejected',limit:25});assert.equal(filtered.status,200);assert.equal(filtered.data.result.rows.length,25);assert(filtered.data.result.rows.every(r=>r.status==='rejected'));
console.log('PASS real PostgREST: legacy array compatibility and complete 131-row tied-timestamp pagination');
// Header-only PNG must fail actual Edge decoding, not merely a helper mock.
const bad=await begin();const header=Buffer.alloc(64);header.set([137,80,78,71,13,10,26,10]);header.write('IHDR',12);header.writeUInt32BE(240,16);header.writeUInt32BE(240,20);
await upload(bad,'id_front',header);await upload(bad,'selfie');assert.equal((await call(user,'submit',{id:bad})).status,422);await call(user,'cancel',{id:bad});
console.log('PASS actual Edge rejects header-only file');
const cancelUser=await account(),cancelId=await begin(cancelUser);
await upload(cancelId,'id_front',png,cancelUser);await upload(cancelId,'selfie',png,cancelUser);
assert.equal((await call(cancelUser,'submit',{id:cancelId})).status,200);
assert.equal(sql(`select kyc_status from public.profiles where id='${cancelUser.id}';`),'pending_review');
assert.equal((await call(cancelUser,'cancel',{id:cancelId})).status,200);
assert.equal(sql(`select kyc_status from public.profiles where id='${cancelUser.id}';`),'not_started');
console.log('PASS persisted profile changes pending_review -> not_started after real submitted cancellation');

// A separate user avoids fixture queue rows consuming the daily intake limit.
const lateUser=other;const lateId=randomUUID();sql(`insert into public.ig_kyc_submissions(id,user_id,full_name,birth_date,country,document_type,consent_version,face_consent) values('${lateId}','${lateUser.id}','Synthetic Late Stream','1990-01-01','US','passport','2026-10-22',false);`);
const grant=await call(lateUser,'upload',{id:lateId,kind:'id_front'});assert.equal(grant.status,200);
// Compress only this synthetic token's expiry to three seconds. Same locally
// generated signing key and real Storage verifier; no production key is read.
const parts=grant.data.token.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));payload.exp=Math.floor(Date.now()/1000)+3;
parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');parts[2]=createHmac('sha256',c.JWT_SECRET).update(parts[0]+'.'+parts[1]).digest('base64url');const token=parts.join('.');
const target=new URL(`/storage/v1/object/upload/sign/ig-kyc-evidence/${grant.data.path}?token=${token}`,origin);
let responsePromise;
const req=http.request(target,{method:'PUT',headers:{apikey:c.ANON_KEY,'content-type':'image/png','content-length':png.length}},res=>{let chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>responsePromise.resolve({status:res.statusCode,body:Buffer.concat(chunks)}));});
const response=new Promise((resolve,reject)=>{responsePromise={resolve,reject};req.on('error',reject);});
req.write(png.subarray(0,32));await setTimeout(5000);
assert.equal((await call(lateUser,'cancel',{id:lateId})).status,200);
sql(`update public.ig_kyc_submissions set upload_valid_until=now()-interval '1 second' where id='${lateId}';`);
const workerToken=randomBytes(32).toString('hex'),hash=createHash('sha256').update(workerToken).digest('hex');
sql(`insert into public.ig_kyc_workers(token_hash,name,expires_at) values('${hash}','synthetic-retention-only',now()+interval '1 hour');`);
async function worker(action){assert(['worker_purged','worker_expired'].includes(action));const r=await fetch(origin+'/functions/v1/ig-kyc-v1',{method:'POST',headers:{apikey:c.ANON_KEY,authorization:'Bearer '+c.ANON_KEY,'x-kyc-worker-token':workerToken,'content-type':'application/json'},body:JSON.stringify({action,...(action==='worker_purged'?{id:lateId}:{})}),signal:AbortSignal.timeout(10000)});return {status:r.status,data:await r.json()};}
const purged=await worker('worker_purged');assert.equal(purged.status,200,'purge while upload is still streaming');
req.end(png.subarray(32));const finished=await response;
const lateObject=await service.storage.from('ig-kyc-evidence').download(grant.data.path);
const batch=await worker('worker_expired');assert.equal(batch.status,200);
console.log(JSON.stringify({late_stream_status:finished.status,reappeared_after_purge:!lateObject.error,still_queued:batch.data.result.some(x=>x.id===lateId),test_time_compression:'3-second token; completion after expiry and purge'}));
if(fullSchema&&finished.status!==200){
 // Normal Kong buffers the body: Storage sees the shortened token after expiry.
 // Require that specific rejection, not an arbitrary failing upload.
 assert.equal(finished.status,400);
 const rejected=JSON.parse(finished.body.toString('utf8'));
 assert.match(rejected.message||'',/expired/i,'gateway must reject the expired token');
 assert(lateObject.error,'expired buffered upload must leave no object');
 console.log('PASS normal Kong rejects the buffered expired upload without recreating evidence');
 // Exercise real post-purge deletion through the normal gateway as well. The
 // original grant is still valid; only the fixture DB fence was advanced above.
 // This is explicitly not a post-expiry streaming reproduction (the core stack
 // separately proves that path). No gateway buffering/security setting changes.
 const replay=await lateUser.client.storage.from('ig-kyc-evidence').uploadToSignedUrl(grant.data.path,grant.data.token,png,{contentType:'image/png',upsert:false});
 assert.equal(replay.error,null,'original synthetic grant completes after fixture purge');
 assert.equal((await service.storage.from('ig-kyc-evidence').download(grant.data.path)).error,null);
 console.log('PASS original valid grant recreates synthetic object after cancellation and advanced fixture purge');
}else{
 assert.equal(finished.status,200);assert.equal(!lateObject.error,true,'streaming reproduction must recreate the object');
}
const firstDeleted=sql(`select evidence_deleted_at from public.ig_kyc_submissions where id='${lateId}';`);
for(let cycle=0;cycle<2;cycle++){
 // Advance only the synthetic recheck schedule; never the system clock.
 sql(`update public.ig_kyc_submissions set evidence_recheck_at=now()-interval '1 second' where id='${lateId}';`);
 assert((await worker('worker_expired')).data.result.some(x=>x.id===lateId),'durable tombstone must reappear in due work');
 assert.equal((await worker('worker_purged')).status,200);
 assert((await service.storage.from('ig-kyc-evidence').download(grant.data.path)).error,'reconciliation must remove the late object');
 assert.equal(sql(`select evidence_deleted_at from public.ig_kyc_submissions where id='${lateId}';`),firstDeleted);
 assert.equal(sql(`select count(*) from public.ig_kyc_audit where submission_id='${lateId}' and action='evidence_deleted';`),'1');
}
console.log('PASS durable tombstone reconciliation removes the actual post-purge object; repeated sweeps preserve deletion timestamp and single audit event');
