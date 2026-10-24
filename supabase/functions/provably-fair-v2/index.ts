import { createClient } from "npm:@supabase/supabase-js@2";
const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const HEADERS={"content-type":"application/json","cache-control":"no-store",
 "access-control-allow-origin":"*",
 "access-control-allow-headers":"authorization, apikey, content-type, x-client-info, x-supabase-api-version",
 "access-control-allow-methods":"POST, OPTIONS"};
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:HEADERS});
async function outcome(seed:string,client:string,nonce:number,game:string){
 const key=await crypto.subtle.importKey("raw",enc.encode(seed),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const numbers:number[]=[];let counter=0;
 while(numbers.length<(game==="dice"?2:1)){
  const d=new DataView(await crypto.subtle.sign("HMAC",key,enc.encode(`${client}:${nonce}:${counter++}`)));
  for(let i=0;i<=28&&numbers.length<(game==="dice"?2:1);i+=4){const n=d.getUint32(i,false);if(n<4294967292)numbers.push(n%6+1);}
 }
 return game==="dice"?{dice:numbers,sum:numbers[0]+numbers[1]}:game==="coin"?{coin:numbers[0]%2?"heads":"tails"}:{number:numbers[0]};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=="POST")return respond({error:"POST required"},405);
 const token=req.headers.get("authorization")?.replace(/^Bearer /i,"");
 if(!token)return respond({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!pub||!secret)return respond({error:"Backend configuration missing"},503);
 const auth=createClient(url,pub,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return respond({error:"Unauthorized"},401);
 if(!hasCompletedMfa(user,token))return respond({error:'Two-step verification required',code:'mfa_required'},403);
 const db=createClient(url,secret,{auth:{persistSession:false}});
 let input:Record<string,unknown>;try{input=await req.json();}catch{return respond({error:"Invalid JSON"},400);}
 const {data:eligibility,error:eligibilityError}=await db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle();
 if(eligibilityError || !eligibility || eligibility.is_excluded !== false)return respond({error:"Account ineligible for gameplay"},403);
 const {data:roleRow,error:roleCheckError}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
 if(roleCheckError)return respond({error:"Cannot check account permission"},503);
 if(!roleRow || !["player","admin","superadmin","tester"].includes(roleRow.role))return respond({error:"Account role not authorized"},403);
 if(input.action==="history"){
  if(Object.keys(input).length!==1)return respond({error:"Invalid history request"},400);
  // Never expose seeds until a round has already been revealed.
  const {data,error}=await db.from("fair_seed_commitments")
    .select("id,game,server_seed,server_seed_hash,client_seed,nonce,outcome,created_at,revealed_at")
    .eq("user_id",user.id).eq("status","revealed")
    .order("revealed_at",{ascending:false}).limit(50);
  if(error)return respond({error:"Round history unavailable"},503);
  return respond({practiceOnly:true,algorithm:"hmac-sha256-v2",
    rounds:(data??[]).map(r=>({
      id:r.id,game:r.game,serverSeed:r.server_seed,serverSeedHash:r.server_seed_hash,
      clientSeed:r.client_seed,nonce:r.nonce,outcome:r.outcome,
      createdAt:r.created_at,revealedAt:r.revealed_at,
    })),
  });
 }
 if(roleRow?.role==="tester")return respond({error:"Read-only tester account"},403);
 if(input.action==="commit"){
  if(!["dice","coin","number"].includes(String(input.game)))return respond({error:"Invalid game"},400);
  const {count,error:countError}=await db.from("fair_seed_commitments").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("status","committed");
  if(countError)return respond({error:"Unable to check pending commitments"},500);
  if((count??0)>=10)return respond({error:"Too many pending rounds"},429);
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const seed=hex(bytes);
  const hash=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(seed))));
  const {data,error}=await db.from("fair_seed_commitments").insert({user_id:user.id,game:input.game,server_seed:seed,server_seed_hash:hash}).select("id,game,server_seed_hash,nonce").single();
  if(error)return respond({error:"Commit failed"},500);
  return respond({phase:"committed",...data,algorithm:"hmac-sha256-v2"});
 }
 if(input.action==="reveal"){
  if(typeof input.roundId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.roundId)||typeof input.clientSeed!=="string"||input.clientSeed.length<1||input.clientSeed.length>128)return respond({error:"Invalid round or client seed"},400);
  const {data:round,error}=await db.from("fair_seed_commitments").select("*").eq("id",input.roundId).eq("user_id",user.id).single();
  if(error||!round)return respond({error:"Round not found"},404);
  if(round.status==="revealed"){
   if(round.client_seed!==input.clientSeed)return respond({error:"Client seed mismatch"},409);
   return respond({phase:"revealed",roundId:round.id,game:round.game,serverSeedHash:round.server_seed_hash,serverSeed:round.server_seed,clientSeed:round.client_seed,nonce:round.nonce,outcome:round.outcome,algorithm:"hmac-sha256-v2"});
  }
  const result=await outcome(round.server_seed,input.clientSeed,round.nonce,round.game);
  const {data:saved,error:saveError}=await db.from("fair_seed_commitments").update({status:"revealed",client_seed:input.clientSeed,outcome:result,revealed_at:new Date().toISOString()}).eq("id",round.id).eq("user_id",user.id).eq("status","committed").select("id").maybeSingle();
  if(saveError)return respond({error:"Reveal failed"},500);
  if(!saved)return respond({error:"Concurrent reveal; retry"},409);
  return respond({phase:"revealed",roundId:round.id,game:round.game,serverSeedHash:round.server_seed_hash,serverSeed:round.server_seed,clientSeed:input.clientSeed,nonce:round.nonce,outcome:result,algorithm:"hmac-sha256-v2"});
 }
 return respond({error:"Unknown action"},400);
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
