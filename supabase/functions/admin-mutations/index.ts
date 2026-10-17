import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return reply(503,{error:'Service unavailable'});
 const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return reply(401,{error:'Authentication required'});
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user)return reply(401,{error:'Invalid session'});
 let p:Record<string,unknown>;
 try{p=await req.json()}catch{return reply(400,{error:'Invalid JSON'})}
 if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.target_id!=='string'||!uuid.test(p.target_id)||typeof p.request_id!=='string'||!uuid.test(p.request_id)||typeof p.reason!=='string'||p.reason.trim().length<8||p.reason.length>2000||!['exclude','restore','wallet_adjustment'].includes(String(p.action)))return reply(400,{error:'Invalid request'});
 if(p.action==='wallet_adjustment'&&(p.currency!=='IGT'||typeof p.delta!=='number'||!Number.isFinite(p.delta)||p.delta===0||Math.abs(p.delta)>10000||Math.round(p.delta*1e6)!==p.delta*1e6))return reply(400,{error:'Invalid IGT adjustment'});
 if(p.action!=='wallet_adjustment'&&(p.currency!==undefined||p.delta!==undefined))return reply(400,{error:'Unexpected adjustment'});
 const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:actor,error:profileError}=await service.from('profiles').select('role,is_excluded').eq('id',user.id).single();
 if(profileError||!actor||actor.is_excluded||!['admin','superadmin'].includes(actor.role)||p.action==='wallet_adjustment'&&actor.role!=='superadmin')return reply(403,{error:'Not authorized'});
 const {data,error}=await service.rpc('admin_mutation_server',{p_actor:user.id,p_target:p.target_id,p_action:p.action,p_reason:p.reason,p_request:p.request_id,p_currency:p.action==='wallet_adjustment'?'IGT':null,p_delta:p.action==='wallet_adjustment'?p.delta:null});
 if(error){if(error.code==='42501')return reply(403,{error:'Not authorized'});if(error.code==='23505')return reply(409,{error:'Idempotency conflict'});if(error.code==='22023')return reply(422,{error:'Invalid request'});console.error('admin mutation failed',error.code);return reply(500,{error:'Operation failed'})}
 return reply(200,{result:data});
});
