import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
Deno.serve(async (request) => {
 if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 const send=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
 if(request.method!=="POST") return send(405,{error:"method not allowed"});
 const bearer=request.headers.get("Authorization")||"";
 if(!/^Bearer .+$/.test(bearer)) return send(401,{error:"authentication required"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 if(url!=="https://qonqemhljgxlwpghkxhn.supabase.co"||!key) return send(503,{error:"Staging service unavailable"});
 try {
  const raw=await request.text();
  if(raw.length>4096) return send(413,{error:"Request too large"});
  const input=JSON.parse(raw);
  if(!input||typeof input!=="object"||Array.isArray(input)) return send(400,{error:"Invalid request"});
  const action=input?.action;
  if(!["demo_grant","stake","unstake","claim","auto_stake","overview"].includes(action)) return send(400,{error:"invalid action"});
  const fields=action==="overview"?["action"]:action==="auto_stake"?["action","operation_id","auto_stake"]:["stake","unstake"].includes(action)?["action","operation_id","amount"]:["action","operation_id"];
  if(Object.keys(input).some(k=>!fields.includes(k))) return send(400,{error:"Unexpected request fields"});
  if(action==="auto_stake"&&typeof input.auto_stake!=="boolean") return send(400,{error:"Boolean preference required"});
  const client=createClient(url,key,{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user||userData.user.is_anonymous) return send(401,{error:"invalid session"});
 if(!hasCompletedMfa(userData.user,bearer.replace(/^Bearer\s+/i, '')))return send(403,{error:'Two-step verification required',code:'mfa_required'});
  const [profile,role]=await Promise.all([
   client.from("profiles").select("is_excluded").eq("id",userData.user.id).maybeSingle(),
   client.from("user_roles").select("role").eq("user_id",userData.user.id).maybeSingle()
  ]);
  if(profile.error||role.error||profile.data?.is_excluded!==false||!["player","tester","admin","superadmin"].includes(role.data?.role)) return send(403,{error:"Account unavailable"});
  if(action!=="overview"&&role.data.role==="tester") return send(403,{error:"Read-only account"});
  if(action==="overview"){
   const [account,entries,settings]=await Promise.all([
    client.from("ign_accounts").select("*").eq("user_id",userData.user.id).maybeSingle(),
    client.from("ign_entries").select("kind,amount,created_at,operation_id").eq("user_id",userData.user.id).order("created_at",{ascending:false}).limit(30),
    client.from("ign_settings").select("max_supply,hourly_rewards_enabled,onchain_enabled,target_house_edge_bps,wagering_reward_bps_of_edge,staking_reward_bps_of_edge,hourly_cycle_minutes,early_unstake_penalty_bps,penalty_free_after_hours,wagering_rewards_enabled,early_unstake_penalty_enabled").single()
   ]);
   if(account.error||entries.error||settings.error) return send(500,{error:"unable to read staking data"});
   return send(200,{account:account.data,entries:entries.data,settings:settings.data,simulation:true});
  }
  const operationId=input?.operation_id;
  if(typeof operationId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return send(400,{error:"valid idempotency UUID required"});
  const amount=input?.amount;
  if(["stake","unstake"].includes(action) && (typeof amount!=="number"||!Number.isFinite(amount)||amount<=0||amount>1e9)) return send(400,{error:"positive finite amount required"});
  const {data,error}=await client.rpc("ign_action",{p_action:action,p_amount:amount??null,p_operation_id:operationId,p_auto_stake:typeof input?.auto_stake==="boolean"?input.auto_stake:null});
  if(error) return send(error.code==="42501"?403:400,{error:error.message});
  return send(200,{...data,simulation:true});
 } catch {return send(400,{error:"invalid JSON request"});}
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
