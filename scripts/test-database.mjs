import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const container='supabase_db_qonqemhljgxlwpghkxhn';
const details=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
// Refuse any remote database or an arbitrary container supplied by environment.
if(details.Name!=='/'+container||!details.State.Running)throw Error('Start the isolated local Supabase project before running database tests');
const fixtures=readFileSync(root+'scripts/database/fixtures.sql','utf8');
const files=['secure_wallet_negative.sql','admin_mutations_transactional.sql','poker_event_smoke.sql','poker_timebank_smoke.sql','poker_prize_ladder_100_spots_rollback.sql','shared_crash_trenball_transactional.sql','canonical_signup_ign_replay_rollback.sql','practice_application_readiness.sql','canonical_wallet_admin_rollback.sql','profile_settings_rollback.sql','originals_practice_rollback.sql','mines_practice_rollback.sql','catalog_and_records_rollback.sql','final_practice_rollback.sql','ign_invoker_boundary_rollback.sql','backend_only_rls_rollback.sql','announcements_rollback.sql','sweepstakes_requests_rollback.sql','vip_catalog_rollback.sql','vip_level_spins_rollback.sql','vip_wheel_redemption_rollback.sql'];
for(const file of files){
 const source=readFileSync(root+'supabase/tests/'+file,'utf8').replace(/^\s*BEGIN;\s*$/gim,'').replace(/^\s*ROLLBACK;\s*$/gim,'');
 const result=spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:'BEGIN;\n'+fixtures+'\n'+source+'\nROLLBACK;\n',encoding:'utf8',timeout:60000});
 if(result.status!==0){console.error(result.stderr);throw Error('Database test failed: '+file);}
 console.log('PASS '+file);
}
console.log(`All ${files.length} transactional database suites passed; fixture and test changes rolled back.`);
