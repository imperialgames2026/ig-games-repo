import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const project='qonqemhljgxlwpghkxhn';
const list=value=>typeof value==='string'?value.split(',').map(x=>x.trim()).filter(Boolean):[];
const flag=value=>typeof value==='boolean'?value:null;
export function summarizeConfig(auth,rest,backups){
 const redirects=list(auth.uri_allow_list);
 const schemas=list(rest.db_schema);
 const completed=(Array.isArray(backups.backups)?backups.backups:[]).filter(x=>x.status==='COMPLETED').map(x=>Date.parse(x.inserted_at)).filter(Number.isFinite).sort((a,b)=>b-a);
 const physical=backups.physical_backup_data;
 const physicalLatest=Number(physical?.latest_physical_backup_date_unix);
 const latest=Math.max(completed[0]||0,Number.isFinite(physicalLatest)?physicalLatest*1000:0);
 return {
  project,checked_at:new Date().toISOString(),
  auth:{site_url_matches:auth.site_url==='https://imperialgaming.llc',
   website_callback_exact:redirects.includes('https://imperialgaming.llc/'),
   password_recovery_exact:redirects.includes('https://imperialgaming.llc/ResetPassword'),
   www_password_recovery_exact:redirects.includes('https://www.imperialgaming.llc/ResetPassword'),
   redirect_count:redirects.length,wildcard_redirect_count:redirects.filter(x=>/[?*]/.test(x)).length,
   totp_enroll_enabled:flag(auth.mfa_totp_enroll_enabled),totp_verify_enabled:flag(auth.mfa_totp_verify_enabled),
   email_enabled:flag(auth.external_email_enabled),email_autoconfirm:flag(auth.mailer_autoconfirm),
   custom_smtp_configured:!!(auth.smtp_host&&auth.smtp_user&&auth.smtp_pass),
   anonymous_users_enabled:flag(auth.external_anonymous_users_enabled)},
  api:{schemas_known:schemas.length>0,public_exposed:schemas.includes('public'),internal_exposed:schemas.some(x=>['internal','ig_wallet_internal','auth','storage'].includes(x))},
  recovery:{completed_backup_count:completed.length,pitr_enabled:flag(backups.pitr_enabled),walg_enabled:flag(backups.walg_enabled),latest_backup_at:latest?new Date(latest).toISOString():null,backup_within_48h:latest>0&&Date.now()-latest>=0&&Date.now()-latest<48*3600000,restore_exercised:false,storage_objects_included:false}
 };
}
async function main(){
 const token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!token)throw Error('Existing staging deployment credential is unavailable');
 const paths=['/config/auth','/postgrest','/database/backups'];
 const responses=await Promise.all(paths.map(async path=>{
  const r=await fetch('https://api.supabase.com/v1/projects/'+project+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Read-only config endpoint '+path+' returned HTTP '+r.status);
  return r.json();
 }));
 // Never write raw configuration, credential values, URLs, account records or
 // backup download links to stdout or artifacts. Only this allowlisted summary.
 const result=summarizeConfig(...responses);console.log(JSON.stringify(result,null,2));
 if(!result.api.schemas_known||result.api.internal_exposed||!result.recovery.backup_within_48h)throw Error('Release config review requires attention');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message.startsWith('Read-only config endpoint')||error.message.startsWith('Existing staging')||error.message==='Release config review requires attention'?error.message:'Read-only config check failed without exposing response details');process.exitCode=1;});
