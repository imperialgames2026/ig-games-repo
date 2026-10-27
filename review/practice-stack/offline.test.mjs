import test from 'node:test';import assert from 'node:assert/strict';
import {route,fixturePlan,functions,assertLocal} from './policy.mjs';
import {readFileSync} from 'node:fs';
import {makeGateway} from './gateway.mjs';
test('gateway import does not listen',()=>{const s=makeGateway();assert.equal(s.listening,false);});
test('fixed upstream and paths only',()=>{assert.deepEqual(route('/auth/v1/token?grant_type=password','POST'),{host:'auth',port:9999,path:'/token?grant_type=password'});for(const p of ['//evil/a','http://evil/a','/storage/v1/a','/functions/v1/ig-mines-practice','/functions/v1/ig-slot-practice-v1','/functions/v1/a/../poker-table-v1','/functions/v1/%2e%2e/a','/auth/v1/\\evil'])assert.equal(route(p,'POST'),null,p);assert.equal(route('/rest/v1/profiles','CONNECT'),null);});
test('only synthetic distinct identities, no generated credentials',()=>{const f=fixturePlan('a'.repeat(32));assert.equal(new Set(f.map(x=>x.email)).size,5);assert.ok(f.every(x=>x.email.endsWith('@example.invalid')&&!('password'in x)));assert.throws(()=>fixturePlan('../unsafe'));});
test('remote backend refused',()=>{assertLocal('http://127.0.0.1:54321');for(const s of ['https://example.supabase.co','http://localhost:54321','http://127.0.0.1:54322'])assert.throws(()=>assertLocal(s));});
test('dispatcher allowlist matches policy and has no parked functions',()=>{const s=readFileSync(new URL('./main.ts',import.meta.url),'utf8');for(const f of functions)assert.ok(s.includes(`'${f}'`));assert.ok(s.includes("IG_SYNTHETIC_STACK_APPROVED"));assert.ok(!/ig-kyc|ig-slot|ig-mines|ig-originals/.test(s));});
test('fixture and browser runtime entrypoints reject before network or browser work',async()=>{
 const {seedAuth}=await import('./fixtures.mjs');const {verifyLoginAndRecovery}=await import('./browser-journeys.mjs');
 const before=process.env.IG_SYNTHETIC_STACK_APPROVED;delete process.env.IG_SYNTHETIC_STACK_APPROVED;
 try{await assert.rejects(seedAuth({origin:'http://127.0.0.1:54321',run:'a'.repeat(32),fetchImpl:()=>{throw Error('NETWORK_TRIPWIRE');}}),/interlock/);await assert.rejects(verifyLoginAndRecovery({browser:{newContext:()=>{throw Error('BROWSER_TRIPWIRE');}},email:'test@example.invalid'}),/interlock/);}finally{if(before===undefined)delete process.env.IG_SYNTHETIC_STACK_APPROVED;else process.env.IG_SYNTHETIC_STACK_APPROVED=before;}
});
test('cleanup refuses foreign resources and continues owned cleanup',async()=>{
 const {Resources,runtimePlan}=await import('./lifecycle.mjs');const run='a'.repeat(32),r=new Resources(run),owned='b'.repeat(64),foreign='c'.repeat(64),removed=[];
 r.register('network',owned);r.register('container',foreign);
 const result=await r.cleanup(async args=>{if(args[0]==='inspect')return JSON.stringify([{Id:args[1],Labels:{'ig.synthetic.run':run},Config:{Labels:{'ig.synthetic.run':'another-run'}}}]);removed.push(args);return '';});
 assert.equal(result.failures.length,1);assert.deepEqual(removed,[['network','rm',owned]]);assert.equal(runtimePlan(run).ready,false);assert.throws(()=>r.register('container','unsafe-name'));});
test('eight-game slice explicit and all runtime entrypoints fail closed',async()=>{
 const {games,verifyEightGames}=await import('./game-journeys.mjs');const {verifyFreeRegistration}=await import('./tournament-journey.mjs');
 assert.equal(games.length,8);assert.equal(new Set(games.map(g=>g.route)).size,8);assert.ok(games.every(g=>functions.includes(g.slug)));
 const before=process.env.IG_SYNTHETIC_STACK_APPROVED;delete process.env.IG_SYNTHETIC_STACK_APPROVED;
 try{await assert.rejects(verifyEightGames({}),/interlock/);await assert.rejects(verifyFreeRegistration({}),/interlock/);}finally{if(before===undefined)delete process.env.IG_SYNTHETIC_STACK_APPROVED;else process.env.IG_SYNTHETIC_STACK_APPROVED=before;}
});
test('driver is plan only by CLI and rejects execution before Docker',async()=>{
 const {execute,validateRunConfig}=await import('./driver.mjs');const before=process.env.IG_SYNTHETIC_STACK_APPROVED;delete process.env.IG_SYNTHETIC_STACK_APPROVED;
 try{await assert.rejects(execute({}),/interlock/);assert.throws(()=>validateRunConfig({run:'a'.repeat(32),stage:'/tmp/other'}),/stage/);}finally{if(before===undefined)delete process.env.IG_SYNTHETIC_STACK_APPROVED;else process.env.IG_SYNTHETIC_STACK_APPROVED=before;}
});
test('oversized gateway body never opens an upstream request',async()=>{
 const {handler}=await import('./gateway.mjs');const {Readable}=await import('node:stream');const req=Readable.from([Buffer.alloc(65536),Buffer.from('x')]);Object.assign(req,{url:'/functions/v1/poker-table-v1',method:'POST',headers:{origin:'http://127.0.0.1:4173'}});let status=0,ended=false;
 await handler(()=>{throw Error('NETWORK_TRIPWIRE');})(req,{writeHead:s=>{status=s;},end:()=>{ended=true;}});assert.equal(status,413);assert.equal(ended,true);
});
test('browser and lifecycle identities never share aliases or accounts',()=>{const a=fixturePlan('a'.repeat(32),'browser'),b=fixturePlan('a'.repeat(32),'lifecycle');assert.equal(new Set([...a,...b].map(x=>x.email)).size,10);assert.throws(()=>fixturePlan('a'.repeat(32),'production'));});
test('driver rejects duplicate handler inventories despite count seven',async()=>{const {assertFunctionInventory}=await import('./driver.mjs');assertFunctionInventory(functions.map(slug=>({slug})));assert.throws(()=>assertFunctionInventory(functions.map(()=>({slug:functions[0]}))),/unique/);assert.throws(()=>assertFunctionInventory([...functions.slice(1),'ig-slot-practice-v1'].map(slug=>({slug}))),/unique/);});
test('failed click preserves original error and absorbs response waiter close',async()=>{const {clickAction}=await import('./game-journeys.mjs');let reject;const pending=new Promise((_,r)=>{reject=r;});const page={waitForResponse:()=>pending,getByRole:()=>({first:()=>({click:async()=>{reject(Error('response closed'));throw Error('selector click failed');}})})};await assert.rejects(clickAction(page,{slug:'poker-table-v1',route:'PlayPoker'},'Fold','act'),/selector click failed/);await new Promise(r=>setImmediate(r));});
