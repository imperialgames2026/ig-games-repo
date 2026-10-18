import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const STAGING="qonqemhljgxlwpghkxhn";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type, x-client-info"};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return reply(405,{error:"POST only"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(url!=="https://"+STAGING+".supabase.co"||!key||!secret)return reply(503,{error:"Staging-only configuration service"});
 const token=request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return reply(401,{error:"Sign-in required"});
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return reply(401,{error:"Invalid session"});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:role,error:roleError}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
 const {data:profile,error:profileError}=await db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle();
 if(roleError||profileError||role?.role!=="superadmin"||profile?.is_excluded!==false)return reply(403,{error:"Superadmin required"});
 const raw=await request.text().catch(()=>"");
 if(raw.length>16000)return reply(413,{error:"Request too large"});
 let input:Record<string,unknown>;try{input=JSON.parse(raw)}catch{return reply(400,{error:"Invalid JSON"})}
 if(!input||typeof input!=="object"||Array.isArray(input))return reply(400,{error:"Invalid request"});
 if(input.action==="list"){
  const {data,error}=await db.from("ig_poker_tournament_presets").select("*").order("created_at",{ascending:false}).limit(100);
  return error?reply(500,{error:"Cannot load presets"}):reply(200,{presets:data,practiceOnly:true});
 }
 if(input.action!=="save"||!input.config||typeof input.config!=="object")return reply(400,{error:"Invalid action"});
 if(input.id!==undefined&&(typeof input.id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.id)))return reply(400,{error:"Invalid preset ID"});
 const {data,error}=await db.rpc("ig_poker_tournament_preset_save",{p_actor:user.id,p_config:input.config,p_id:input.id??null});
 if(error)return reply(400,{error:error.message.slice(0,200)});
 return reply(200,{preset:data});
});
