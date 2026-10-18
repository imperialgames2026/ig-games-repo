import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async (request) => {
 if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 const send=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(request.method!=="POST") return send(405,{error:"method not allowed"});
 const bearer=request.headers.get("Authorization")||"";
 if(!/^Bearer .+$/.test(bearer)) return send(401,{error:"authentication required"});
 try {
  const input=await request.json();
  const action=input?.action;
  if(!["demo_grant","stake","unstake","claim","auto_stake","overview"].includes(action)) return send(400,{error:"invalid action"});
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user) return send(401,{error:"invalid session"});
  if(action==="overview"){
   const [account,entries,settings]=await Promise.all([
    client.from("ign_accounts").select("*").eq("user_id",userData.user.id).maybeSingle(),
    client.from("ign_entries").select("kind,amount,created_at,operation_id").order("created_at",{ascending:false}).limit(30),
    client.from("ign_settings").select("max_supply,hourly_rewards_enabled,onchain_enabled").single()
   ]);
   if(account.error||entries.error||settings.error) return send(500,{error:"unable to read staking data"});
   return send(200,{account:account.data,entries:entries.data,settings:settings.data,simulation:true});
  }
  const operationId=input?.operation_id;
  if(typeof operationId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return send(400,{error:"valid idempotency UUID required"});
  const amount=input?.amount;
  if(["stake","unstake"].includes(action) && (typeof amount!=="number"||!Number.isFinite(amount)||amount<=0||amount>1e9)) return send(400,{error:"positive finite amount required"});
  const {data,error}=await client.rpc("ign_action",{p_action:action,p_amount:amount??null,p_operation_id:operationId,p_auto_stake:typeof input?.auto_stake==="boolean"?input.auto_stake:null});
  if(error) return send(400,{error:error.message});
  return send(200,{...data,simulation:true});
 } catch {return send(400,{error:"invalid JSON request"});}
});