// UNWIRED. Runtime owner only: existing approved disposable provider and actual Auth actors.
// Import does not start processes or execute SQL. No new services, public API or credentials.
import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
export async function consentDeletionSessions({db,actors,run,ownedFixtures}){
 assert.match(run,/^[a-f0-9]{32}$/);assert.ok(Array.isArray(ownedFixtures));
 const cases=['softGrantFirst','softDeleteFirst','hardGrantFirst','hardDeleteFirst'];
 assert.deepEqual(Object.keys(actors).sort(),[...cases].sort());
 for(const id of Object.values(actors))assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
 assert.equal(new Set(Object.values(actors)).size,4);const results=[];
 // Captured provisioner outputs AND canonical fresh-Auth email must match this run.
 // Do all ownership checks before the first destructive case, not mid-run.
 const ownership=new Map();
 for(const id of Object.values(actors)){
  const fixture=ownedFixtures.find(x=>x.id===id);
  assert.ok(fixture);assert.equal(fixture.phase,'sms-deletion');
  assert.match(fixture.kind,/^player-[a-d]$/);
  assert.equal(fixture.email,`${fixture.kind}-sms-deletion-${run}@example.invalid`);
  assert.equal(ownedFixtures.filter(x=>x.id===id).length,1);
  const email=(await db.sql(`select email from auth.users where id='${id}' and deleted_at is null`)).trim();
  assert.equal(email,fixture.email);ownership.set(id,fixture.email);
 }
 assert.equal(new Set(ownership.values()).size,4);
 for(const name of cases){
  const id=actors[name],key=randomUUID(),hard=name.startsWith('hard'),grantFirst=name.endsWith('GrantFirst');
  const fresh=JSON.parse(await db.sql(`select json_build_object('active',exists(select 1 from auth.users where id='${id}' and deleted_at is null),'events',(select count(*) from ig_sms_consent.events where actor_id='${id}'))`));assert.equal(fresh.active,true);assert.equal(fresh.events,0);
  const grant=`set local role service_role;select public.practice_sms_consent_v1('${id}','${key}','grant','+12025550123','2026-10-27.v1',0);`;
  const deletion=`set local role supabase_auth_admin;${hard?`delete from auth.users where id='${id}';`:`update auth.users set deleted_at=clock_timestamp() where id='${id}';`}`;
  const scripts=grantFirst?[grant+'select pg_sleep(0.35);','select pg_sleep(0.15);'+deletion]:[deletion+'select pg_sleep(0.35);','select pg_sleep(0.15);'+grant];
  const race=await db.race('consent-deletion-'+name,scripts,grantFirst?2:1);
  assert.equal(race.sessions[0].ok,true);assert.equal(race.sessions[1].ok,grantFirst);
  if(!grantFirst)assert.match(race.sessions[1].error,/CONSENT_NOT_AUTHORIZED/);
  const after=JSON.parse(await db.sql(`select json_build_object('events',(select count(*) from ig_sms_consent.events where actor_id='${id}'),'state',(select count(*) from ig_sms_consent.current_state where actor_id='${id}'),'actorExists',exists(select 1 from auth.users where id='${id}'),'deleted',exists(select 1 from auth.users where id='${id}' and deleted_at is not null))`));assert.equal(after.events,0);assert.equal(after.state,0);assert.equal(after.actorExists,!hard);assert.equal(after.deleted,!hard);
  const stale=await db.result('begin;'+grant+'commit;');assert.notEqual(stale.code,0);assert.match(stale.err,/CONSENT_NOT_AUTHORIZED/);
  const status=await db.result(`begin;set local role service_role;select public.practice_sms_consent_status_v1('${id}');commit;`);assert.notEqual(status.code,0);assert.match(status.err,/CONSENT_NOT_AUTHORIZED/);
  results.push({name,actorId:id,requestId:key,race,after,staleGrantDenied:true,statusDenied:true});
 }
 return {independentSessions:true,cases:results,phoneTombstones:false,hardUuidRecreationSupported:false,hostedReady:false};
}
