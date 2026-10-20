import {createHash} from 'node:crypto';
import {posix} from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Only one successful deployment of this reviewed candidate may advance the
// recorded version. Matching bytes/config are mandatory; version alone is never proof.
export async function planFunctions(functions, remoteFunctions, loadSource, downloadSource) {
 const pending=[];
 for(const fn of functions.filter(f=>f.status==='pending_deployment')) {
  const remote=remoteFunctions.find(f=>(f.slug||f.name)===fn.name);
  const version=remote?.version??null;
  if(remote && (remote.status!=='ACTIVE' || remote.verify_jwt!==fn.verify_jwt || remote.import_map===true)) throw Error('Hosted function configuration drift: '+fn.name);
  if(version===fn.deployed_version) {pending.push(fn);continue;}
  if(!remote || version!==(fn.deployed_version??0)+1 || remote.status!=='ACTIVE' ||
     remote.verify_jwt!==fn.verify_jwt || remote.import_map===true) throw Error('Hosted function drift: '+fn.name);
  const files=await downloadSource(fn.name,remote);
  if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify([...fn.files].sort()) ||
     fn.files.some(name=>hash(files[name])!==hash(loadSource(fn.name,name)))) {
   throw Error('Hosted function content differs from reviewed candidate: '+fn.name);
  }
 }
 return pending;
}

// Management API's server-side multipart download is also used by Supabase CLI.
// Never extract remote paths to disk. Reject extra, duplicate or escaping paths.
export async function readFunctionMultipart(response, remote) {
 if(!response.ok) throw Error('Function source download HTTP '+response.status);
 if(!response.headers.get('content-type')?.startsWith('multipart/form-data')) throw Error('Expected multipart function sources');
 const form=await response.formData();
 const metadata=JSON.parse(form.get('metadata')||'{}');
 const entry=metadata.deno2_entrypoint_path||metadata.entrypoint_path||remote.entrypoint_path;
 if(typeof entry!=='string') throw Error('Missing function entrypoint');
 const path=value=>value.startsWith('file://')?decodeURIComponent(new URL(value).pathname):value;
 if(posix.basename(path(entry))!=='index.ts') throw Error('Unexpected function entrypoint');
 const root=posix.dirname(path(entry)), files={};
 for(const [field,file] of form.entries()) {
  if(field==='metadata') continue;
  if(typeof file==='string') throw Error('Unexpected function source field');
  const raw=path(file.name);
  const name=posix.isAbsolute(raw)?posix.relative(root,raw):raw;
  if(!name || name.startsWith('../') || posix.isAbsolute(name) || name.includes('\\') || posix.normalize(name)!==name || Object.hasOwn(files,name)) throw Error('Unsafe or duplicate function source path');
  files[name]=Buffer.from(await file.arrayBuffer());
 }
 return files;
}
