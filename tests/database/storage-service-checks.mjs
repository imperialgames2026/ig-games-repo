import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyStorageServices({origin,users,serviceKey,sql}) {
 assert.equal(new URL(origin).hostname,'127.0.0.1');
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8V0AAAAASUVORK5CYII=','base64');
 const a=users[0],b=users[1];
 async function send(path,{token,method='GET',body,type,json,upsert=false}={}) {
  const response=await fetch(origin+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(type?{'content-type':type}:{}),...(json?{'content-type':'application/json'}:{}),...(upsert?{'x-upsert':'true'}:{})},...(json?{body:JSON.stringify(json)}:body?{body}:{}),signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(bytes.toString());}catch{data=null;}
  return {status:response.status,data,bytes};
 }
 const upload=(bucket,path,token,extra={})=>send(`/object/${bucket}/${path}`,{method:'POST',body:image,type:'image/png',token,...extra});
 const denied=(result,label)=>assert.ok([401,403].includes(Number(result.data?.statusCode || result.status)),`${label}: ${JSON.stringify(result.data)}`);
 const key=`${a.id}/${randomUUID()}.png`;
 assert.equal((await upload('profile-avatars',key,a.token)).status,200);
 const publicRead=await send('/object/public/profile-avatars/'+key);
 assert.equal(publicRead.status,200);assert.deepEqual(publicRead.bytes,image);
 denied(await upload('profile-avatars',`${a.id}/${randomUUID()}.png`,b.token),'cross-owner upload');
 denied(await upload('profile-avatars',`${a.id}/not-a-uuid.png`,a.token),'invalid object path');
 denied(await upload('profile-avatars',key,a.token,{upsert:true}),'overwrite without UPDATE policy');
 const anonymous=await upload('profile-avatars',`${a.id}/${randomUUID()}.png`,null);
 assert.equal(anonymous.status,400);assert.equal(anonymous.data.code,'InvalidRequest');
 assert.match(anonymous.data.message,/authorization/);
 const wrongType=await upload('profile-avatars',`${a.id}/${randomUUID()}.png`,a.token,{type:'text/html',body:Buffer.from('synthetic test')});
 assert.equal(Number(wrongType.data?.statusCode || wrongType.status),415);
 const tooLarge=await upload('profile-avatars',`${a.id}/${randomUUID()}.png`,a.token,{body:Buffer.alloc(5242881)});
 assert.equal(Number(tooLarge.data?.statusCode || tooLarge.status),413);
 const list=token=>send('/object/list/profile-avatars',{method:'POST',token,json:{prefix:a.id,limit:100,offset:0,sortBy:{column:'name',order:'asc'}}});
 assert.equal((await list(a.token)).data.length,1);assert.deepEqual((await list(b.token)).data,[]);
 const otherDelete=await send('/object/profile-avatars',{method:'DELETE',token:b.token,json:{prefixes:[key]}});
 assert.equal(otherDelete.status,200);assert.deepEqual(otherDelete.data,[]);
 assert.equal((await send('/object/public/profile-avatars/'+key)).status,200);
 sql(`update public.user_roles set role='tester' where user_id='${b.id}'; update public.profiles set is_excluded=true where id='${a.id}';`);
 denied(await upload('profile-avatars',`${b.id}/${randomUUID()}.png`,b.token),'tester upload');
 denied(await upload('profile-avatars',`${a.id}/${randomUUID()}.png`,a.token),'excluded owner upload');
 sql(`update public.user_roles set role='player' where user_id='${b.id}'; update public.profiles set is_excluded=false where id='${a.id}';`);
 const removed=await send('/object/profile-avatars',{method:'DELETE',token:a.token,json:{prefixes:[key]}});
 assert.equal(removed.status,200);assert.equal(removed.data.length,1);
 assert.equal(Number((await send('/object/public/profile-avatars/'+key)).data?.statusCode),404);
 console.log('PASS: real Storage API enforces owned avatar paths, immutable uploads, MIME/5 MB limits, owner-only listing/deletion, tester/exclusion denial; public avatar reads remain intentional.');
 const privateKey=`${a.id}/${randomUUID()}.png`;
 assert.equal((await upload('kyc-documents',privateKey,serviceKey)).status,200);
 assert.equal((await send('/object/authenticated/kyc-documents/'+privateKey,{token:serviceKey})).status,200);
 const publicPrivate=await send('/object/public/kyc-documents/'+privateKey);
 assert.ok([400,403,404].includes(Number(publicPrivate.data?.statusCode || publicPrivate.status)));
 const userPrivate=await send('/object/authenticated/kyc-documents/'+privateKey,{token:a.token});
 assert.ok([400,403,404].includes(Number(userPrivate.data?.statusCode || userPrivate.status)));
 denied(await upload('kyc-documents',`${a.id}/${randomUUID()}.png`,a.token),'client KYC upload');
 assert.equal((await send('/object/kyc-documents',{method:'DELETE',token:serviceKey,json:{prefixes:[privateKey]}})).status,200);
 console.log('PASS: synthetic private KYC object exists for service access but is inaccessible publicly/to the player; client writes are denied and the fixture is removed.');
}
