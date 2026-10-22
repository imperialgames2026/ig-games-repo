import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
export const headers = {
 'Content-Type':'application/json','Cache-Control':'no-store',
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
};
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function context(req:Request){
 if(req.method!=='POST')throw new HttpError(405,'POST required');
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if((url!=='https://qonqemhljgxlwpghkxhn.supabase.co' && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000'))||!key||!secret)throw new HttpError(503,'Service is not configured');
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)throw new HttpError(401,'Sign in required');
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user||user.is_anonymous)throw new HttpError(401,'Invalid session');
 if(!hasCompletedMfa(user,token))throw new HttpError(403,'Two-step verification required');
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,role]=await Promise.all([db.from('profiles').select('*').eq('id',user.id).single(),db.from('user_roles').select('role').eq('user_id',user.id).single()]);
 if(profile.error||role.error||!profile.data||!['player','tester','admin','superadmin'].includes(role.data?.role)||profile.data.is_excluded)throw new HttpError(403,'Account ineligible');
 const text=await req.text();
 if(text.length>10000)throw new HttpError(413,'Request too large');
 let body;try{body=JSON.parse(text);}catch{throw new HttpError(400,'Invalid JSON');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Invalid request');
 return {db,user,profile:{...profile.data,role:role.data.role},body};
}
export function failure(error:unknown){
 if(error instanceof HttpError)return json({error:error.message},error.status);
 const code=(error as {code?:string})?.code;
 if(code==='P0002')return json({error:'Request not found'},404);
 if(code==='54000')return json({error:'Too many requests'},429);
 if(code==='23505')return json({error:'Request conflicts with an earlier operation'},409);
 if(code==='42501')return json({error:'Operation not permitted'},403);
 if(code==='22023')return json({error:'Invalid operation'},422);
 console.error('Application operation failed',code||'INTERNAL');
 return json({error:'Service could not complete the request'},500);
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try {
  const {db,user,profile,body}=await context(req);
  const allowed=body.action==='list'?['action']:body.action==='cancel'?['action','id']:['action','requestId','kind','asset','network','amount',...(body.kind==='withdrawal'?['destination']:[])];
  if(Object.keys(body).some(key=>!allowed.includes(key)))throw new HttpError(400,'Unexpected request fields');
  if(body.action==='list'){
   const {data,error}=await db.from('payment_preparation_requests').select('id,kind,asset,network,amount,destination,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
   if(error)throw error;
   return json({requests:data,executionEnabled:false});
  }
  if(profile.role!=='player')throw new HttpError(403,'Player account required');
  if(body.action==='cancel'&&uuid(body.id)){
   const {data,error}=await db.rpc('payment_cancel',{p_user:user.id,p_id:body.id});
   if(error)throw error;if(!data)throw new HttpError(404,'Request not found');return json(data);
  }
  if(body.action!=='prepare'||!uuid(body.requestId)||!['deposit','withdrawal'].includes(body.kind)||
    typeof body.amount!=='string'||!/^\d{1,7}(\.\d{1,8})?$/.test(body.amount)||Number(body.amount)<=0||Number(body.amount)>1000000||
    typeof body.asset!=='string'||typeof body.network!=='string'||
    (body.kind==='withdrawal'&&(typeof body.destination!=='string'||body.destination.trim().length<8||body.destination.trim().length>256)))
   throw new HttpError(400,'Invalid payment request');
  const {data,error}=await db.rpc('payment_prepare',{p_user:user.id,p_request:body.requestId,p_kind:body.kind,p_asset:body.asset,
   p_network:body.network,p_amount:body.amount,p_destination:body.kind==='withdrawal'?body.destination.trim():null});
  if(error)throw error;
  return json({request:data,executionEnabled:false,message:'Preparation recorded. No funds have moved; provider connection and validation are required.'});
 }catch(error){return failure(error);}
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
