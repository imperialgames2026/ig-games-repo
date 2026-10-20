import test from 'node:test';
import assert from 'node:assert/strict';
import {planFunctions,readFunctionMultipart} from '../scripts/plan-reviewed-functions.mjs';
const candidates=['first','second'].map(name=>({name,status:'pending_deployment',deployed_version:3,verify_jwt:true,files:['index.ts']}));
const remote=(name,version=3)=>({name,version,status:'ACTIVE',verify_jwt:true,import_map:false});
const source=(name)=>Buffer.from('reviewed '+name);
test('zero progress plans all functions without treating original versions as completed',async()=>{
 assert.deepEqual(await planFunctions(candidates,candidates.map(f=>remote(f.name)),source,()=>{throw Error('unexpected download');}),candidates);
});
test('partial success resumes only the remaining function after exact source comparison',async()=>{
 assert.deepEqual(await planFunctions(candidates,[remote('first',4),remote('second')],source,async name=>({'index.ts':source(name)})),[candidates[1]]);
});
test('fully matching resumed content plans no repeated deployments, including new functions',async()=>{
 const fresh={...candidates[0],deployed_version:null};
 assert.deepEqual(await planFunctions([fresh],[remote('first',1)],source,async name=>({'index.ts':source(name)})),[]);
 assert.deepEqual(await planFunctions(candidates,candidates.map(f=>remote(f.name,4)),source,async name=>({'index.ts':source(name)})),[]);
});
test('unexpected content, files, version jumps and configuration drift fail closed',async()=>{
 for(const [hosts,files] of [
  [[remote('first',4)],{'index.ts':Buffer.from('unreviewed')}],
  [[remote('first',4)],{'index.ts':source('first'),'extra.ts':Buffer.from('extra')}],
  [[remote('first',5)],{'index.ts':source('first')}],
  [[{...remote('first',4),verify_jwt:false}],{'index.ts':source('first')}],
  [[],{'index.ts':source('first')}],
 ]) await assert.rejects(planFunctions([candidates[0]],hosts,source,async()=>files));
});
test('multipart source comparison preserves bytes and rejects escaping paths',async()=>{
 const response=name=>{const f=new FormData();f.set('metadata',JSON.stringify({entrypoint_path:'file:///src/index.ts'}));f.append('file',new Blob(['reviewed first']),name);return new Response(f);};
 assert.equal((await readFunctionMultipart(response('/src/index.ts'),{}))['index.ts'].toString(),'reviewed first');
 await assert.rejects(readFunctionMultipart(response('../escape.ts'),{}));
 await assert.rejects(readFunctionMultipart(new Response('{}',{headers:{'content-type':'application/json'}}),{}));
});
