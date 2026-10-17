// Run only against an isolated staging Supabase project with seeded test accounts.
// Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// TEST_PLAYER_EMAIL/PASSWORD, TEST_ADMIN_EMAIL/PASSWORD, TEST_SUPERADMIN_EMAIL/PASSWORD,
// TEST_TARGET_USER_ID, TEST_PROTECTED_ADMIN_USER_ID, TEST_LOW_BALANCE_USER_ID.
// All accounts and wallets must be disposable. NEVER point at production.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
const env = process.env;
const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','TEST_PLAYER_EMAIL','TEST_PLAYER_PASSWORD','TEST_ADMIN_EMAIL','TEST_ADMIN_PASSWORD','TEST_SUPERADMIN_EMAIL','TEST_SUPERADMIN_PASSWORD','TEST_TARGET_USER_ID','TEST_PROTECTED_ADMIN_USER_ID','TEST_LOW_BALANCE_USER_ID'];
for(const key of required) assert.ok(env[key], 'Missing '+key);
assert.equal(env.ALLOW_DESTRUCTIVE_STAGING_TESTS,'true','Set ALLOW_DESTRUCTIVE_STAGING_TESTS=true on an isolated staging project');
assert.equal(env.SUPABASE_URL,'https://qonqemhljgxlwpghkxhn.supabase.co','Refusing any target other than the designated isolated staging project');
const service=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
const anon=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY);
const endpoint=env.SUPABASE_URL+'/functions/v1/admin-mutations';
async function login(role){
 const client=createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY);
 const {data,error}=await client.auth.signInWithPassword({email:env['TEST_'+role+'_EMAIL'],password:env['TEST_'+role+'_PASSWORD']});
 assert.ifError(error);return data.session.access_token;
}
const tokens={player:await login('PLAYER'),admin:await login('ADMIN'),superadmin:await login('SUPERADMIN')};
async function call(token,payload){
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:env.SUPABASE_ANON_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});
 return {status:res.status,body:await res.json()};
}
const req=(target_id,action='wallet_adjustment',delta=1,request_id=crypto.randomUUID())=>({target_id,action,reason:'Staging security test operation',request_id,...(action==='wallet_adjustment'?{currency:'IGT',delta}:{})});
async function balance(id){const {data,error}=await service.from('wallets').select('igt_balance').eq('user_id',id).single();assert.ifError(error);return Number(data.igt_balance)}
async function audit(id){const {data,error}=await service.from('admin_action_audit').select('id').eq('request_id',id);assert.ifError(error);return data.length}
test('anonymous requests denied',async()=>assert.equal((await call(null,req(env.TEST_TARGET_USER_ID))).status,401));
test('player cannot adjust balance',async()=>assert.equal((await call(tokens.player,req(env.TEST_TARGET_USER_ID))).status,403));
test('admin cannot adjust balance',async()=>assert.equal((await call(tokens.admin,req(env.TEST_TARGET_USER_ID))).status,403));
test('admin cannot act on another admin',async()=>assert.equal((await call(tokens.admin,req(env.TEST_PROTECTED_ADMIN_USER_ID,'exclude'))).status,403));
test('insufficient funds do not change balance or audit',async()=>{
 const id=crypto.randomUUID(),before=await balance(env.TEST_LOW_BALANCE_USER_ID);
 const res=await call(tokens.superadmin,req(env.TEST_LOW_BALANCE_USER_ID,'wallet_adjustment',-10000,id));
 assert.equal(res.status,422);assert.equal(await balance(env.TEST_LOW_BALANCE_USER_ID),before);assert.equal(await audit(id),0);
});
test('idempotent retry only credits once',async()=>{
 const id=crypto.randomUUID(),payload=req(env.TEST_TARGET_USER_ID,'wallet_adjustment',1,id),before=await balance(env.TEST_TARGET_USER_ID);
 const first=await call(tokens.superadmin,payload);assert.equal(first.status,200,JSON.stringify(first.body));
 const second=await call(tokens.superadmin,payload);assert.equal(second.status,200,JSON.stringify(second.body));
 assert.equal(second.body.result.replayed,true);
 assert.equal(await balance(env.TEST_TARGET_USER_ID),before+1);assert.equal(await audit(id),1);
});
test('idempotency key conflict is rejected',async()=>{
 const id=crypto.randomUUID(),payload=req(env.TEST_TARGET_USER_ID,'wallet_adjustment',1,id);
 assert.equal((await call(tokens.superadmin,payload)).status,200);
 assert.equal((await call(tokens.superadmin,{...payload,delta:2})).status,409);
 assert.equal(await audit(id),1);
});
test('concurrent independent credits preserve both updates',async()=>{
 const before=await balance(env.TEST_TARGET_USER_ID),ids=[crypto.randomUUID(),crypto.randomUUID()];
 const responses=await Promise.all(ids.map(id=>call(tokens.superadmin,req(env.TEST_TARGET_USER_ID,'wallet_adjustment',1,id))));
 assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.equal(await balance(env.TEST_TARGET_USER_ID),before+2);
 for(const id of ids)assert.equal(await audit(id),1);
});
test('concurrent duplicate request settles once',async()=>{
 const before=await balance(env.TEST_TARGET_USER_ID),payload=req(env.TEST_TARGET_USER_ID,'wallet_adjustment',1);
 const responses=await Promise.all([call(tokens.superadmin,payload),call(tokens.superadmin,payload)]);
 assert.ok(responses.every(r=>r.status===200),JSON.stringify(responses));
 assert.equal(await balance(env.TEST_TARGET_USER_ID),before+1);
 assert.equal(await audit(payload.request_id),1);
});
