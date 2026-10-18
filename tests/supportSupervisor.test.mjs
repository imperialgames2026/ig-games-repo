import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifySupportByRules,redactSupportText} from '../supabase/functions/ig-support-supervisor/triage.js';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const supervisor=get('supabase/functions/ig-support-supervisor/index.ts');
const admin=get('pages/AdminSupport.jsx');
const player=get('pages/Support.jsx');
const schema=get('supabase/migrations/20261018161000_support_supervisor_queue.sql');
const auto=get('supabase/migrations/20261018162000_support_auto_triage_watch.sql');

test('all sensitive or account-impacting cases must always escalate to humans',()=>{
 const cases=[
  ['Withdrawals','My withdrawal is stuck','payments'],
  ['Account hacked','Someone stole my login','security'],
  ['KYC issue','My documents were rejected','kyc'],
  ['Responsible gaming','I cannot stop gambling','responsible_play'],
  ['Refund request','I need a chargeback','payments'],
  ['Suspended account','Please unban me','kyc'],
  ['Account issue','Unauthorised activity detected','security'],
 ];
 for(const [subject,body,category] of cases){
  const r=classifySupportByRules(subject,body);
  assert.equal(r.requires_superadmin,true,subject);
  assert.equal(r.category,category,subject);
  assert.equal(r.priority,'high');
 }
 const basic=classifySupportByRules('Craps rules','How does a point work?');
 assert.equal(basic.requires_superadmin,false);
 assert.equal(basic.category,'gaming');
});
test('AI input redacts obvious PII; untrusted ticket text can never become an instruction',()=>{
 assert.ok(!redactSupportText('Please email me at test@example.com').includes('test@example.com'));
 assert.ok(!redactSupportText('My phone is +1 (415) 555-1212').includes('555-1212'));
 assert.ok(!redactSupportText('Wallet 0x'+'b'.repeat(40)).includes('0x'+'b'.repeat(40)));
 assert.equal(redactSupportText('a'.repeat(4000)).length,1200);
 assert.match(supervisor,/UNTRUSTED data/);
 assert.match(supervisor,/store:false/);
 assert.match(supervisor,/SUPPORT_AI_ENABLED/);
 assert.match(supervisor,/SUPPORT_OPENAI_API_KEY/);
 assert.match(supervisor,/SUPPORT_AI_MODEL/);
 assert.match(supervisor,/rules\.requires_superadmin\|\|answer\.requires_superadmin/);
});
test('staff-only support API and read-only AI suggestions never autonomously affect customer funds',()=>{
 assert.match(supervisor,/auth\.auth\.getUser\(bearer\)/);
 assert.match(supervisor,/\["admin","superadmin"\]/);
 assert.match(supervisor,/profile\.data\?\.is_excluded!==false/);
 assert.match(supervisor,/Object\.keys\(body\)\.length!==1/);
 assert.match(supervisor,/suggested_reply/);
 assert.doesNotMatch(supervisor,/(?:wallets|withdrawal_requests|crypto_deposit_observations)[\"']/);
 assert.match(admin,/ig-support-v1/);
 assert.match(admin,/ig-support-supervisor/);
 assert.match(admin,/support\('queue'\)/);
 assert.match(admin,/support\('messages'/);
 assert.match(admin,/support\('post'/);
 assert.match(admin,/support\('status'/);
 assert.match(admin,/crypto\.randomUUID\(\)/);
 assert.match(admin,/Use draft \(review before sending\)/);
 assert.match(player,/support\('mine'\)|call\('mine'\)/);
 assert.match(player,/call\('open'/);
 assert.match(player,/call\('post'/);
 assert.doesNotMatch(admin,/base44|\.from\('ig_support_messages'\)/i);
 assert.doesNotMatch(player,/base44|InvokeLLM|supportAIAssistant/);
});
test('private database queues auto-flag cases while external email and SMS require explicit verification',()=>{
 assert.match(schema,/ig_support_supervisor_reviews/);
 assert.match(schema,/ig_support_supervisor_alerts/);
 assert.match(schema,/enable row level security/g);
 assert.match(schema,/revoke all on public\.ig_support_supervisor_queue/);
 assert.match(schema,/sender_kind='player'/);
 assert.match(auto,/ig_support_supervisor_rules_watch\(\)/);
 assert.match(auto,/cron\.schedule/);
 assert.match(auto,/\* \* \* \* \*/);
 assert.match(auto,/not exists/);
 assert.match(supervisor,/SUPPORT_ALERTS_ENABLED/);
 assert.match(supervisor,/SUPPORT_SUPERADMIN_EMAIL_VERIFIED/);
 assert.match(supervisor,/SUPPORT_SUPERADMIN_PHONE_VERIFIED/);
 assert.match(supervisor,/SUPPORT_RESEND_API_KEY/);
 assert.match(supervisor,/SUPPORT_TWILIO_ACCOUNT_SID/);
 assert.match(supervisor,/email_state:"disabled"|"disabled"/);
 assert.match(supervisor,/email_attempted_at/);
 assert.match(supervisor,/sms_attempted_at/);
});
