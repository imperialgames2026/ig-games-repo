// REVIEW CANDIDATE ONLY. Not in deployment manifest. No SMS provider or send path.
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {consentRequest,SMS_CONSENT_VERSION} from '../../lib/smsConsentPolicy.mjs';
const origins=new Set(['https://imperialgaming.llc','https://www.imperialgaming.llc']);
if(Deno.env.get('IG_LOCAL_PRACTICE')==='true'&&Deno.env.get('SUPABASE_URL')==='http://kong:8000')origins.add('http://127.0.0.1:4173');
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin');const cors={'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://imperialgaming.llc','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const send=(data,status=200)=>Response.json(data,{status,headers:cors});
 if(origin&&!origins.has(origin))return send({error:'Forbidden'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return send({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return send({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_ANON_KEY')||'';
  const caller=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data,error}=await caller.auth.getUser();const user=data?.user;
  if(error||!user||user.is_anonymous||!user.email_confirmed_at)return send({error:'Confirmed account required'},401);
  const raw=await req.text();if(raw.length>2048)return send({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return send({error:'Invalid request'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return send({error:'Invalid request'},400);
  // No delivery function is invoked, even if a caller supplies consent or verification flags.
  if(['send','request_code','verify'].includes(body.action))return send({error:'SMS_DELIVERY_DISABLED',deliveryEnabled:false},503);
  let parsed;
  if(body.action==='status'){if(Object.keys(body).length!==1)return send({error:'Invalid request'},400);}
  else{try{parsed=consentRequest(body);}catch{return send({error:'Invalid consent request'},400);}}
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false}});
  const result=await service.rpc(body.action==='status'?'practice_sms_consent_status_v1':'practice_sms_consent_v1',body.action==='status'?{p_actor:user.id}:{p_actor:user.id,p_request_id:parsed.requestId,p_action:parsed.action,p_phone:parsed.phone,p_policy_version:SMS_CONSENT_VERSION,p_expected_revision:parsed.expectedRevision});
  if(result.error){const code=result.error.code;return send({error:code==='23505'?'CONSENT_REQUEST_CONFLICT':code==='42501'?'CONSENT_NOT_AUTHORIZED':'CONSENT_UNAVAILABLE',deliveryEnabled:false},code==='23505'?409:code==='42501'?403:503);}
  if(!result.data||result.data.deliveryEnabled!==false)return send({error:'CONSENT_UNAVAILABLE',deliveryEnabled:false},503);
  return send(result.data);
 }catch{return send({error:'CONSENT_UNAVAILABLE',deliveryEnabled:false},503);}
});
