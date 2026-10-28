// Build a consent-only deployment artifact. No network or hosted operations.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),arg=process.argv[2];
if(process.argv.length!==3||!arg)throw Error('Usage: prepare-sms-consent-release.mjs <empty-output-directory>');
const out=resolve(arg);if(out===root||out.startsWith(root+'/'))throw Error('Output must not overwrite source');if(existsSync(out)&&readdirSync(out).length)throw Error('Output must be empty');
const plan=JSON.parse(readFileSync(resolve(root,'docs/sms-consent-release-package.json')));if(plan.project_ref!=='qonqemhljgxlwpghkxhn'||plan.functions.length!==1||plan.functions[0].name!=='sms-consent'||plan.functions[0].verify_jwt!==true||plan.sms_delivery_enabled!==false)throw Error('Consent package scope mismatch');
const hash=b=>createHash('sha256').update(b).digest('hex'),layers=[plan.sql,plan.sql.followup];
const body=layers.map(x=>{const b=readFileSync(resolve(root,x.file));if(hash(b)!==x.sha256)throw Error('Consent SQL source drift');return b;}).map(b=>b.toString()).join('\n');
if(hash(body)!==plan.sql.atomic_bundle_sha256)throw Error('Atomic SQL bundle drift');
mkdirSync(resolve(out,'function'),{recursive:true});for(const [file,sha]of Object.entries(plan.functions[0].sha256)){if(!['index.ts','policy.mjs'].includes(file))throw Error('Unexpected consent file');const src=resolve(root,'supabase/functions/sms-consent',file);if(hash(readFileSync(src))!==sha)throw Error('Handler source drift');copyFileSync(src,resolve(out,'function',file));}
writeFileSync(resolve(out,'consent.sql'),body);writeFileSync(resolve(out,'release-package.json'),JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify({project:plan.project_ref,functions:['sms-consent'],sqlLayers:2,sqlSha256:hash(body),atomicApplyRequired:true,applied:false,smsEnabled:false}));
