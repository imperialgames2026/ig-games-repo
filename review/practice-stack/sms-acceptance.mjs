import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {createHash} from 'node:crypto';import {resolve} from 'node:path';import {projectRoot} from './source-root.mjs';
import {SMS_CONSENT_VERSION,SMS_CONSENT_DISCLOSURE} from '../../lib/smsConsentPolicy.mjs';
export async function smsAcceptance({run,users,call,db,browser,record,anon,origin}){
 const [a,b]=users.filter(u=>u.kind.startsWith('player-')),excluded=users.find(u=>u.kind==='excluded');
 const consent=(u,body,status=200)=>call(u,'sms-consent',body,status),grant=(revision=0)=>({action:'grant',requestId:randomUUID(),phone:'+12025550123',affirmative:true,policyVersion:SMS_CONSENT_VERSION,expectedRevision:revision});
 const count=async actor=>Number(await db.sql(`select count(*) from ig_sms_consent.events where actor_id='${actor}'`));
 assert.equal((await consent(a,{action:'status'})).revision,0);
 const first=grant(),saved=await consent(a,first);assert.equal(saved.status,'granted');assert.equal(saved.revision,1);assert.equal(saved.deliveryEnabled,false);
 const retry=await consent(a,first);assert.equal(retry.eventId,saved.eventId);assert.equal(await count(a.id),1);
 await consent(a,{...first,phone:'+12025550124'},409);await consent(a,{...grant(1),actorId:b.id},400);assert.equal((await consent(b,{action:'status'})).status,'not_recorded');
 await consent(null,{action:'status'},401);await consent({...a,token:a.token.slice(0,-8)+'invalidx'},{action:'status'},401);
 await consent(excluded,grant(),403);assert.equal(await count(excluded.id),0);assert.equal((await consent(excluded,{action:'status'})).status,'not_recorded');for(const action of ['revoke','change_number'])assert.equal((await consent(excluded,{action,requestId:randomUUID(),policyVersion:'old'})).status,'revoked');
 for(const action of ['send','request_code','verify'])assert.equal((await consent(a,{action},503)).deliveryEnabled,false);
 await consent(a,{...grant(1),policyVersion:'old'},400);
 const revoke={action:'revoke',requestId:randomUUID(),policyVersion:'old'};assert.equal((await consent(a,revoke)).status,'revoked');assert.equal((await consent(a,first)).status,'revoked');assert.equal(await count(a.id),2);
 const next=grant(2);await consent(a,next);const changed=await consent(a,{action:'change_number',requestId:randomUUID()});assert.equal(changed.status,'revoked');assert.equal(changed.revision,4);
 const denied=await fetch(origin+'/rest/v1/rpc/practice_sms_consent_status_v1',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+a.token,'content-type':'application/json'},body:JSON.stringify({p_actor:b.id})});assert.ok([401,403,404].includes(denied.status));
 const beforeFailure=await count(a.id);
 await db.sql(`create function ig_sms_consent.synthetic_fail_current() returns trigger language plpgsql set search_path='' as $$begin if new.actor_id='${a.id}'::uuid then raise exception 'synthetic atomic failure';end if;return new;end$$;create trigger synthetic_fail_current before insert or update on ig_sms_consent.current_state for each row execute function ig_sms_consent.synthetic_fail_current();`);
 try{await consent(a,grant(4),503);assert.equal(await count(a.id),beforeFailure);}finally{await db.sql('drop trigger synthetic_fail_current on ig_sms_consent.current_state;drop function ig_sms_consent.synthetic_fail_current();');}
 const sqlCall=(id,action,phone,revision)=>`select public.practice_sms_consent_v1('${b.id}','${id}','${action}',${phone===null?'null':"'"+phone+"'"},'${SMS_CONSENT_VERSION}',${revision===null?'null':revision});`;
 const delayed=grant(),clearId=randomUUID();const race=await db.race('late-first-grant-versus-withdrawal',[
 `set local role service_role;select pg_sleep(0.35);${sqlCall(delayed.requestId,'grant',delayed.phone,0)}`,
 `set local role service_role;${sqlCall(clearId,'revoke',null,null)}`],1);
 assert.equal(race.sessions[0].ok,false);assert.match(race.sessions[0].error,/CONSENT_REVISION_CONFLICT/);assert.equal(race.sessions[1].ok,true);
 assert.equal((await consent(b,{action:'status'})).status,'revoked');assert.equal((await consent(b,{action:'status'})).revision,1);assert.equal(await count(b.id),1);
 await consent(b,delayed,409);assert.equal(await count(b.id),1);
 const duplicate=grant(1),before=await count(b.id);await consent(b,duplicate);await consent(b,duplicate);assert.equal(await count(b.id),before+1);
 const facts=JSON.parse(await db.sql(`select json_build_object('events',count(*),'methodValid',bool_and(collection_method='authenticated_account_form'),'versionValid',bool_and(policy_version='${SMS_CONSENT_VERSION}'),'disclosureHashValid',bool_and(disclosure_sha256='${createHash('sha256').update(SMS_CONSENT_DISCLOSURE).digest('hex')}')) from ig_sms_consent.events`));assert.equal(facts.methodValid,true);assert.equal(facts.versionValid,true);assert.equal(facts.disclosureHashValid,true);
 record('sms-auth-http',{actualAuth:true,actualEdge:true,actualPostgrest:true,actorIsolation:true,serverReceiptRetry:true,withdrawal:true,numberInvalidation:true,lateFirstGrantRejected:true,race,records:facts,deliveryEnabled:false,noTwilio:true});
 const contexts=[];const browserFacts=[];
 try{
 for(const optIn of [false,true]){
  const context=await browser.newContext();contexts.push(context);await context.route('**/*',r=>['http://127.0.0.1:4173',origin].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
  const page=await context.newPage(),email=`signup-${optIn?'sms':'email'}-${run}@example.invalid`,password=randomBytes(32).toString('base64url');let actualSignup=0,signupActor=null;let signupBody=null;const signupResults=[],pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message.slice(0,180)));

  await page.goto('http://127.0.0.1:4173/login?mode=signup');assert.equal(await page.getByRole('checkbox').isChecked(),false);
  await page.getByLabel('Full name',{exact:true}).fill('Synthetic local consent');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);
  if(optIn){await page.getByLabel('Mobile number (optional)',{exact:true}).fill('+12025550125');await page.getByRole('checkbox').check();}
  const signupResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/v1/signup'&&r.request().method()==='POST');await page.getByRole('button',{name:'Create account',exact:true}).click();const signupResult=await signupResponse;const signupData=await signupResult.json();signupResults.push({status:signupResult.status(),code:signupData.code??null});assert.equal(signupResult.status(),200,'Actual signup response success');signupBody=signupResult.request().postDataJSON();signupActor=signupData.user?.id;actualSignup=1;try{await page.waitForURL('http://127.0.0.1:4173/');}catch(error){record('sms-signup-diagnostic',{optionalConsent:optIn,path:new URL(page.url()).pathname,signupResults,pageErrors,headings:await page.locator('h1').allTextContents(),alerts:await page.getByRole('alert').allTextContents(),statuses:await page.getByRole('status').allTextContents(),liveEnrollmentProof:false});throw error;}assert.equal(actualSignup,1);assert.match(signupActor,/^[a-f0-9-]{36}$/i);assert.deepEqual(signupBody.data,{full_name:'Synthetic local consent'});const metadata=JSON.parse(await db.sql(`select raw_user_meta_data::text from auth.users where id='${signupActor}'`));for(const key of ['phone','smsConsent','sms_consent'])assert.equal(Object.hasOwn(metadata,key),false);assert.notEqual(metadata.phone_verified,true);
  await page.goto('http://127.0.0.1:4173/SmsConsent');await page.getByText('Recorded preference: '+(optIn?'granted':'not_recorded')).waitFor();
  if(optIn){await page.getByRole('button',{name:'Withdraw consent',exact:true}).click();await page.getByText('Recorded preference: revoked').waitFor();await page.reload();await page.getByText('Recorded preference: revoked').waitFor();
   let loseOnce=true,acceptedReceipt=null,retryReceipt=null;const attempts=[];const beforeLost=await count(signupActor);await page.route(origin+'/functions/v1/sms-consent',async route=>{const body=route.request().postDataJSON();if(body.action==='grant'){attempts.push(body);if(loseOnce){loseOnce=false;const response=await route.fetch();assert.equal(response.status(),200);acceptedReceipt=await response.json();return route.abort('failed');}const response=await route.fetch();assert.equal(response.status(),200);retryReceipt=await response.json();return route.fulfill({response});}return route.continue();});
   await page.getByLabel('Mobile number (optional)',{exact:true}).fill('+12025550125');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Save optional consent / retry',exact:true}).click();await page.getByText(/Consent was not confirmed/).waitFor();await page.getByRole('button',{name:'Save optional consent / retry',exact:true}).click();await page.getByText('Recorded preference: granted').waitFor();assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);assert.equal(acceptedReceipt.eventId,retryReceipt.eventId);assert.equal(await count(signupActor),beforeLost+1);
   await page.evaluate(()=>{const p=document.createElement('p');p.textContent='LOCAL SYNTHETIC TEST — NOT LIVE ENROLLMENT PROOF';p.style.cssText='position:fixed;top:0;left:0;background:#fff;color:#000;z-index:99999;padding:8px';document.body.appendChild(p);});await page.screenshot({path:resolve(projectRoot,'../approved-runtime-evidence',run,'sms-local-synthetic.png'),fullPage:true});
  }
  browserFacts.push({optionalConsent:optIn,actualSignup:true,actualConsentEndpoint:true,withdrawalReload:optIn,lostResponseExactRetry:optIn});await context.close();contexts.pop();
 }
 }finally{await Promise.allSettled(contexts.map(c=>c.close()));}
 record('sms-browser',{journeys:browserFacts,backend:'actual isolated Auth/REST/Edge/PostgreSQL',failureInjection:'one genuine server-accepted grant response deliberately dropped; exact retry',deliveryEnabled:false,liveEnrollmentProof:false});
 return {slice:'sms',actualAuthHttp:true,independentSessionOrdering:true,syntheticBrowser:true,noSmsSent:true,releaseReady:false,remaining:['hosted rollout','Twilio eligibility and configuration','canonical verified phone','retention review']};
}
