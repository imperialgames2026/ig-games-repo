import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {validateInput,KINDS} from './validation.js';
import {Image} from 'npm:imagescript@3.3.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import {validateImageFile} from './image-file.js';
import {issueUpload,reviewQueue,purgeExpired,redactReviewerDetail} from './privacy.js';
const BUCKET='ig-kyc-evidence';
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function body(request:Request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('Request too large');}chunks.push(value);}
 const joined=new Uint8Array(size);let at=0;for(const part of chunks){joined.set(part,at);at+=part.length;}
 return validateInput(JSON.parse(new TextDecoder().decode(joined)));
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if((url!=='https://qonqemhljgxlwpghkxhn.supabase.co'&&!(url==='http://kong:8000'&&Deno.env.get('IG_LOCAL_PRACTICE')==='true'))||!key||!secret)return reply(503,{error:'Identity service unavailable'});
 let input;try{input=await body(request);}catch{return reply(400,{error:'Invalid or incomplete identity request'});}
 const publicStorageUrl=(signed:string)=>url==='http://kong:8000'?signed.replace('http://kong:8000/','http://127.0.0.1:54321/'):signed;
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 let actor=null;const worker=input.action.startsWith('worker_');
 if(worker){
  const token=request.headers.get('x-kyc-worker-token')||'';if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Worker authentication required'});
  input.token_hash=await sha(new TextEncoder().encode(token));
 }else{
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return reply(401,{error:'Sign in required'});
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user||user.is_anonymous)return reply(401,{error:'Registered account required'});
  // Decoded AAL is read only after Auth has verified this exact bearer token.
  if(!hasCompletedMfa(user,token))return reply(403,{error:'Two-step verification required',code:'mfa_required'});
  actor=user.id;
 }
 async function rpc(action:string,payload:any=input){
  const {data,error}=await db.rpc(['worker_expired','worker_attempt','worker_purged'].includes(action)?'ig_kyc_retention_action_v2':'ig_kyc_action',{p_actor:actor,p_action:action,p_payload:payload});
  if(error)throw Object.assign(Error('Request rejected'),{code:error.code});return data;
 }
 const path=(s:any,kind:string)=>`${s.user_id}/${s.id}/${kind}`;
 try{
  if(input.action==='upload'){
   return reply(200,await issueUpload(rpc,db.storage.from(BUCKET),input.kind));
  }
  if(input.action==='submit'){
   const s=await rpc('upload');const evidence:Record<string,unknown>={};
   for(const kind of s.document_type==='passport'?['id_front','selfie']:KINDS){
    const name=path(s,kind);const {data,error}=await db.storage.from(BUCKET).download(name);
    if(error||!data||data.size>8388608)return reply(422,{error:'Upload each required image, up to 8 MiB'});
    const bytes=new Uint8Array(await data.arrayBuffer());let info;try{info=await validateImageFile(bytes,Image.decode.bind(Image),jpeg.decode);}catch{return reply(422,{error:'An image is invalid or exceeds 4 megapixels. Cancel this draft and upload valid resized images.'});}
    if(data.type!==info.mime)return reply(422,{error:'Image type does not match the file'});
    evidence[kind]={path:name,sha256:await sha(bytes),...info};
   }
   return reply(200,{result:await rpc('submit',{...input,evidence})});
  }
  if(input.action==='evidence'){
   const e=await rpc('evidence');const {data,error}=await db.storage.from(BUCKET).createSignedUrl(e.path,60);
   if(error)throw Error('Storage unavailable');return reply(200,{url:publicStorageUrl(data.signedUrl),expires_in:60,sha256:e.sha256});
  }
  if(input.action==='worker_claim'){
   const job=await rpc('worker_claim');if(!job)return reply(200,{job:null});
   const images:Record<string,unknown>={};
   for(const kind of ['id_front','selfie']){
    const e=job.evidence[kind];const {data,error}=await db.storage.from(BUCKET).createSignedUrl(e.path,120);if(error)throw Error('Storage unavailable');images[kind]={url:publicStorageUrl(data.signedUrl),sha256:e.sha256};
   }
   return reply(200,{job:{id:job.id,lease:job.lease,images}});
  }
  if(input.action==='worker_purged'){
   return reply(200,{retention_protocol:'reconcile-v2',result:await purgeExpired((action,extra)=>rpc(action,{...input,...extra}),db,BUCKET,input.id)});
  }
  if(input.action==='queue'&&(input.status!==undefined||input.limit!==undefined||input.cursor!==undefined))return reply(200,{result:await reviewQueue(rpc,db,input)});
  let result=await rpc(input.action);
  if(input.action==='detail'){
   result=redactReviewerDetail(result);
   // Storage paths and lease credentials never appear in the browser response.
   if(new Date(result.expires_at).getTime()<=Date.now()){result.full_name='Expired identity details';result.birth_date=null;result.face_result=null;result.evidence={};}
   result.evidence=Object.fromEntries(Object.entries(result.evidence||{}).map(([k,v]:[string,any])=>[k,{sha256:v.sha256,mime:v.mime,size:v.size,width:v.width,height:v.height}]));
  }
  if(input.action==='worker_expired')return reply(200,{retention_protocol:'reconcile-v2',result:result.map((x:any)=>({id:x.id}))});
  return reply(200,{result});
 }catch(error){
  const status=({'42501':403,'P0002':404,'23505':409,'40001':409,'22023':422,'23514':422,'23502':422,'22007':422,'22008':422,'54000':429} as any)[error.code]||503;
  return reply(status,{error:status===409?'This submission changed or another submission is open. Refresh and try again.':status===403?'This account cannot perform this identity action.':status===429?'Submission limit reached. Try again tomorrow.':status===422?'Check the submitted details and required review checks.':'Identity request unavailable. Please try again.'});
 }
});

// BEGIN GENERATED MFA GUARD
// SERVER ONLY: call exclusively AFTER Auth getUser validates this EXACT token.
// Never use decoded claims as standalone authentication. Auth supplies factors;
// user_metadata and request bodies cannot choose whether MFA is required.
function hasCompletedMfa(user, verifiedAccessToken) {
  if (!user?.id) return false;
  if (!user.factors?.some(factor => factor.status === 'verified')) return true;
  try {
    const part = verifiedAccessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return claims.sub === user.id && claims.aal === 'aal2';
  } catch { return false; }
}
// END GENERATED MFA GUARD
