// Disposable Postgres only. No hosted URLs, real records, comparison calls or models.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const name='ig-privacy-'+randomUUID();
const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],...options});
try{
 docker(['run','--detach','--rm','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
 // The entrypoint temporary server listens on a Unix socket only. Wait for
 // TCP inside the network-isolated container to avoid that initialization race.
 let ready=false;
 for(let attempt=0;attempt<40;attempt++){
  try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,250));}
 }
 if(!ready)throw Error('Isolated database did not start');
 const bootstrap=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,is_excluded boolean DEFAULT false,kyc_status text);
 CREATE TABLE public.user_roles(user_id uuid PRIMARY KEY,role text);
 CREATE TABLE public.kyc_verifications(user_id uuid PRIMARY KEY,provider text,external_session_id text,status text,document_verified boolean,selfie_verified boolean,provider_updated_at timestamptz,updated_at timestamptz);
 `;
 const migration=readFileSync(new URL('../supabase/migrations/20261022153018_secure_kyc_intake_review.sql',import.meta.url),'utf8');
 const regression=readFileSync(new URL('../tests/kyc-privacy-retention.sql',import.meta.url),'utf8');
 docker(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1'],{input:bootstrap+mutationGuard(migration)+regression});
 console.log('PASS isolated Postgres: cancellation, grant fencing, late keys, repeated batch cleanup, role exclusion, no client RPC access');
}finally{try{docker(['rm','--force',name]);}catch{}}
function mutationGuard(sql){
 // Only the checked-in local schema definition is loaded. No workflow action
 // from the comparison path is executed by this regression.
 if(!sql.includes('create function public.ig_kyc_action'))throw Error('Unexpected local schema');
 return sql;
}
