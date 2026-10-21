import {createHash} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import {LAB_SUPABASE_URL} from '../config/test-lab.js';

// These seven exact guard expressions lack the existing local-only branch used
// by the other practice handlers. Patch generated local copies exclusively.
export const LOCAL_GUARD_PATCHES = Object.freeze({
  'ig-originals-practice': `url !== '${LAB_SUPABASE_URL}'`,
  'ig-mines-practice': `url !== '${LAB_SUPABASE_URL}'`,
  'ig-admin-users-preview-v1': 'url !== STAGING_URL',
  'ig-admin-command-center': 'url!=="https://"+PROJECT+".supabase.co"',
  'ig-player-analytics-v1': 'url !== `https://${STAGING_REF}.supabase.co`',
  'ig-poker-tournament-prizes': 'url!=="https://"+PROJECT+".supabase.co"',
  'ig-poker-tournament-admin': 'url!=="https://"+STAGING+".supabase.co"',
});
const sha256 = value => createHash('sha256').update(value).digest('hex');
export function localizePracticeGuard(name, source) {
 const guard = LOCAL_GUARD_PATCHES[name];
 if (!guard) return source;
 if (source.split(guard).length !== 2 || source.includes('IG_LOCAL_PRACTICE')) throw Error('Unexpected local guard source: ' + name);
 return source.replace(guard, `(${guard} && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000'))`);
}
export function prepareLocalTestFunctions({candidateDirectory, output}) {
 const candidate = realpathSync(candidateDirectory);
 const out = resolve(output);
 if (existsSync(out)) throw Error('Local function output must be a new directory');
 const report = JSON.parse(readFileSync(join(candidate, 'test-lab-backend-report.json'), 'utf8'));
 if (report.status !== 'offline_candidate_not_deployed' || report.supabase_url !== LAB_SUPABASE_URL) throw Error('Unexpected tester candidate');
 const files = [];
 for (const fn of report.functions) {
  if (!/^[a-z0-9-]+$/.test(fn.name) || !fn.verify_jwt) throw Error('Only authenticated practice handlers may run locally');
  for (const file of fn.files) {
   const prefix = `supabase/functions/${fn.name}/`;
   if (!file.path.startsWith(prefix)) throw Error('Unexpected candidate function path');
   const tail = file.path.slice(prefix.length);
   if (!tail || isAbsolute(tail) || tail.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid local function path');
   const src = join(candidate, file.path);
   const rel = relative(candidate, realpathSync(src));
   if (rel.startsWith('..') || isAbsolute(rel) || !lstatSync(src).isFile()) throw Error('Candidate path escapes package');
   const bytes = readFileSync(src);
   if (sha256(bytes) !== file.generated_sha256) throw Error('Candidate function checksum mismatch');
   const generated = tail === 'index.ts' ? localizePracticeGuard(fn.name, bytes.toString('utf8')) : bytes;
   files.push({path:fn.name + '/' + tail, bytes:generated, source_sha256:file.generated_sha256, local_sha256:sha256(generated), patch:tail === 'index.ts' && LOCAL_GUARD_PATCHES[fn.name] ? 'explicit_local_practice_url_guard' : null});
  }
 }
 for (const name of Object.keys(LOCAL_GUARD_PATCHES)) if (!files.some(file => file.path === name + '/index.ts')) throw Error('Required local handler missing: ' + name);
 for (const file of files) {
  const target = join(out,file.path);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,file.bytes,{flag:'wx'});
 }
 const localReport = {status:'local_only_candidate_not_deployed', allowed_local_url:'http://kong:8000', required_flag:'IG_LOCAL_PRACTICE=true', patches:Object.keys(LOCAL_GUARD_PATCHES), files:files.map(({bytes,...file}) => file)};
 writeFileSync(join(out,'local-function-report.json'),JSON.stringify(localReport,null,2) + '\n',{flag:'wx'});
 return localReport;
}
