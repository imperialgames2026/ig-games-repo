import {projectRoot} from './source-root.mjs';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {functions} from './policy.mjs';
const here=dirname(fileURLToPath(import.meta.url));const root=projectRoot;
const require=createRequire(resolve(root,'package.json'));const sha=x=>createHash('sha256').update(x).digest('hex');
export async function prepare(out){
 const dest=resolve(out);if(!dest.startsWith(resolve(here,'staged')+'/'))throw Error('stage must be a new child of review/staged');if(existsSync(dest))throw Error('refuse overwrite');
 const sdkRecords=JSON.parse(readFileSync(resolve(projectRoot,'../approved-runtime-acquisition/verified-sdks.json')));
 const expectedSdks=JSON.parse(readFileSync(resolve(here,'dependency-acquisition.json'))).packages;
 for(const sdk of sdkRecords){const expected=expectedSdks.find(x=>x.version===sdk.version);if(!expected||sdk.topIntegrity!==expected.integrity||sha(readFileSync(resolve(sdk.path,'package-lock.json')))!==sdk.lockSha256)throw Error('SDK cache provenance mismatch');}
 const {build}=require('esbuild');mkdirSync(dest,{recursive:true,mode:0o700});const records=[],helpers=[];
 for(const slug of functions){
  const source=resolve(root,`supabase/functions/${slug}/index.ts`);const outfile=resolve(dest,`functions/${slug}/index.js`);
  const result=await build({entryPoints:[source],outfile,bundle:true,write:false,platform:'browser',format:'esm',metafile:true,plugins:[{name:'exact-runtime-dependencies',setup(b){b.onResolve({filter:/^(npm:|https?:)/},a=>{const match=a.path.match(/^(?:npm:@supabase\/supabase-js@|https:\/\/esm\.sh\/@supabase\/supabase-js@)(2\.57\.[04])$/);if(!match)throw Error('unreviewed dependency');const sdk=sdkRecords.find(x=>x.version===match[1]);if(!sdk)throw Error('exact SDK cache absent');const packageRoot=resolve(sdk.path,'node_modules/@supabase/supabase-js');const pkg=JSON.parse(readFileSync(resolve(packageRoot,'package.json')));if(pkg.version!==match[1])throw Error('SDK version mismatch');return {path:resolve(packageRoot,pkg.module||pkg.main)};});}}]});
  mkdirSync(dirname(outfile),{recursive:true,mode:0o700});writeFileSync(outfile,result.outputFiles[0].contents,{mode:0o600});
  records.push({slug,sourceSha256:sha(readFileSync(source)),bundleSha256:sha(result.outputFiles[0].contents),inputs:Object.keys(result.metafile.inputs).sort().map(path=>({path,sha256:sha(readFileSync(resolve(path)))})),exactExternalImports:result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].imports.filter(x=>x.external).map(x=>x.path),runtimeDependencyCacheVerified:true});
 }
 for(const file of ['main.ts','gateway.mjs','policy.mjs']){const content=readFileSync(resolve(here,file));const target=resolve(dest,file==='main.ts'?'application-main/index.ts':file);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,content,{mode:0o600});helpers.push({file:file==='main.ts'?'application-main/index.ts':file,sha256:sha(content)});}
 writeFileSync(resolve(dest,'source-manifest.json'),JSON.stringify({reviewOnly:true,runtimeStarted:false,sdkLocks:sdkRecords.map(x=>({version:x.version,lockSha256:x.lockSha256,topIntegrity:x.topIntegrity})),helpers,functions:records},null,2)+'\n',{mode:0o600});return {bundles:records.length,runtimeStarted:false};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+resolve(process.argv[1])).href){if(process.argv.length!==3)throw Error('usage: prepare.mjs <new review/staged/NAME>');console.log(JSON.stringify(await prepare(process.argv[2])));}
