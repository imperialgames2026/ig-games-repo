import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeConfig} from '../scripts/verify-hosted-release-config.mjs';
test('hosted release report never includes credentials or unexpected configuration fields',()=>{
 const secret='DO-NOT-LOG-test-secret';
 const auth={site_url:'https://imperialgaming.llc',uri_allow_list:'https://imperialgaming.llc/,https://imperialgaming.llc/ResetPassword,https://example.invalid/'+secret,smtp_host:secret,smtp_user:secret,smtp_pass:secret,jwt_secret:secret,mfa_totp_enroll_enabled:true,mfa_totp_verify_enabled:false};
 const result=summarizeConfig(auth,{db_schema:'public,internal',jwt_secret:secret},{backups:[{status:'COMPLETED',inserted_at:new Date().toISOString(),download_url:secret}],secret});
 assert(!JSON.stringify(result).includes(secret));assert.equal(result.api.internal_exposed,true);assert.equal(result.auth.password_recovery_exact,true);assert.equal(result.auth.totp_verify_enabled,false);assert.equal(result.recovery.backup_within_48h,true);
});
test('unknown settings and old or failed backups cannot establish readiness',()=>{
 const result=summarizeConfig({}, {},{backups:[{status:'FAILED',inserted_at:new Date().toISOString()},{status:'COMPLETED',inserted_at:'2020-01-01'}]});
 assert.equal(result.api.schemas_known,false);assert.equal(result.auth.totp_enroll_enabled,null);assert.equal(result.auth.password_recovery_exact,false);assert.equal(result.recovery.backup_within_48h,false);assert.equal(result.recovery.restore_exercised,false);
});
