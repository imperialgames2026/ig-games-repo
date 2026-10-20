import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIdentity } from '../lib/identity.js';
function client({ profile = {id:'owner',is_excluded:false,role:'superadmin'}, role = 'tester', error = null, anonymous = false } = {}) {
  return {
    auth: {getUser: async () => ({data:{user:{id:'owner',email:'owner@example.test',is_anonymous:anonymous}}})},
    from(table) {return {select(){return this;},eq(key,value){assert.equal(value,'owner');return this;},
      async maybeSingle(){return {data:table==='profiles'?profile:role?{role}:null,error};}};},
  };
}
test('canonical role overrides stale privileged profile role', async () => {
  assert.equal((await resolveIdentity(client())).role,'tester');
});
test('missing role, failed lookup, invalid role and mismatched profile fail closed', async () => {
  for (const options of [{role:null},{role:'owner'},{error:{message:'offline'}},{profile:{id:'other',is_excluded:false}},{profile:null}]) {
    await assert.rejects(resolveIdentity(client(options)), /could not be verified/);
  }
});
test('exclusion is preserved and anonymous accounts are rejected', async () => {
  assert.equal((await resolveIdentity(client({profile:{id:'owner',is_excluded:true}}))).is_excluded,true);
  await assert.rejects(resolveIdentity(client({anonymous:true})), /registered account/);
});
test('a browser without a stored session is signed out while other auth errors remain visible', async () => {
  assert.equal(await resolveIdentity({auth:{getUser:async()=>({data:{user:null},error:{name:'AuthSessionMissingError'}})}}),null);
  await assert.rejects(resolveIdentity({auth:{getUser:async()=>({data:{user:null},error:new Error('Auth server unavailable')})}}),/Auth server unavailable/);
});
