import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelPublicationIssues,availableVipSpins,validateWheelReceipt,createVipWheelDraw,readPendingWheel,pendingWheelKey} from '../lib/vipWheelDraw.js';
const segments=[{slot:1,reward:'Repeat prize',amount:'1.12345678',unit:'IGT',weight:1,notes:''},{slot:2,reward:'Reserved',amount:'1',unit:'BTC',weight:0,notes:''}];
const receipt=level=>({id:'receipt-'+level,user_id:'owner',level,stage:1,release_revision:2,config_revision:3,reward:segments[0],ticket:0,total_weight:1,transaction_id:'transaction-'+level,balance_after:level===1?'1.12345678':'2.24691356',created_at:'2026-10-21T00:00:00Z'});
test('publication requires explicit supported wallet units, positive amounts and active weight',()=>{
 assert.deepEqual(wheelPublicationIssues(segments),[]);
 for(const unit of ['ID','BTC','spins','multiplier'])assert.match(wheelPublicationIssues([{...segments[0],unit},segments[1]])[0],/choose IGN, IGD or IGT/);
 for(const unit of ['IGN','IGD','IGT'])assert.deepEqual(wheelPublicationIssues([{...segments[0],unit},segments[1]]),[]);
 assert.match(wheelPublicationIssues([{...segments[0],amount:'0'},segments[1]])[0],/greater than 0/);
 assert.match(wheelPublicationIssues(segments.map(r=>({...r,weight:0})))[0],/at least one/);
});
test('separate spins can collect an identical prize; availability tracks spin identity, never prize identity',()=>{
 const grants=[1,2,3].map(level=>({level,stage:1}));
 assert.deepEqual(availableVipSpins(grants,[receipt(1),receipt(2)]),[{level:3,stage:1}]);
 assert.throws(()=>availableVipSpins(grants,[receipt(1),receipt(1)]),/reconciled/);
 assert.throws(()=>availableVipSpins(grants,[{...receipt(1),level:12,stage:2}]),/reconciled/);
});
test('receipts preserve decimal strings and reject another owner or unverified result',()=>{
 assert.equal(validateWheelReceipt(receipt(1),'owner').reward.amount,'1.12345678');
 for(const changed of [{user_id:'other'},{stage:2},{balance_after:1.1},{ticket:1},{reward:{...segments[0],unit:'ID'}},{reward:{...segments[0],amount:'1e3'}}])assert.throws(()=>validateWheelReceipt({...receipt(1),...changed},'owner'));
});
function fake(role='player',error=null){const calls=[];return {calls,client:{auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:table==='profiles'?{id:'owner',is_excluded:false}:table==='user_roles'?{role}:receipt(1)})};return q;},async rpc(name,args){calls.push({name,args});return error?{error}:{data:name==='spin_vip_wheel'?receipt(args.p_level):{stage:1,revision:2,config_revision:3,active:true,segments}};}}};}
test('draw sends only an earned-level identifier and reviewed release revision, with unchanged retry identity',async()=>{
 const c=fake(),service=createVipWheelDraw(c.client);
 const first=await service.spin('owner',1,2),retry=await service.spin('owner',1,2),second=await service.spin('owner',2,2);
 assert.deepEqual(first,retry);assert.notEqual(first.id,second.id);assert.deepEqual(first.reward,second.reward);
 assert.deepEqual(c.calls[0],{name:'spin_vip_wheel',args:{p_level:1,p_release_revision:2}});assert.deepEqual(c.calls[0],c.calls[1]);
 await assert.rejects(service.spin('other',1,2));await assert.rejects(createVipWheelDraw(fake('tester').client).spin('owner',1,2));
});
test('publication is canonical superadmin-only and keeps server rollback codes for safe retry handling',async()=>{
 for(const role of ['player','tester','admin'])await assert.rejects(createVipWheelDraw(fake(role).client).publish(1,3,1,true),/Superadmin/);
 const c=fake('superadmin');assert.equal((await createVipWheelDraw(c.client).publish(1,3,1,true)).revision,2);
 assert.deepEqual(c.calls[0].args,{p_stage:1,p_settings_revision:3,p_release_revision:1,p_active:true});
 await assert.rejects(createVipWheelDraw(fake('player',{message:'Paused',code:'22023'}).client).spin('owner',1,2),e=>e.code==='22023');
});
test('pending spin recovery keeps the exact original level and rejects corrupted persisted requests',()=>{
 const storage={getItem:key=>key===pendingWheelKey('owner')?JSON.stringify({level:2,revision:5}):null};
 assert.deepEqual(readPendingWheel(storage,'owner'),{level:2,revision:5});assert.equal(readPendingWheel(storage,'other'),null);
 for(const data of ['broken','null','{"level":0,"revision":2}','{"level":35,"revision":2}','{"level":2,"revision":0}'])assert.equal(readPendingWheel({getItem:()=>data},'owner'),null);
 assert.equal(readPendingWheel({getItem(){throw Error('Storage blocked');}},'owner'),null);
});
