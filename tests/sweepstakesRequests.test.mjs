import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEntryRequest,normalizePrizeRequest,createSweepstakesRequests} from '../lib/sweepstakesRequests.js';
test('request input validates entry bounds and strips authorization fields',()=>{
 assert.deepEqual(normalizeEntryRequest({entry_count:'3',status:'eligible',user_id:'other'}),{entry_count:3});
 for(const v of [0,-1,11,1.5,NaN,Infinity,''])assert.throws(()=>normalizeEntryRequest({entry_count:v}));
});
test('prize amounts retain exact decimal precision and delivery inputs are constrained',()=>{
 assert.deepEqual(normalizePrizeRequest({amount:'9999999999999999.99',prize_category:'cash_equivalent',network:'ignored',wallet_address:'ignored',status:'fulfilled'}),{amount:'9999999999999999.99',prize_category:'cash_equivalent',network:'',wallet_address:''});
 assert.equal(normalizePrizeRequest({amount:'1.2',prize_category:'cash_equivalent'}).amount,'1.20');
 for(const amount of ['0','0.00','1e2','-1','NaN','Infinity','0.001','10000000000000000','01.00'])assert.throws(()=>normalizePrizeRequest({amount,prize_category:'cash_equivalent'}));
 for(const input of [{amount:'1',prize_category:'unknown'},{amount:'1',prize_category:'crypto',network:'SOL',wallet_address:'with spaces in it'},{amount:'1',prize_category:'crypto',network:'',wallet_address:'someaddress12345'}])assert.throws(()=>normalizePrizeRequest(input));
});
function fakeClient({role='player',excluded=false,kyc='approved',rows=[]}={}){
 const calls=[];let inserted=0;
 const user={id:'actor',email:'actor@example.invalid'};
 const client={auth:{getUser:async()=>({data:{user}})},from(table){
  const q={select(){return q;},order(){return q;},limit(){return q;},eq(k,v){(q.filters??={})[k]=v;return q;},insert(payload){q.payload=payload;calls.push(payload);return q;},async single(){inserted++;const row={...q.payload,user_id:user.id,status:'submitted'};rows.push(row);return {data:row};},async maybeSingle(){
   if(table==='profiles')return {data:{id:user.id,is_excluded:excluded,kyc_status:kyc}};
   if(table==='user_roles')return {data:{role}};
   return {data:rows.find(r=>Object.entries(q.filters??{}).every(([k,v])=>r[k]===v))??null};
  }};return q;
 }};return {client,calls,get inserted(){return inserted;}};
}
test('unchanged retries read original request, changed payload conflicts, and actor fields are stripped',async()=>{
 const f=fakeClient(),r=createSweepstakesRequests(f.client),id='12345678-1234-1234-1234-123456789012';
 const input={amount:'1.2',prize_category:'cash_equivalent',user_id:'forged',status:'fulfilled'};
 const first=await r.submit('claim',input,id);assert.equal(first.user_id,'actor');
 assert.deepEqual(await r.submit('claim',input,id),first);assert.equal(f.inserted,1);
 assert.deepEqual(f.calls[0],{id,amount:'1.20',prize_category:'cash_equivalent',network:'',wallet_address:''});
 await assert.rejects(r.submit('claim',{...input,amount:'2'},id),/different details/);
});
test('tester, excluded and unapproved KYC accounts cannot submit or bypass admin audit checks',async()=>{
 const id='12345678-1234-1234-1234-123456789012';
 for(const config of [{role:'tester'},{excluded:true},{kyc:'pending'}]){
  const f=fakeClient(config),r=createSweepstakesRequests(f.client);
  await assert.rejects(r.submit('claim',{amount:'1',prize_category:'cash_equivalent'},id));assert.equal(f.inserted,0);
 }
 await assert.rejects(createSweepstakesRequests(fakeClient().client).list('claim',{admin:true}),/Admin access/);
});
