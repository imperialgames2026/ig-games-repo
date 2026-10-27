// Disposable local Auth integration only. Import performs no requests or writes.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function consentDeletionHttp({origin,run,anon,service,db,ownedFixtures,control}) {
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1'||origin!=='http://127.0.0.1:54321'||!/^[a-f0-9]{32}$/.test(run))throw Error('Approved local synthetic deletion only');
 assert.equal(ownedFixtures.length,4);assert.equal(new Set(ownedFixtures.map(x=>x.id)).size,4);assert.equal(new Set(ownedFixtures.map(x=>x.kind)).size,4);
 assert.match(control.id,UUID);assert.equal(control.email,`player-a-sms-${run}@example.invalid`);
 for(const actor of ownedFixtures){
  assert.match(actor.id,UUID);assert.equal(actor.phase,'sms-deletion-http');assert.match(actor.kind,/^player-[a-d]$/);assert.notEqual(actor.id,control.id);
  assert.equal(actor.email,`${actor.kind}-sms-deletion-http-${run}@example.invalid`);
  assert.equal((await db.sql(`select email from auth.users where id='${actor.id}' and deleted_at is null`)).trim(),actor.email);
  assert.equal(Number(await db.sql(`select count(*) from ig_sms_consent.events where actor_id='${actor.id}'`)),0);
  assert.ok(actor.token&&actor.refreshToken);
 }
 const request=async(path,token,{method='GET',body}={})=>{
  const response=await fetch(origin+path,{method,headers:{apikey:anon,authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  let data=null;try{data=await response.json();}catch{}
  return {status:response.status,data};
 };
 const consent=async(actor,body,expected)=>{
  const r=await request('/functions/v1/sms-consent',actor.token,{method:'POST',body});
  assert.ok(expected.includes(r.status),'Consent endpoint returned unexpected status');return r;
 };
 const grant=actor=>consent(actor,{action:'grant',requestId:randomUUID(),phone:'+12025550129',affirmative:true,policyVersion:'2026-10-27.v1',expectedRevision:0},[200]);
 const adminDelete=(actor,soft)=>request('/auth/v1/admin/users/'+actor.id,service,{method:'DELETE',body:{should_soft_delete:soft}});
 const state=async id=>JSON.parse(await db.sql(`select json_build_object('actorExists',exists(select 1 from auth.users where id='${id}'),'deleted',exists(select 1 from auth.users where id='${id}' and deleted_at is not null),'events',(select count(*) from ig_sms_consent.events where actor_id='${id}'),'current',(select count(*) from ig_sms_consent.current_state where actor_id='${id}'),'eventHash',(select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'[]')) from ig_sms_consent.events e where actor_id='${id}'),'stateHash',(select md5(coalesce(jsonb_agg(to_jsonb(s))::text,'[]')) from ig_sms_consent.current_state s where actor_id='${id}'))`));
 for(const actor of ownedFixtures){const identity=await request('/auth/v1/user',actor.token);assert.equal(identity.status,200);assert.equal(identity.data.id,actor.id);}
 const controlBefore=await state(control.id),results=[];
 for(const [index,actor] of ownedFixtures.entries()){
  const soft=index%2===0,injectFailure=index>=2;
  const recorded=await grant(actor);assert.equal(recorded.data.deliveryEnabled,false);const grantedState=await state(actor.id);assert.equal(grantedState.events,1);assert.equal(grantedState.current,1);
  let failureEvidence=null;
  if(injectFailure){
   const before=await state(actor.id);
   await db.sql(`create function ig_sms_consent.synthetic_http_failure() returns trigger language plpgsql set search_path='' as $$begin if old.actor_id='${actor.id}'::uuid then raise exception 'SYNTHETIC_CLEANUP_FAILURE';end if;return old;end$$;create trigger synthetic_http_failure before delete on ig_sms_consent.events for each row execute function ig_sms_consent.synthetic_http_failure();`);
   try{
    const failed=await adminDelete(actor,soft);assert.equal(failed.status,500,'Injected cleanup failure must fail actual Auth deletion');
    assert.deepEqual(await state(actor.id),before);
    const stillAuthenticated=await request('/auth/v1/user',actor.token);assert.equal(stillAuthenticated.status,200);
    failureEvidence={authDeleteStatus:failed.status,allRowsAndAuthTransitionRolledBack:true,oldAccessStillValid:true};
   }finally{await db.sql('drop trigger synthetic_http_failure on ig_sms_consent.events;drop function ig_sms_consent.synthetic_http_failure();');}
  }
  const deleted=await adminDelete(actor,soft);assert.equal(deleted.status,200,'Actual local GoTrue deletion must succeed');
  const after=await state(actor.id);assert.equal(after.events,0);assert.equal(after.current,0);assert.equal(after.actorExists,soft);assert.equal(after.deleted,soft);
  const oldAccess=await request('/auth/v1/user',actor.token);assert.ok([401,403,404].includes(oldAccess.status),'Deleted actor old access must not resolve a user');
  const oldRefresh=await request('/auth/v1/token?grant_type=refresh_token',anon,{method:'POST',body:{refresh_token:actor.refreshToken}});assert.ok([400,401,403].includes(oldRefresh.status),'Deleted actor refresh must not create a session');
  const oldConsent=await consent(actor,{action:'status'},[401,403]);
  const oldReplay=await consent(actor,{action:'grant',requestId:recorded.data.requestId,phone:'+12025550129',affirmative:true,policyVersion:'2026-10-27.v1',expectedRevision:0},[401,403]);
  const lookup=await db.result(`begin;set local role service_role;select public.practice_sms_consent_status_v1('${actor.id}');commit;`);assert.notEqual(lookup.code,0);assert.match(lookup.err,/CONSENT_NOT_AUTHORIZED/);
  if(soft){const restore=await db.result(`begin;set local role supabase_auth_admin;update auth.users set deleted_at=null where id='${actor.id}';commit;`);assert.notEqual(restore.code,0);assert.match(restore.err,/CONSENT_AUTH_RESTORATION_UNSUPPORTED/);assert.deepEqual(await state(actor.id),after);}
  results.push({actorId:actor.id,soft,authDeleteStatus:deleted.status,after,oldAccessStatus:oldAccess.status,oldRefreshStatus:oldRefresh.status,oldConsentStatus:oldConsent.status,oldReplayStatus:oldReplay.status,softRestoreDenied:soft,failureEvidence});
  assert.deepEqual(await state(control.id),controlBefore);
 }
 assert.equal((await request('/auth/v1/user',control.token)).status,200);
 return {actualGoTrueAdminHttp:true,actualPreissuedTokenChecks:true,cases:results,unrelatedActorUnchanged:true,allConsentRowsErased:true,phoneTombstones:false,hardUuidRecreationSupported:false,otherApplicationFksVerified:false,hostedReady:false};
}
