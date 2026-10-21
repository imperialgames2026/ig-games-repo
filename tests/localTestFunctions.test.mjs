import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareTestLabBackend} from '../scripts/prepare-test-lab-backend.mjs';
import {LAB_SUPABASE_URL} from '../config/test-lab.js';
import {LOCAL_GUARD_PATCHES, localizePracticeGuard, prepareLocalTestFunctions} from '../scripts/prepare-local-test-functions.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('generated local handlers require both the explicit flag and exact local URL, while preserving lab guards',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'ig-local-guards-'));
 try {
  const candidate=join(temp,'candidate'),output=join(temp,'functions');
  prepareTestLabBackend({output:candidate});
  const before=new Map(Object.keys(LOCAL_GUARD_PATCHES).map(name=>[name,readFileSync(join(candidate,'supabase/functions',name,'index.ts'))]));
  const report=prepareLocalTestFunctions({candidateDirectory:candidate,output});
  assert.equal(report.patches.length,7);
  for(const [name,original] of before){
   assert.equal(hash(readFileSync(join(candidate,'supabase/functions',name,'index.ts'))),hash(original),'Hosted candidate must remain unchanged');
   const source=readFileSync(join(output,name,'index.ts'),'utf8').replace(/^import .*\n/gm,'');
   async function status(url,flag){
    let handler;
    const env={SUPABASE_URL:url,IG_LOCAL_PRACTICE:flag,SUPABASE_ANON_KEY:'local-public',SUPABASE_SERVICE_ROLE_KEY:'local-service'};
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{
     Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},
     createClient:()=>{throw Error('Unauthenticated request must stop before a client is used');},
     Request,Response,Headers,console,URL,crypto,
    });
    return (await handler(new Request('http://127.0.0.1/local-test',{method:'POST',body:'{}'}))).status;
   }
   assert.equal(await status('http://kong:8000','true'),401,name+' still requires authentication');
   assert.equal(await status('http://kong:8000',undefined),503,name+' requires the local flag');
   assert.equal(await status('http://kong:8000','false'),503,name+' rejects false flag');
   assert.equal(await status('https://other.supabase.co','true'),503,name+' rejects another hosted project');
   assert.equal(await status('http://127.0.0.1:54321','true'),503,name+' rejects a different local URL');
   assert.equal(await status(LAB_SUPABASE_URL,undefined),401,name+' retains the configured hosted lab branch');
   const entry=report.files.find(file=>file.path===name+'/index.ts');
   assert.equal(entry.source_sha256,hash(original));assert.notEqual(entry.local_sha256,entry.source_sha256);
  }
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('local guard patches reject unexpected source changes',()=>{
 assert.throws(()=>localizePracticeGuard('ig-originals-practice','const unexpected=true;'),/Unexpected local guard source/);
 assert.throws(()=>localizePracticeGuard('ig-originals-practice',LOCAL_GUARD_PATCHES['ig-originals-practice']+';'+LOCAL_GUARD_PATCHES['ig-originals-practice']),/Unexpected local guard source/);
 assert.equal(localizePracticeGuard('poker-table-v1','original authenticated handler'),'original authenticated handler');
});
