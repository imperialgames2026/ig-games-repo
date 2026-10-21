import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateVipLevels,vipProgress,shouldCelebrateVip,createVipCatalog} from '../lib/vipCatalog.js';
const seed=JSON.parse(readFileSync(new URL('../config/vip-levels.seed.json',import.meta.url),'utf8'));
test('all 34 authoritative VIP thresholds and their boundaries calculate correctly',()=>{
 const levels=validateVipLevels(seed);
 assert.equal(levels[0].name,'Beginner');assert.equal(levels.at(-1).xp_required,10000000000);
 for(let i=0;i<levels.length;i++){
  const row=levels[i];const at=vipProgress(row.xp_required,levels);assert.equal(at.current.level,row.level);
  assert.equal(at.percent,i===33?100:0);
  if(i){const below=vipProgress(row.xp_required-1,levels);assert.equal(below.current.level,i);assert.equal(below.remaining,1);assert.ok(below.percent<100);}
 }
 assert.equal(vipProgress(2500,levels).percent,75);
 assert.equal(vipProgress(10000000001,levels).next,null);
 for(const xp of [-1,NaN,Infinity,1.5,'1000',undefined,Number.MAX_SAFE_INTEGER+1])assert.equal(vipProgress(xp,levels),null);
 assert.equal(vipProgress(0,[]),null);
});
test('VIP catalog rejects malformed, unordered, fractional, unsafe and extra-field thresholds',()=>{
 for(const change of [x=>x.pop(),x=>x[0].xp_required=1,x=>x[1].xp_required=0,x=>x[1].xp_required=1000.5,x=>x[2].xp_required=999,x=>x[1].level=8,x=>x[1].name=' ',x=>x[1].name='Bad\tname',x=>x[1].tier='__proto__',x=>x[1].bonus=500,x=>x[33].xp_required=Number.MAX_SAFE_INTEGER+1]){
  const draft=structuredClone(seed);change(draft);assert.throws(()=>validateVipLevels(draft));
 }
});
test('level-up celebrations require XP growth by the same account under the same schedule',()=>{
 const before={userId:'a',revision:1,xp:999,level:1},after={...before,xp:1000,level:2};
 assert.equal(shouldCelebrateVip(before,after),true);
 for(const row of [{...after,userId:'b'},{...after,revision:2},{...after,xp:999},{...after,level:1},null])assert.equal(shouldCelebrateVip(before,row),false);
 assert.equal(shouldCelebrateVip(null,after),false);
});
function client({role='superadmin',excluded=false,changed=false,retry=false}={}){
 const writes=[];const filters=[];
 const snapshot={id:1,levels:seed,revision:changed||retry?2:1,updated_at:'2026-10-21T00:00:00Z'};
 const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){
  let writing=false;const q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},update(v){writing=true;writes.push(v);return q},
   async maybeSingle(){if(table==='profiles')return {data:{id:'owner',is_excluded:excluded}};if(table==='user_roles')return {data:{role}};return {data:changed||retry?null:{...snapshot,revision:2}}},
   async single(){return {data:table==='wallets'?{user_id:'owner',experience_points:1000}:snapshot}}};return q;
 }};return {db,writes,filters};
}
test('catalog writes check canonical superadmin identity and use a revision predicate',async()=>{
 for(const options of [{role:'player'},{role:'tester'},{role:'admin'},{excluded:true}]){
  const c=client(options);await assert.rejects(createVipCatalog(c.db).save(seed,1),/Superadmin/);assert.equal(c.writes.length,0);
 }
 const c=client();const saved=await createVipCatalog(c.db).save(seed,1);assert.equal(saved.revision,2);
 assert.deepEqual(Object.keys(c.writes[0]),['levels']);assert.ok(c.filters.some(x=>x[1]==='revision'&&x[2]===1));
});
test('stale saves cannot overwrite a newer catalog; identical retries confirm their revision',async()=>{
 const c=client({changed:true}),different=structuredClone(seed);different[1].xp_required=1100;
 await assert.rejects(createVipCatalog(c.db).save(different,1),/schedule changed/);
 const retry=client({retry:true});assert.equal((await createVipCatalog(retry.db).save(seed,1)).revision,2);
});
