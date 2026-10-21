import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,realpathSync,openSync,closeSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const PROJECT='qonqemhljgxlwpghkxhn';
export const QUERY='select version,name,statements from supabase_migrations.schema_migrations order by version';
const digest=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const hash=x=>digest(canonical(x));
const fields=['version','ezbr_sha256','verify_jwt','entrypoint_path','import_map','status'];
const metadata=x=>Object.fromEntries(fields.map(k=>[k,x[k]??null]));
const slug=x=>x.slug||x.name;
const validName=x=>typeof x==='string'&&/^[a-z0-9-]{1,80}$/.test(x);
const error=(code,status)=>Object.assign(new Error(code),{code,http_status:status});
const failureCodes=new Set(['read_failed','unsafe_local_path','escaping_local_path','invalid_source_sha','invalid_local_manifest','wrong_or_invalid_local_manifest','local_source_checksum_mismatch','invalid_local_migration','duplicate_local_migration','invalid_or_duplicate_local_function','management_token_unavailable','operation_not_allowlisted','management_network_unavailable','management_http_error','invalid_management_json','invalid_history_shape','invalid_history_version','function_changed_before_download','function_changed_during_download','unsafe_function_file_map']);
const safeFailure=e=>({code:failureCodes.has(e?.code)?e.code:'read_failed',...(Number.isInteger(e?.http_status)&&e.http_status>=100&&e.http_status<=599?{http_status:e.http_status}:{})});
function reserveReport(path){
 if(typeof path!=='string'||!path||path.includes('\0'))throw error('report_output_unavailable');
 try{return openSync(path,'wx',0o600)}catch{throw error('report_output_unavailable')}
}
const sortedList=rows=>rows.map(x=>({name:slug(x),...metadata(x)})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
function sourceFile(root,path){
 if(typeof path!=='string'||!path||isAbsolute(path)||path.includes('\\')||path.split('/').some(x=>!x||x==='.'||x==='..'))throw error('unsafe_local_path');
 const file=realpathSync(resolve(root,path)),rel=relative(root,file);
 if(rel.startsWith('..')||isAbsolute(rel))throw error('escaping_local_path');
 return readFileSync(file);
}
export async function localSources(sourceRoot,sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha))throw error('invalid_source_sha');
 const root=realpathSync(sourceRoot),bytes=sourceFile(root,'supabase/backend-manifest.json');
 let manifest;try{manifest=JSON.parse(bytes)}catch{throw error('invalid_local_manifest')}
 if(manifest.project_ref!==PROJECT||!Array.isArray(manifest.migrations)||!manifest.migrations.length||!Array.isArray(manifest.functions)||!manifest.functions.length)throw error('wrong_or_invalid_local_manifest');
 const inventory=[],migrations=[],functions=[],versions=new Set(),names=new Set();
 const load=(path,expected)=>{const content=sourceFile(root,path),sha=digest(content);if(!/^[a-f0-9]{64}$/.test(expected||'')||sha!==expected)throw error('local_source_checksum_mismatch');inventory.push({path,sha256:sha});return content;};
 for(const m of manifest.migrations){
  if(!/^\d{14}_[A-Za-z0-9_-]+\.sql$/.test(m.file||''))throw error('invalid_local_migration');
  const version=m.file.slice(0,14);if(versions.has(version))throw error('duplicate_local_migration');versions.add(version);
  migrations.push({...m,version,sql:load('supabase/deployed-migrations/'+m.file,m.sha256).toString('utf8')});
 }
 for(const f of manifest.functions){
  if(!validName(f.name)||names.has(f.name)||typeof f.verify_jwt!=='boolean'||!Array.isArray(f.files)||!f.files.length||new Set(f.files).size!==f.files.length)throw error('invalid_or_duplicate_local_function');names.add(f.name);
  const files={};for(const name of f.files)files[name]=load('supabase/functions/'+f.name+'/'+name,f.sha256?.[name]);functions.push({...f,sources:files});
 }
 for(const name of ['deploy-reviewed-staging.mjs','plan-reviewed-functions.mjs']){const path='scripts/'+name;inventory.push({path,sha256:digest(sourceFile(root,path))});}
 const {matchesRecordedSql}=await import(pathToFileURL(resolve(root,'scripts/deploy-reviewed-staging.mjs')));
 const {readFunctionMultipart}=await import(pathToFileURL(resolve(root,'scripts/plan-reviewed-functions.mjs')));
 const proof={source_sha:sourceSha,manifest_sha256:digest(bytes),source_inventory_sha256:hash(inventory),migrations:migrations.length,functions:functions.length,local_checksums:'pass'};
 return {root,proof,migrations,functions,matchesRecordedSql,readFunctionMultipart,inventory};
}
export function reader({token=process.env.SUPABASE_ACCESS_TOKEN,fetchImpl=fetch}={}){
 if(!token)throw error('management_token_unavailable');
 return async function request(path){
  if(!['/database/query','/functions'].includes(path)&&!/^\/functions\/[a-z0-9-]{1,80}(?:\/body)?$/.test(path))throw error('operation_not_allowlisted');
  const query=path==='/database/query',options={method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,Accept:path.endsWith('/body')?'multipart/form-data':'application/json'}};
  if(query){options.headers['Content-Type']='application/json';options.body=JSON.stringify({query:QUERY,read_only:true});}
  let response;try{response=await fetchImpl('https://api.supabase.com/v1/projects/'+PROJECT+path,options)}catch{throw error('management_network_unavailable')}
  if(!response.ok)throw error('management_http_error',response.status);
  if(path.endsWith('/body'))return response;
  try{return await response.json()}catch{throw error('invalid_management_json')}
 };
}
export function compareHistory(local,rows){
 if(!Array.isArray(rows))throw error('invalid_history_shape');
 const remote=new Map(),issues=[],migrations=[];
 for(const row of rows){if(!/^\d{14}$/.test(row.version||''))throw error('invalid_history_version');if(remote.has(row.version))issues.push({code:'duplicate_hosted_migration',version:row.version});else remote.set(row.version,row);}
 const expected=new Set(local.migrations.map(m=>m.version));
 for(const row of rows)if(!expected.has(row.version))issues.push({code:'extra_hosted_migration',version:row.version});
 for(const m of local.migrations){const row=remote.get(m.version),match=!!row&&local.matchesRecordedSql(m.sql,row.statements);
  migrations.push({file:m.file,version:m.version,source_sha256:m.sha256,hosted_statements_sha256:row?hash(row.statements):null,status:!row?'missing':match?'sql_matches':'sql_differs'});
  if(!match)issues.push({code:row?'hosted_sql_differs':'missing_hosted_migration',version:m.version});
 }
 return {migrations,issues,history_sha256:hash(rows)};
}
export async function runParity({sourceRoot,sourceSha,request,reportPath='/tmp/ig-release-backend-parity.json'}={}){
 // Reserve a new file before reading local or hosted data. Never clobber a source,
 // existing candidate, symlink target or previous evidence file.
 const reportFd=reserveReport(reportPath);
 try{
 const report={schema_version:1,project_ref:PROJECT,source_sha:/^[a-f0-9]{40}$/.test(sourceSha||'')?sourceSha:null,started_at:new Date().toISOString(),mode:'read_only',status:'unverified',issues:[],migrations:[],functions:[]};
 let local;
 try{local=await localSources(sourceRoot,sourceSha);report.source=local.proof}catch(e){report.issues.push({component:'local_sources',...safeFailure(e)})}
 if(local){
  let call;try{call=request||reader()}catch(e){report.issues.push({component:'management',...safeFailure(e)})}
  if(call){
   const initial=await Promise.allSettled([call('/database/query'),call('/functions')]);
   let history,list;
   if(initial[0].status==='fulfilled'){history=initial[0].value;try{const result=compareHistory(local,history);Object.assign(report,{migrations:result.migrations,initial_history_sha256:result.history_sha256});report.issues.push(...result.issues)}catch(e){report.issues.push({component:'history',...safeFailure(e)})}}
   else report.issues.push({component:'history',...safeFailure(initial[0].reason)});
   if(initial[1].status==='fulfilled'){
    list=initial[1].value;
    if(!Array.isArray(list)||list.some(f=>!validName(slug(f)))){report.issues.push({code:'invalid_function_list'});list=undefined;}
    else{
     report.initial_functions_sha256=hash(sortedList(list));const seen=new Set(),expected=new Set(local.functions.map(f=>f.name));
     for(const f of list){const name=slug(f);if(seen.has(name))report.issues.push({code:'duplicate_hosted_function',name});seen.add(name);if(!expected.has(name))report.issues.push({code:'extra_hosted_function',name});}
     // Bound concurrency; every manifest function is checked, not only pending functions.
     for(let start=0;start<local.functions.length;start+=3)await Promise.all(local.functions.slice(start,start+3).map(async fn=>{
      const remote=list.find(f=>slug(f)===fn.name),row={name:fn.name,manifest_deployed_version:fn.deployed_version??null,hosted_version:remote?.version??null,status:'unverified',files:[]};report.functions.push(row);
      if(!remote){row.status='missing';report.issues.push({code:'missing_hosted_function',name:fn.name});return;}
      row.hosted_status=remote.status;row.verify_jwt=remote.verify_jwt;row.expected_verify_jwt=fn.verify_jwt;row.version_matches_manifest=remote.version===fn.deployed_version;
      if(remote.status!=='ACTIVE'||remote.verify_jwt!==fn.verify_jwt||![false,null,undefined].includes(remote.import_map))report.issues.push({code:'function_configuration_differs',name:fn.name});
      try{
       const before=await call('/functions/'+fn.name);row.metadata_before_sha256=hash(metadata(before));
       if(hash(metadata(remote))!==row.metadata_before_sha256)throw error('function_changed_before_download');
       const files=await local.readFunctionMultipart(await call('/functions/'+fn.name+'/body'),before);
       if(Object.getPrototypeOf(files)!==Object.prototype)throw error('unsafe_function_file_map');
       const after=await call('/functions/'+fn.name);row.metadata_after_sha256=hash(metadata(after));
       if(row.metadata_before_sha256!==row.metadata_after_sha256)throw error('function_changed_during_download');
       const exact=canonical(Object.keys(files).sort())===canonical([...fn.files].sort());row.file_set_matches=exact;
       const all=new Set([...fn.files,...Object.keys(files)]);
       for(const name of [...all].sort())row.files.push({file:name,source_sha256:fn.sha256?.[name]??null,hosted_sha256:files[name]?digest(files[name]):null,matches:!!files[name]&&digest(files[name])===fn.sha256?.[name]});
       row.status=exact&&row.files.every(f=>f.matches)?'source_matches':'source_differs';
       if(row.status!=='source_matches')report.issues.push({code:'function_source_differs',name:fn.name});
       if(!row.version_matches_manifest)report.issues.push({code:'function_version_differs',name:fn.name});
      }catch(e){report.issues.push({component:'function',name:fn.name,...safeFailure(e)})}
     }));
    }
   }else report.issues.push({component:'function_list',...safeFailure(initial[1].reason)});
   if(history||list){const last=await Promise.allSettled([call('/database/query'),call('/functions')]);
    if(last[0].status==='fulfilled'){report.final_history_sha256=hash(last[0].value);report.history_stable=report.initial_history_sha256===report.final_history_sha256;if(!report.history_stable)report.issues.push({code:'hosted_history_drift_during_review'});}else report.issues.push({component:'final_history',...safeFailure(last[0].reason)});
    if(last[1].status==='fulfilled'&&Array.isArray(last[1].value)){report.final_functions_sha256=hash(sortedList(last[1].value));report.functions_stable=report.initial_functions_sha256===report.final_functions_sha256;if(!report.functions_stable)report.issues.push({code:'hosted_functions_drift_during_review'});}else report.issues.push({component:'final_functions',code:'final_list_unavailable'});
   }
  }
  try{const now=await localSources(sourceRoot,sourceSha);report.local_sources_stable=hash(now.proof)===hash(local.proof);if(!report.local_sources_stable)report.issues.push({code:'local_source_drift_during_review'})}catch{report.issues.push({code:'local_source_drift_during_review'})}
 }
 report.functions.sort((a,b)=>a.name.localeCompare(b.name));report.finished_at=new Date().toISOString();
 report.status=report.issues.length?'blocked':'full_parity';
 writeFileSync(reportFd,JSON.stringify(report,null,2)+'\n');return report;
 }finally{closeSync(reportFd)}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),[sourceRoot,sourceSha,reportPath,...extra]=args;if(!sourceRoot||!sourceSha||extra.length||args.some(arg=>arg.startsWith('--')))throw Error('Usage: node --use-env-proxy scripts/check-practice-release-backend.mjs <frozen-source-dir> <40-char-source-sha> [new-report-path]');
 const r=await runParity({sourceRoot,sourceSha,reportPath});console.log(JSON.stringify({project_ref:r.project_ref,source_sha:r.source_sha,status:r.status,local:r.source??null,migrations_checked:r.migrations.length,functions_checked:r.functions.length,issues:r.issues,report_path:reportPath||'/tmp/ig-release-backend-parity.json'}));if(r.status!=='full_parity')process.exitCode=1;
}
