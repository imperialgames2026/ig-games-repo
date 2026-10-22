import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const REF="qonqemhljgxlwpghkxhn";
const cors={
 "Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:cors});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accepted=new Set(["state","join","leave","claim","bet","deal","hit","stand","resolve","tick"]);

Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if((url!=="https://"+REF+".supabase.co" && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000'))||!key||!service)
   return json({error:"Staging-only Blackjack unavailable"},503);
 const token=request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return json({error:"Login required"},401);
 const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await auth.auth.getUser(token);
 if(authErr||!user||user.is_anonymous)return json({error:"Invalid session"},401);
 if(!hasCompletedMfa(user,token))return json({error:'Two-step verification required',code:'mfa_required'},403);
 let input:Record<string,unknown>;
 try{const body=await request.text();if(body.length>2048)return json({error:"Payload too large"},413);input=JSON.parse(body);}
 catch{return json({error:"Invalid JSON"},400);}
 if(!input||typeof input!=="object"||Array.isArray(input)||!accepted.has(String(input.action)))
   return json({error:"Invalid action"},400);
 const {action,requestId,units,target,expectedRound}=input;
 const fields=action==="bet" ? ["action","requestId","units","target"] :
   ["deal","hit","stand","resolve"].includes(String(action)) ? ["action","requestId","expectedRound"] : ["action"];
 if(Object.keys(input).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(input,k)))
   return json({error:"Unexpected fields"},400);
 if(["bet","deal","hit","stand","resolve"].includes(String(action))&&
    (typeof requestId!=="string"||!UUID.test(requestId)))
   return json({error:"Request ID required"},400);
 if(action==="bet"&&(!Number.isSafeInteger(units)||Number(units)<1||Number(units)>100||
    !["main","perfect_pairs"].includes(String(target))))
   return json({error:"Invalid practice bet"},400);
 if(["deal","hit","stand","resolve"].includes(String(action))&&
   (!Number.isSafeInteger(expectedRound)||Number(expectedRound)<1))
   return json({error:"Invalid round number"},400);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 if(action==="state") {
   const {data,error}=await db.rpc("ig_bj_state",{p_actor:user.id});
   if(error)return json({error:error.code==="42501"?"Access denied":"Table unavailable"},error.code==="42501"?403:503);
   return json({state:data});
 }
 const args = action==="tick" ? {p_actor:user.id} : {
   p_actor:user.id,p_action:action,p_request:requestId??null,p_units:units??null,
   p_target:target??null,p_expected_round:expectedRound??null
 };
 const {data,error}=await db.rpc(action==="tick"?"ig_bj_timeout":"ig_bj_action",args);
 if(error){
   if(error.code==="42501")return json({error:"Action is not permitted"},403);
   if(error.code==="23505")return json({error:"Stale action or request replay conflict; refresh"},409);
   if(error.code==="22023")return json({error:"Betting closed, invalid action, or insufficient practice chips"},422);
   console.error("practice blackjack",error.code);
   return json({error:"Blackjack server unavailable; refresh before retrying"},503);
 }
 const state=await db.rpc("ig_bj_state",{p_actor:user.id});
 if(state.error)return json({error:"Action accepted but state refresh failed; refresh before retrying"},503);
 return json({action:data,state:state.data});
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
