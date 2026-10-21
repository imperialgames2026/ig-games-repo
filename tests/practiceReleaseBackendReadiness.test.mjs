import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PROJECT,QUERY,reader,runParity} from '../scripts/check-practice-release-backend.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'ig-full-parity-fixture-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 for(const p of ['scripts','supabase/deployed-migrations','supabase/functions/demo'])mkdirSync(join(root,p),{recursive:true});
 for(const p of ['deploy-reviewed-staging.mjs','plan-reviewed-functions.mjs'])cpSync(fileURLToPath(new URL('../scripts/'+p,import.meta.url)),join(root,'scripts',p));
 const sql='select 1;\n',source='Deno.serve(() => new Response("practice"));\n',file='20261021000000_demo.sql';
 const manifest={project_ref:PROJECT,migrations:[{file,sha256:sha(sql)}],functions:[{name:'demo',deployed_version:1,verify_jwt:true,files:['index.ts'],sha256:{'index.ts':sha(source)}}]};
 writeFileSync(join(root,'supabase/backend-manifest.json'),JSON.stringify(manifest));writeFileSync(join(root,'supabase/deployed-migrations',file),sql);writeFileSync(join(root,'supabase/functions/demo/index.ts'),source);
 const history=[{version:'20261021000000',name:'demo',statements:[sql]}],meta={slug:'demo',version:1,verify_jwt:true,status:'ACTIVE',entrypoint_path:'file:///src/index.ts',import_map:false,ezbr_sha256:'bundle'};
 const body=(files={'index.ts':source})=>{const f=new FormData();f.set('metadata',JSON.stringify({entrypoint_path:'file:///src/index.ts'}));for(const [name,value]of Object.entries(files))f.append('file',new File([value],'/src/'+name));return new Response(f);};
 let histories=0,lists=0,metas=0;
 const request=async path=>{if(path==='/database/query'){histories++;return structuredClone(history)}if(path==='/functions'){lists++;return [structuredClone(meta)]}if(path==='/functions/demo'){metas++;return structuredClone(meta)}if(path==='/functions/demo/body')return body();throw Error('unexpected');};
 const options={sourceRoot:root,sourceSha:'a'.repeat(40),reportPath:join(root,'report.json'),request};
 return{root,sql,source,history,meta,body,request,options,get histories(){return histories},get lists(){return lists},get metas(){return metas}};
}
test('compares all manifest files and stable metadata/history, without pending-only filtering',async t=>{
 const f=fixture(t),r=await runParity(f.options);assert.equal(r.status,'full_parity');assert.equal(r.functions.length,1);assert.equal(r.migrations.length,1);assert.equal(r.functions[0].status,'source_matches');assert.equal(r.functions[0].files[0].hosted_sha256,sha(f.source));assert.equal(f.histories,2);assert.equal(f.lists,2);assert.equal(f.metas,2);assert.equal(r.local_sources_stable,true);assert.ok(!JSON.stringify(r).includes(f.source));assert.ok(!JSON.stringify(r).includes(f.sql));
});
test('401 produces redacted blocked evidence with no claimed comparisons',async t=>{
 const f=fixture(t);const request=async()=>{throw Object.assign(Error('secret remote body must not appear'),{code:'management_http_error',http_status:401})};const r=await runParity({...f.options,request});assert.equal(r.status,'blocked');assert.equal(r.migrations.length,0);assert.equal(r.functions.length,0);assert.ok(r.issues.every(x=>x.http_status===401));assert.ok(!JSON.stringify(r).includes('secret remote body'));assert.equal(r.source.local_checksums,'pass');
});
test('missing, extra and duplicate function/migration identities block parity',async t=>{
 const f=fixture(t);const request=async p=>{if(p==='/database/query')return [...f.history,f.history[0],{version:'20261022000000',name:'extra',statements:['select 2;']}];if(p==='/functions')return [{...f.meta,slug:'other'},{...f.meta,slug:'other'}];return f.request(p)};const r=await runParity({...f.options,request});for(const code of ['duplicate_hosted_migration','extra_hosted_migration','duplicate_hosted_function','extra_hosted_function','missing_hosted_function'])assert.ok(r.issues.some(x=>x.code===code),code);
 const missing=await runParity({...f.options,reportPath:join(f.root,'missing.json'),request:p=>p==='/database/query'?Promise.resolve([]):f.request(p)});assert.ok(missing.issues.some(x=>x.code==='missing_hosted_migration'));
});
test('extra files and changed bytes fail complete source-set comparison',async t=>{
 const f=fixture(t);const request=p=>p==='/functions/demo/body'?Promise.resolve(f.body({'index.ts':'changed','extra.ts':'extra'})):f.request(p);const r=await runParity({...f.options,request});assert.equal(r.functions[0].status,'source_differs');assert.equal(r.functions[0].file_set_matches,false);assert.equal(r.functions[0].files.length,2);
});
test('multipart prototype-path poisoning cannot hide an extra deployed file',async t=>{
 const f=fixture(t);const files=Object.fromEntries([['index.ts',f.source],['__proto__','unexpected']]);const request=p=>p==='/functions/demo/body'?Promise.resolve(f.body(files)):f.request(p);const r=await runParity({...f.options,request});assert.ok(r.issues.some(x=>x.code==='unsafe_function_file_map'));assert.equal(r.functions[0].status,'unverified');
});
test('JWT, status and version differences block metadata parity',async t=>{
 const f=fixture(t);f.meta.verify_jwt=false;f.meta.status='INACTIVE';f.meta.version=2;const r=await runParity(f.options);assert.ok(r.issues.some(x=>x.code==='function_configuration_differs'));assert.ok(r.issues.some(x=>x.code==='function_version_differs'));
});
test('metadata changes during body download and final inventory drift are detected',async t=>{
 const f=fixture(t);let n=0,h=0,l=0;const request=async p=>{if(p==='/functions/demo')return {...f.meta,version:++n===1?1:2};if(p==='/database/query')return ++h===1?f.history:[...f.history,{version:'20261022000000',name:'new',statements:['select 2;']}];if(p==='/functions')return [{...f.meta,version:++l===1?1:2}];return f.request(p)};const r=await runParity({...f.options,request});for(const code of ['function_changed_during_download','hosted_history_drift_during_review','hosted_functions_drift_during_review'])assert.ok(r.issues.some(x=>x.code===code),code);
});
test('local source checksum corruption fails before any hosted read',async t=>{
 const f=fixture(t);writeFileSync(join(f.root,'supabase/functions/demo/index.ts'),'unreviewed');let reads=0;const r=await runParity({...f.options,request:()=>{reads++;throw Error()}});assert.equal(reads,0);assert.equal(r.issues[0].code,'local_source_checksum_mismatch');
});
test('management transport permits only fixed SELECT and function GET operations',async()=>{
 const calls=[];const request=reader({token:'fixture-only',fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json([])}});await request('/database/query');await request('/functions');await assert.rejects(request('/config/auth'),/operation_not_allowlisted/);const q=calls[0];assert.equal(q.options.redirect,'error');assert.equal(q.options.method,'POST');assert.deepEqual(JSON.parse(q.options.body),{query:QUERY,read_only:true});assert.ok(q.url.startsWith('https://api.supabase.com/v1/projects/'+PROJECT+'/'));assert.equal(calls[1].options.method,'GET');
});
test('empty manifests fail before any hosted reads',async t=>{
 const f=fixture(t);writeFileSync(join(f.root,'supabase/backend-manifest.json'),JSON.stringify({project_ref:PROJECT,migrations:[],functions:[]}));let reads=0;const r=await runParity({...f.options,request:()=>{reads++;throw Error()}});assert.equal(reads,0);assert.equal(r.issues[0].code,'wrong_or_invalid_local_manifest');
});
test('existing or invalid report outputs cause zero reads and preserve existing bytes',async t=>{
 const f=fixture(t);writeFileSync(f.options.reportPath,'prior evidence');let reads=0;const request=()=>{reads++;throw Error()};for(const reportPath of [f.options.reportPath,f.root,join(f.root,'missing','report.json'),join(f.root,'supabase/backend-manifest.json')])await assert.rejects(runParity({...f.options,reportPath,request}),/report_output_unavailable/);assert.equal(reads,0);assert.equal(readFileSync(f.options.reportPath,'utf8'),'prior evidence');
});
test('opaque remote error codes and messages are redacted',async t=>{
 const f=fixture(t);const r=await runParity({...f.options,request:async()=>{throw Object.assign(Error('remote-secret-message'),{code:'remote-secret-code'})}});assert.ok(r.issues.every(x=>x.code==='read_failed'));assert.ok(!JSON.stringify(r).includes('remote-secret'));
});
test('unknown or nonboolean import-map settings fail closed',async t=>{
 for(const setting of [true,'false',0,{}]){const f=fixture(t);f.meta.import_map=setting;const r=await runParity(f.options);assert.ok(r.issues.some(x=>x.code==='function_configuration_differs'));}
});
