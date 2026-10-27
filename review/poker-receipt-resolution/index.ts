// REVIEW ONLY: no manifest entry, deployed function, production import or UI wire.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'POST required'},405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return json({error:'Authentication required'},401);
 const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 // This candidate cannot silently target an arbitrary or production project.
 if(url!=='https://qonqemhljgxlwpghkxhn.supabase.co'&&!(Deno.env.get('IG_LOCAL_PRACTICE')==='true'&&url==='http://kong:8000'))return json({error:'Practice resolution unavailable'},503);
 if(!anon||!service)return json({error:'Practice resolution unavailable'},503);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user||user.is_anonymous)return json({error:'Invalid session'},401);
 let body:Record<string,unknown>;
 try{const text=await req.text();if(text.length>2048)return json({error:'Payload too large'},413);body=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}
 const fields=['tableId','actionId','version','move','amount'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==fields.length||fields.some(k=>!Object.hasOwn(body,k))||Object.keys(body).some(k=>!fields.includes(k))||
 typeof body.tableId!=='string'||!UUID.test(body.tableId)||typeof body.actionId!=='string'||!UUID.test(body.actionId)||
 !Number.isSafeInteger(body.version)||Number(body.version)<0||Number(body.version)>=Number.MAX_SAFE_INTEGER||
 !['fold','check','call','allin','bet','raise'].includes(String(body.move))||typeof body.move!=='string'||!Number.isSafeInteger(body.amount)||Number(body.amount)<0)return json({error:'Invalid resolution request'},400);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await db.rpc('poker_receipt_resolution_v1',{p_actor:user.id,p_table:body.tableId,p_action_id:body.actionId,p_version:body.version,p_move:body.move,p_amount:body.amount});
 if(result.error)return json({error:result.error.code==='42501'?'Resolution not authorized':'Resolution unavailable'},result.error.code==='42501'?403:503);
 if(!result.data)return json({error:'Resolution unavailable'},503);
 return json(result.data);
});
