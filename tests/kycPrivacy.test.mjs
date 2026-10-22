import test from 'node:test';
import assert from 'node:assert/strict';
import {Image} from 'imagescript';
import {validateImageFile} from '../supabase/functions/ig-kyc-v1/image-file.js';
import {issueUpload,reviewQueue,purgeExpired,validateQueue} from '../supabase/functions/ig-kyc-v1/privacy.js';
const decode=Image.decode.bind(Image);
const id='00000000-0000-4000-8000-000000000001';
const row={id,user_id:'synthetic',document_type:'passport'};
test('upload returns immutable grants only after current authorization succeeds',async()=>{
 const calls=[];
 const rpc=async()=>{calls.push('authorize');return row;};
 const storage={async createSignedUploadUrl(path,options){calls.push('issue');assert.equal(options.upsert,false);return {data:{path,token:'synthetic'}};}};
 assert.equal((await issueUpload(rpc,storage,'id_front')).path,`synthetic/${id}/id_front`);
 assert.deepEqual(calls,['authorize','issue','authorize']);
});
test('cancellation or exclusion while issuing a token never releases it',async()=>{
 for(const reason of ['cancelled','excluded','expired']){
  let allowed=true;
  const rpc=async()=>{if(!allowed)throw Error(reason);return row;};
  const storage={async createSignedUploadUrl(){allowed=false;return {data:{token:'must-not-escape'}};}};
  await assert.rejects(issueUpload(rpc,storage,'selfie'),new RegExp(reason));
 }
 let issued=false;
 await assert.rejects(issueUpload(async()=>{throw Error('denied');},{createSignedUploadUrl(){issued=true;}},'selfie'));
 assert.equal(issued,false);
});
test('queue validates bounded filters and injection-free composite cursors',()=>{
 validateQueue({status:'pending',limit:25,cursor:{created_at:'2026-10-22T12:00:00.123456+00:00',id}});
 for(const input of [{limit:0},{limit:101},{limit:'25'},{status:'unknown'},{cursor:{created_at:'now(),id.gt.0',id}},{cursor:{created_at:'2026-10-22T12:00:00Z',id:'bad'}},{cursor:{created_at:'2026-10-22T12:00:00Z',id,extra:1}}])assert.throws(()=>validateQueue(input));
});
test('queue authorizes before selecting minimal fields and returns a stable next cursor',async()=>{
 const calls=[],rows=Array.from({length:3},(_,n)=>({id:`${id.slice(0,-1)}${3-n}`,created_at:'2026-10-22T12:00:00Z'}));
 const q={};for(const method of ['select','in','eq','or','order','limit'])q[method]=(...args)=>{calls.push([method,...args]);return q;};q.then=resolve=>resolve({data:rows});
 const db={from(){calls.push(['from']);return q;}};
 const result=await reviewQueue(async()=>calls.push(['authorize']),db,{limit:2});
 assert.equal(result.rows.length,2);assert.deepEqual(result.next_cursor,rows[1]);
 assert.equal(calls[0][0],'authorize');assert.deepEqual(calls.find(x=>x[0]==='in'),['in','status',['submitted','escalated']]);
 assert(!/full_name|birth_date|evidence,|face_result/.test(calls.find(x=>x[0]==='select')[1]));
 calls.length=0;
 await reviewQueue(async()=>{},db,{status:'approved',cursor:result.next_cursor,limit:2});
 assert(calls.some(x=>x[0]==='eq'&&x[2]==='approved'));
 assert(calls.some(x=>x[0]==='or'&&x[1].includes(`id.lt.${rows[1].id}`)));
 calls.length=0;await assert.rejects(reviewQueue(async()=>{throw Error('denied');},db,{}));assert.equal(calls.length,0);
});
test('late cancelled upload is removed after fence; failed removal retries; repeat is denied',async()=>{
 let due=false,deleted=false,fail=true;const objects=new Set();
 const rpc=async action=>{if(action==='worker_expired')return due&&!deleted?[row]:[];if(action==='worker_purged'){assert.equal(objects.size,0);deleted=true;return {deleted:true};}throw Error('unexpected');};
 const db={from(){return {select(){return this;},eq(){return this;},async single(){return {data:row};}};},storage:{from(){return {async remove(paths){if(fail)return {error:Error('retry')};for(const p of paths)objects.delete(p);return {};}};}}};
 await assert.rejects(purgeExpired(rpc,db,'synthetic',id));
 objects.add(`synthetic/${id}/id_back`); // Unfinalized late upload, absent from evidence metadata.
 due=true;await assert.rejects(purgeExpired(rpc,db,'synthetic',id));assert.equal(deleted,false);
 fail=false;assert.deepEqual(await purgeExpired(rpc,db,'synthetic',id),{deleted:true});
 await assert.rejects(purgeExpired(rpc,db,'synthetic',id));assert.equal(objects.size,0);
});
test('full non-person PNG JPEG and WebP payloads decode; truncated files fail',async()=>{
 const image=new Image(128,128);image.fill(0x306090ff);
 for(const [mime,bytes] of [['image/png',await image.encode()],['image/jpeg',await image.encodeJPEG()],['image/webp',await image.encodeWebP()]]){
  assert.equal((await validateImageFile(bytes,decode)).mime,mime);
  for(const end of [30,Math.floor(bytes.length/2),bytes.length-1])await assert.rejects(validateImageFile(bytes.slice(0,end),decode));
  const appended=new Uint8Array(bytes.length+1);appended.set(bytes);await assert.rejects(validateImageFile(appended,decode));
 }
});
test('header-only, bad CRC, animation and decoded dimension mismatch fail closed',async()=>{
 const header=Buffer.alloc(64);header.set([137,80,78,71,13,10,26,10]);header.write('IHDR',12);header.writeUInt32BE(128,16);header.writeUInt32BE(128,20);
 await assert.rejects(validateImageFile(header,decode));
 const image=new Image(128,128);image.fill(0x101010ff);const bytes=await image.encode();
 const corrupt=bytes.slice();corrupt[29]^=1;await assert.rejects(validateImageFile(corrupt,decode));
 await assert.rejects(validateImageFile(bytes,async()=>({width:129,height:128,bitmap:new Uint8Array(128*128*4)})));
 const webp=await image.encodeWebP();const animated=webp.slice();
 // Replace the bitstream chunk name with an animation chunk.
 animated.set(new TextEncoder().encode('ANMF'),12);await assert.rejects(validateImageFile(animated,decode));
});
test('keyset traversal reaches more than 100 submissions without repeating tied timestamps',async()=>{
 const all=Array.from({length:153},(_,n)=>({id:`00000000-0000-4000-8000-${String(153-n).padStart(12,'0')}`,created_at:'2026-10-22T12:00:00Z',status:'submitted'}));
 const db={from(){let before=null,limit=0;return {select(){return this;},in(){return this;},order(){return this;},or(value){before=value.match(/id\.lt\.([^)]*)/)[1];return this;},limit(value){limit=value;return this;},then(resolve){resolve({data:all.filter(r=>!before||r.id<before).slice(0,limit)});}};}};
 let cursor,seen=[];
 do{const result=await reviewQueue(async()=>{},db,{limit:25,...(cursor?{cursor}:{})});seen.push(...result.rows.map(r=>r.id));cursor=result.next_cursor;}while(cursor);
 assert.equal(seen.length,153);assert.equal(new Set(seen).size,153);assert.deepEqual(seen,all.map(r=>r.id));
});
