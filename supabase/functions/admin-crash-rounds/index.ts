import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const headers={"Content-Type":"application/json"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const hex=(a:Uint8Array)=>Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req)=>{
 if(req.method!=="POST")return reply({error:"POST required"},405);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return reply({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return reply({error:"Invalid session"},401);
 if(!hasCompletedMfa(user,token))return reply({error:'Two-step verification required',code:'mfa_required'},403);
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const {data:role,error:roleError}=await admin.from("user_roles").select("role").eq("user_id",user.id).in("role",["admin","superadmin"]).maybeSingle();
 if(roleError||!role)return reply({error:"Admin permission required"},403);
 const body=await req.json().catch(()=>({}));
 if(body.action!=="generate")return reply({error:"Unknown action"},400);
 const batch=crypto.randomUUID(),rows=[];
 for(let i=1;i<=150;i++){
  const bytes=crypto.getRandomValues(new Uint32Array(2));
  const r=(bytes[0]+1)/4294967297;
  const crash=Math.min(12000,Math.max(0,Math.round((0.99/(1-r))*100)/100));
  const duration=500+(bytes[1]%39501);
  const seed=crypto.randomUUID()+crypto.randomUUID();
  const commitment=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(seed+":"+crash+":"+duration))));
  rows.push({batch_id:batch,ordinal:i,crash_point:crash,duration_ms:duration,seed_secret:seed,commitment});
 }
 const {error:insert}=await admin.from("crash_round_queue").insert(rows);
 if(insert)return reply({error:"Unable to generate queue"},500);
 return reply({batchId:batch,count:rows.length,queued:true,mode:"free-play-only"});
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
