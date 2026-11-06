import {createHostedPvpService,failure} from './service.mjs';
const REF='qonqemhljgxlwpghkxhn';
const cors={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version'};
const respond=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
const codes={ROOM_NOT_FOUND:404,ACCOUNT_NOT_ELIGIBLE:403,ROOM_MEMBERSHIP_REQUIRED:403,READ_ONLY_ROLE:403,OWNER_REQUIRED:403,REQUEST_PAYLOAD_CONFLICT:409,ROOM_VERSION_CONFLICT:409,ROOM_LIMIT_REACHED:429,ACTION_LIMIT_REACHED:429,INVALID_REQUEST:400};
export function createPvpHandler({env,createClient}){return async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return respond(405,{error:'POST_REQUIRED',financialExecutionEnabled:false});
 try{
  const url=env('SUPABASE_URL')||'',pub=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY')||'',secret=env('SUPABASE_SERVICE_ROLE_KEY')||'';
  if((url!==`https://${REF}.supabase.co`&&!(env('IG_LOCAL_PRACTICE')==='true'&&url==='http://kong:8000'))||!pub||!secret)throw failure('PVP_UNAVAILABLE',503);
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)throw failure('UNAUTHORIZED',401);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw failure('JSON_REQUIRED',415);
  const reader=request.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();if(!reader)throw failure('INVALID_REQUEST');
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw failure('REQUEST_TOO_LARGE',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  let input;try{input=JSON.parse(raw);}catch{throw failure('INVALID_JSON');}
  const auth=createClient(url,pub,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error){const code=Object.keys(codes).find(x=>error.message.includes(x));throw failure(code||'PVP_UNAVAILABLE',code?codes[code]:503);}return data;}
  const service=createHostedPvpService({
   resolveActor:async()=>{const {data,error}=await auth.auth.getUser(token);const user=data?.user;if(error||!user||user.is_anonymous||!user.email_confirmed_at)throw failure('UNAUTHORIZED',401);
    const [p,r]=await Promise.all([auth.from('profiles').select('id,is_excluded').eq('id',user.id).maybeSingle(),auth.from('user_roles').select('role').eq('user_id',user.id).maybeSingle()]);if(p.error||r.error||p.data?.id!==user.id)throw failure('ACCOUNT_NOT_ELIGIBLE',403);return {...p.data,role:r.data?.role};},
   store:{read:(actor,room,request)=>rpc('ig_pvp_review_read',{p_actor:actor,p_room:room,p_request:request}),commit:({actor,request,payload,room,expected})=>rpc('ig_pvp_review_commit',{p_actor:actor,p_request:request,p_payload:payload,p_room:room,p_expected:expected})},
  });return respond(200,await service.execute(token,input));
 }catch(error){return respond(error.status||503,{error:error.code||'PVP_UNAVAILABLE',financialExecutionEnabled:false});}
};}
