import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version'};
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields:Record<string,string[]>={current:['action','game'],commit:['action','game','roundId','options'],start:['action','game','roundId','requestId','version','clientSeed'],move:['action','game','roundId','requestId','version','choice'],finish:['action','game','roundId','requestId','version']};
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if((url!=='https://qonqemhljgxlwpghkxhn.supabase.co' && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000'))||!key||!secret)return reply(503,{error:'Staging service unavailable'});
 const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return reply(401,{error:'Sign in required'});
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);if(authError||!user||user.is_anonymous)return reply(401,{error:'Registered account required'});
 let body:Record<string,unknown>;
 try{const raw=await request.text();if(raw.length>2048)return reply(413,{error:'Request too large'});body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid JSON'});}
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string'||!Object.hasOwn(fields,body.action)||!['darts','dicezone','hilo','towers'].includes(String(body.game)))return reply(400,{error:'Invalid action or game'});
 const allowed=fields[body.action];if(allowed.some(k=>!Object.hasOwn(body,k))||Object.keys(body).some(k=>!allowed.includes(k)))return reply(400,{error:'Unexpected or missing fields'});
 for(const name of ['roundId','requestId'])if(Object.hasOwn(body,name)&&(typeof body[name]!=='string'||!uuid.test(String(body[name]))))return reply(400,{error:'Invalid request ID'});
 if(Object.hasOwn(body,'version')&&(!Number.isInteger(body.version)||Number(body.version)<0||Number(body.version)>51))return reply(400,{error:'Invalid version'});
 if(body.action==='commit'&&(!body.options||typeof body.options!=='object'||Array.isArray(body.options)))return reply(400,{error:'Invalid options'});
 if(body.action==='start'&&(typeof body.clientSeed!=='string'||!body.clientSeed.length||body.clientSeed.length>128))return reply(400,{error:'Invalid client seed'});
 if(body.action==='move'&&(typeof body.choice!=='string'||!(body.game==='towers'?['0','1','2']:body.game==='hilo'?['higherOrSame','lowerOrSame','same']:[]).includes(body.choice)))return reply(400,{error:'Invalid move'});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc('ig_final_practice',{p_actor:user.id,p_action:body.action,p_game:body.game,p_round:body.roundId??null,p_request:body.requestId??null,p_version:body.version??null,p_options:body.options??null,p_client:body.clientSeed??null,p_choice:body.choice??null});
 if(error){const status=({'42501':403,'23505':409,'22023':422,'P0002':404,'54000':429} as Record<string,number>)[error.code]||503;return reply(status,{error:status===409?'Round changed or retry conflicts. Refresh the round.':status===403?'Account ineligible':status===422?'Invalid options or move':'Round unavailable. Retry the same request.'});}
 return reply(200,{state:data});
});
