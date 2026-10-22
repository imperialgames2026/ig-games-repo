import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { hasCompletedMfa } from '../lib/serverMfa.js';
import { requireCompletedMfa, verifyAuthenticator } from '../lib/mfa.js';
import { resolveIdentity } from '../lib/identity.js';
const id = '11111111-1111-4111-8111-111111111111';
const enrolled = { id, factors: [{ id:'factor', factor_type:'totp', status:'verified' }] };
const token = claims => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.validated-by-auth-fixture`;
test('server boundary uses Auth factors and the validated token, never editable metadata', () => {
  assert.equal(hasCompletedMfa({ id }, 'fixture'), true);
  assert.equal(hasCompletedMfa({ id, factors:[{status:'unverified'}] }, 'fixture'), true);
  assert.equal(hasCompletedMfa(null, 'fixture'), false);
  for (const claims of [{sub:id},{sub:id,aal:'aal1'},{sub:'other',aal:'aal2'}]) assert.equal(hasCompletedMfa(enrolled, token(claims)), false);
  assert.equal(hasCompletedMfa(enrolled, 'bad.jwt'), false);
  assert.equal(hasCompletedMfa({...enrolled,user_metadata:{aal:'aal2',mfa_enabled:false}}, token({sub:id,aal:'aal1'})), false);
  assert.equal(hasCompletedMfa(enrolled, token({sub:id,aal:'aal2'})), true);
});
test('identity must challenge enrolled sessions before any private table reads', async () => {
  let reads = 0;
  const client = { auth: { getUser:async()=>({data:{user:enrolled}}), mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'}})} }, from(){reads++;throw Error('Unexpected private read');} };
  await assert.rejects(resolveIdentity(client), error=>error.type==='mfa_required');
  assert.equal(reads,0);
  client.auth.mfa.getAuthenticatorAssuranceLevel = async()=>({error:Error('offline')});
  await assert.rejects(requireCompletedMfa(client,enrolled),/offline/);
});
test('malformed codes never reach Auth and valid codes use native challenge-and-verify', async () => {
  const calls=[];
  const client={auth:{mfa:{challengeAndVerify:async args=>{calls.push(args);return {};}}}};
  for(const code of ['12345','1234567','abc123',' 123456']) await assert.rejects(verifyAuthenticator(client,'factor',code));
  assert.equal(calls.length,0);
  await verifyAuthenticator(client,'factor','012345');
  assert.deepEqual(calls,[{factorId:'factor',code:'012345'}]);
});
const manifest=JSON.parse(readFileSync(new URL('../supabase/backend-manifest.json',import.meta.url)));
const canonical=readFileSync(new URL('../lib/serverMfa.js',import.meta.url),'utf8').replace('export function','function');
for(const fn of manifest.functions.filter(f=>f.name!=='ig-fireblocks-sandbox-webhook')) {
  test(`${fn.name}: enrolled password-only sessions cannot reach data or settlement`, async()=>{
    let handler, reads=0;
    const raw=readFileSync(new URL(`../supabase/functions/${fn.name}/index.ts`,import.meta.url),'utf8');
    assert.ok(raw.includes(`// BEGIN GENERATED MFA GUARD\n${canonical}// END GENERATED MFA GUARD`));
    const source=raw.replace(/^import[^\n]*\n/gm,'');
    const client={auth:{getUser:async()=>({data:{user:enrolled},error:null})},from(){reads++;throw Error('MFA bypass reached data');},rpc(){reads++;throw Error('MFA bypass reached RPC');}};
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
      exports:{},Deno:{serve:fn=>handler=fn,env:{get:key=>key==='SUPABASE_URL'?'https://qonqemhljgxlwpghkxhn.supabase.co':key==='IG_LOCAL_PRACTICE'?'false':'fixture-key'}},
      createClient:()=>client,Response,Request,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,atob,btoa,crypto,JSON,console,
    });
    const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:`Bearer ${token({sub:id,aal:'aal1'})}`,'content-type':'application/json'},body:JSON.stringify({action:fn.name==='ign-staking-v1'?'overview':'list'})}));
    assert.equal(response.status,403,await response.clone().text());
    assert.match(await response.text(),/Two-step verification required/);
    assert.equal(reads,0);
  });
}
