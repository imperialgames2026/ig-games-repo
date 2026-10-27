// Pure source/provider-contract tests. No fake lifecycle result is accepted.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {payoutCredit} from './settlement.mjs';
import {checkContainer,overlap,markers,createContainerSql} from './container-sql.mjs';
const run='a'.repeat(32),id='b'.repeat(64),image='sha256:'+'c'.repeat(64);
const metadata=()=>({Id:id,Image:image,Name:`/ig-practice-${run}-db`,State:{Running:true},Config:{Labels:{'ig.synthetic.run':run}},HostConfig:{PortBindings:{},Privileged:false,Binds:[],Tmpfs:{'/var/lib/postgresql/data':'rw'}},Mounts:[{Type:'tmpfs'}],NetworkSettings:{Networks:{[`ig-practice-${run}-private`]:{}}}});
test('exact private ephemeral resource required',()=>{checkContainer(metadata(),{run,id,image});for(const change of [x=>x.Id='d'.repeat(64),x=>x.Image='other',x=>x.Config.Labels={},x=>x.HostConfig.Privileged=true,x=>x.HostConfig.PortBindings={db:[]},x=>x.Mounts=[{Type:'volume'}],x=>x.NetworkSettings.Networks={bridge:{}}]){const x=metadata();change(x);assert.throws(()=>checkContainer(x,{run,id,image}));}});
test('server overlap rejects sequential transactions despite distinct PIDs',()=>{const a={pid:1,xid:'1',startUs:10,readyUs:30},b={pid:2,xid:'2',startUs:20,readyUs:40};overlap([a,b]);assert.throws(()=>overlap([a,{...b,startUs:31}]));assert.throws(()=>overlap([a,{...b,xid:'1'}]));assert.throws(()=>overlap([a,{...b,pid:1}]));});
test('markers bind server transaction and backend',()=>{const a='IG_START:'+JSON.stringify({pid:1,xid:'1',us:10}),b='IG_READY:'+JSON.stringify({pid:1,xid:'1',us:20});assert.equal(markers(a+'\n'+b).readyUs,20);assert.throws(()=>markers(a));assert.throws(()=>markers(a+'\n'+b.replace('"xid":"1"','"xid":"2"')));});
test('construction/import do not spawn; missing approval rejects before Docker',async()=>{let calls=0;const db=createContainerSql({run,id,image,approvedRun:null,spawnImpl:()=>{calls++;throw Error('forbidden');}});await assert.rejects(db.sql('select 1'));assert.equal(calls,0);});
test('lifecycle is unwired with explicit incomplete flags, strict phase and no seed overwrite',()=>{const s=readFileSync(new URL('./settlement.mjs',import.meta.url),'utf8');assert.match(s,/p\.phase,'lifecycle'/);assert.match(s,/fullAccountingAcceptance:false/);assert.match(s,/publicCancellationRefund:false/);assert.match(s,/operatorCorrectionFixture=false/);assert.doesNotMatch(s,/set\s+(?:crash_point|server_seed|seed_secret|paid_units)\s*=/i);assert.match(s,/baccarat\.state\.shooterId/);assert.match(s,/insufficient practice chips/);});

test('bookkeeping oracle rejects mismatched/unsafe recorded credits',()=>{payoutCredit(100,136,36);payoutCredit(100,100,0);assert.throws(()=>payoutCredit(100,136,35));assert.throws(()=>payoutCredit(100,99,-1));assert.throws(()=>payoutCredit(100,NaN,0));});

// Fake child events only: no Docker binary or other subprocess is invoked.
import {EventEmitter} from 'node:events';
function fakeChild(onWrite=()=>{}){
 const p=new EventEmitter();p.stdin=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.exitCode=null;p.killed=false;p.kills=0;p.destroys=0;
 p.stdin.end=input=>onWrite(p,input);p.stdin.destroy=()=>{p.destroys++;};
 p.kill=()=>{p.killed=true;p.kills++;return true;};return p;
}
async function withApproval(fn){const before=process.env.IG_SYNTHETIC_STACK_APPROVED;process.env.IG_SYNTHETIC_STACK_APPROVED='1';try{return await fn();}finally{if(before===undefined)delete process.env.IG_SYNTHETIC_STACK_APPROVED;else process.env.IG_SYNTHETIC_STACK_APPROVED=before;}}
test('fake early spawn failure rejects and late EPIPE/close stays handled',async()=>withApproval(async()=>{
 let p;const db=createContainerSql({run,id,image,approvedRun:run,spawnImpl:()=>p=fakeChild(c=>{queueMicrotask(()=>c.emit('error',Error('synthetic spawn failure')));})});
 await assert.rejects(db.sql('select 1'),/synthetic spawn failure/);assert.equal(p.kills,1);assert.equal(p.destroys,1);
 assert.doesNotThrow(()=>{p.stdin.emit('error',Object.assign(Error('late pipe'),{code:'EPIPE'}));p.emit('error',Error('late spawn'));p.emit('close',1);});assert.equal(p.kills,1);
}));
test('fake stdin EPIPE and synchronous write error reject exactly once',async()=>withApproval(async()=>{
 for(const syncThrow of [false,true]){
  let p;const db=createContainerSql({run,id,image,approvedRun:run,spawnImpl:()=>p=fakeChild(c=>{if(syncThrow)throw Error('synthetic write');c.stdin.emit('error',Object.assign(Error('synthetic EPIPE'),{code:'EPIPE'}));c.emit('close',1);})});
  await assert.rejects(db.sql('select 1'),/synthetic/);assert.equal(p.kills,1);assert.equal(p.destroys,1);
 }
}));
test('fake timeout stops only own child and late pipe events do not resettle',async t=>withApproval(async()=>{
 t.mock.timers.enable({apis:['setTimeout']});let p;
 const db=createContainerSql({run,id,image,approvedRun:run,spawnImpl:()=>p=fakeChild()});
 const rejected=assert.rejects(db.sql('select 1'),/bounded SQL provider timeout/);t.mock.timers.tick(25000);await rejected;
 assert.equal(p.kills,1);assert.equal(p.destroys,1);assert.doesNotThrow(()=>{p.stdin.emit('error',Error('late EPIPE'));p.emit('close',null);});assert.equal(p.kills,1);
 t.mock.timers.reset();
}));
test('fake successful inspect/query close clears timer and never kills child',async t=>withApproval(async()=>{
 t.mock.timers.enable({apis:['setTimeout']});const children=[];
 const db=createContainerSql({run,id,image,approvedRun:run,spawnImpl:(_cmd,args)=>{const p=fakeChild(c=>{c.stdout.emit('data',args[0]==='inspect'?JSON.stringify([metadata()]):'1\n');c.exitCode=0;c.emit('close',0);});children.push(p);return p;}});
 assert.equal(await db.sql('select 1'),'1');t.mock.timers.tick(25001);assert.equal(children.length,2);assert.ok(children.every(c=>c.kills===0&&c.destroys===0));t.mock.timers.reset();
}));
