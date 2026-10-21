import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VIP_WHEEL_STAGES,stageForVipLevel,summarizeVipSpins,createVipLevelSpins} from '../lib/vipLevelSpins.js';
import {normalizeWheelAmount,validateWheelSegments,wheelOdds,createVipWheelSettings} from '../lib/vipWheelSettings.js';
const seed=JSON.parse(readFileSync(new URL('../config/vip-wheel-settings.seed.json',import.meta.url),'utf8'));
test('all 34 level spins remain in their earned stage, including every boundary',()=>{
 for(const [level,stage] of [[1,1],[11,1],[12,2],[24,2],[25,3],[34,3]])assert.equal(stageForVipLevel(level),stage);
 const all=Array.from({length:34},(_,i)=>({level:i+1,stage:stageForVipLevel(i+1)}));
 assert.deepEqual(summarizeVipSpins(all),{total:34,stages:{1:11,2:13,3:10}});
 assert.equal(VIP_WHEEL_STAGES.at(-1).maxLevel,34);
 for(const value of [0,35,1.5,'12',null])assert.throws(()=>stageForVipLevel(value));
 assert.throws(()=>summarizeVipSpins([all[0],all[0]]));assert.throws(()=>summarizeVipSpins([{level:12,stage:1}]));
});
test('wheel amounts retain exact decimal precision without binary-number conversion',()=>{
 assert.equal(normalizeWheelAmount('9999999999999999.12345678'),'9999999999999999.12345678');
 assert.equal(normalizeWheelAmount('1.23000000'),'1.23');assert.equal(normalizeWheelAmount('0.00000001'),'0.00000001');assert.equal(normalizeWheelAmount('0.00000000'),'0');
 for(const value of ['-1','1e3','01','1,000','.5','1.','1.123456789','10000000000000000'])assert.throws(()=>normalizeWheelAmount(value));
});
test('all wheel sections can be edited; invalid sections and negative or fractional weights are rejected',()=>{
 for(const stage of seed){assert.equal(validateWheelSegments(stage.segments).length,10);assert.equal(wheelOdds(stage.segments).at(-1),0);}
 const original=seed[0].segments;
 for(const change of [x=>x[0].slot=2,x=>x[0].reward='',x=>x[0].unit='',x=>x[0].amount='1e3',x=>x[0].amount=1,x=>x[0].weight=-1,x=>x[0].weight=0.5,x=>x[0].weight=10001,x=>x[0].extra=true,x=>x[0].notes='a'.repeat(241)]){
  const rows=structuredClone(original);change(rows);assert.throws(()=>validateWheelSegments(rows));
 }
 assert.throws(()=>validateWheelSegments(original.slice(0,1)));
 assert.deepEqual(wheelOdds([{weight:1},{weight:3},{weight:0}]),[25,75,0]);assert.deepEqual(wheelOdds([{weight:0},{weight:0}]),[0,0]);
});
function fake({role='superadmin',excluded=false,changed=false,retry=false,otherOwner=false}={}){
 const writes=[],filters=[];return {writes,filters,client:{auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
  let stage=1;const q={select(){return q},order(){return q},limit(){return q},eq(k,v){filters.push([table,k,v]);if(k==='stage')stage=v;return q},update(v){writes.push(v);return q},
   async maybeSingle(){if(table==='profiles')return {data:{id:'owner',is_excluded:excluded}};if(table==='user_roles')return {data:{role}};return {data:changed||retry?null:{...seed[stage-1],revision:2}}},
   async single(){return {data:{...seed[stage-1],revision:2}}},
   then(resolve){return Promise.resolve({data:table==='ig_vip_level_spins'?[{user_id:otherOwner?'other':'owner',level:1,stage:1}]:seed.map(row=>({...row,revision:1}))}).then(resolve)}};return q;
 }}};
}
test('saved spin reads are owner-scoped and reject stale identity and cross-account responses',async()=>{
 const c=fake({role:'player'});assert.equal((await createVipLevelSpins(c.client).list('owner')).total,1);assert.ok(c.filters.some(row=>row[1]==='user_id'&&row[2]==='owner'));
 await assert.rejects(createVipLevelSpins(c.client).list('other'),/Sign in/);
 await assert.rejects(createVipLevelSpins(fake({excluded:true}).client).list('owner'),/Sign in/);
 await assert.rejects(createVipLevelSpins(fake({otherOwner:true}).client).list('owner'),/verified/);
});
test('only canonical superadmins may save a wheel; draft writes use a revision predicate',async()=>{
 for(const options of [{role:'admin'},{role:'player'},{role:'tester'},{excluded:true}]){const c=fake(options);await assert.rejects(createVipWheelSettings(c.client).save(1,seed[0].segments,1),/Superadmin/);assert.equal(c.writes.length,0);}
 const c=fake();assert.equal((await createVipWheelSettings(c.client).save(1,seed[0].segments,1)).revision,2);assert.deepEqual(Object.keys(c.writes[0]),['segments']);assert.ok(c.filters.some(row=>row[1]==='revision'&&row[2]===1));
 assert.equal((await createVipWheelSettings(fake({role:'admin'}).client).list()).length,3);
 await assert.rejects(createVipWheelSettings(fake({role:'player'}).client).list(),/Admin/);
});
test('unchanged wheel save retries confirm success while stale different drafts are preserved',async()=>{
 const changed=structuredClone(seed[0].segments);changed[0].amount='2.5';
 await assert.rejects(createVipWheelSettings(fake({changed:true}).client).save(1,changed,1),/wheel changed/);
 assert.equal((await createVipWheelSettings(fake({retry:true}).client).save(1,seed[0].segments,1)).revision,2);
});
