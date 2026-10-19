import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(root,'supabase/backend-manifest.json'),'utf8'));
if(manifest.project_ref!=='qonqemhljgxlwpghkxhn') throw new Error('Unexpected staging target');
const arg=process.argv[2];
if(!arg) throw new Error('Usage: node scripts/prepare-reviewed-backend.mjs <empty-output-directory>');
const out=resolve(arg);
if(out===root || out.startsWith(root+'/supabase')) throw new Error('Output cannot overwrite source');
if(existsSync(out) && readdirSync(out).length) throw new Error('Output directory must be empty');
const safe=(base,path)=>{ const target=resolve(base,path); if(relative(base,target).startsWith('..')||target===base)throw new Error('Invalid manifest path');return target; };
mkdirSync(join(out,'supabase/migrations'),{recursive:true});
const versions=new Set();
for(const migration of manifest.migrations){
 const version=migration.file.split('_')[0];
 if(!/^\d{14}$/.test(version)||versions.has(version))throw new Error('Invalid or duplicate migration version');
 versions.add(version);
 const src=safe(join(root,'supabase/deployed-migrations'),migration.file);
 const content=readFileSync(src);
 if(createHash('sha256').update(content).digest('hex')!==migration.sha256)throw new Error('Migration checksum mismatch: '+migration.file);
 copyFileSync(src,join(out,'supabase/migrations',migration.file));
}
let config=`project_id = "${manifest.project_ref}"\n\n[db]\nmajor_version = 17\n`;
for(const fn of manifest.functions){
 if(!/^[a-z0-9-]+$/.test(fn.name)||typeof fn.verify_jwt!=='boolean')throw new Error('Invalid function manifest');
 if(!fn.verify_jwt && fn.name!=='ig-fireblocks-sandbox-webhook')throw new Error('Unexpected unauthenticated function');
 config+=`\n[functions.${fn.name}]\nverify_jwt = ${fn.verify_jwt}\n`;
 for(const name of fn.files){
  const src=safe(join(root,'supabase/functions',fn.name),name);
  if(/@base44\/sdk|base44Compat/.test(readFileSync(src,'utf8')))throw new Error('Legacy SDK in deployment');
  const dest=safe(join(out,'supabase/functions',fn.name),name);
  mkdirSync(dirname(dest),{recursive:true});copyFileSync(src,dest);
 }
}
writeFileSync(join(out,'supabase/config.toml'),config);
console.log(JSON.stringify({output:out,project:manifest.project_ref,migrations:versions.size,functions:manifest.functions.length}));
