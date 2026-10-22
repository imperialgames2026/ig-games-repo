// Fireblocks Developer Sandbox only. Non-signing API credentials. No transfers, sweeping, or balance credits.
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const PROJECT="qonqemhljgxlwpghkxhn",FIREBLOCKS="https://sandbox-api.fireblocks.io";
const H={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const reply=(status:number,x:unknown)=>new Response(JSON.stringify(x),{status,headers:H});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const utf8=new TextEncoder();
const encode=(bytes:Uint8Array)=>{let s="";for(const byte of bytes)s+=String.fromCharCode(byte);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
const hex=(a:Uint8Array)=>Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
async function jwt(path:string,body:string,keyId:string,pem:string){
 const raw=Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,"").replace(/\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",raw,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const now=Math.floor(Date.now()/1000);
 const digest=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",utf8.encode(body))));
 const h=encode(utf8.encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const p=encode(utf8.encode(JSON.stringify({uri:path,nonce:crypto.randomUUID(),iat:now,exp:now+25,sub:keyId,bodyHash:digest})));
 const data=h+"."+p;
 return data+"."+encode(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf8.encode(data))));
}
async function api(path:string,payload:object,idempotency:string,key:string,pem:string){
 if(!/^\/v1\/vault\/accounts(?:\/[0-9]+\/[A-Z0-9_]+)?$/.test(path))throw Error("Endpoint forbidden");
 const body=JSON.stringify(payload),token=await jwt(path,body,key,pem);
 const r=await fetch(FIREBLOCKS+path,{method:"POST",headers:{"content-type":"application/json","accept":"application/json","X-API-Key":key,"Authorization":"Bearer "+token,"Idempotency-Key":idempotency},body,signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Sandbox request failed with HTTP "+r.status);
 return await r.json();
}
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(request.method!=="POST")return reply(405,{error:"POST required"});
 if(Deno.env.get("SUPABASE_URL")!=="https://"+PROJECT+".supabase.co")return reply(503,{error:"Staging project required"});
 const publicKey=Deno.env.get("SUPABASE_ANON_KEY"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!publicKey||!serviceKey)return reply(503,{error:"Backend unavailable"});
 const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!bearer)return reply(401,{error:"Sign-in required"});
 const auth=createClient(Deno.env.get("SUPABASE_URL")!,publicKey);
 const {data:{user},error:authError}=await auth.auth.getUser(bearer);
 if(authError||!user||user.is_anonymous)return reply(401,{error:"Invalid session"});
 if(!hasCompletedMfa(user,bearer))return reply(403,{error:'Two-step verification required',code:'mfa_required'});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,serviceKey,{auth:{persistSession:false}});
 const [role,profile]=await Promise.all([
  db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle(),
  db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle()
 ]);
 if(role.error||profile.error||role.data?.role!=="superadmin"||profile.data?.is_excluded!==false)return reply(403,{error:"Superadmin required"});
 let input:Record<string,unknown>;try{input=await request.json()}catch{return reply(400,{error:"Invalid JSON"})}
 if(typeof input?.userId!=="string"||!UUID.test(input.userId))return reply(400,{error:"Invalid user ID"});
 const target=input.userId;
 if(input.action==="inspect"){
  const [v,w]=await Promise.all([
   db.from("ig_fb_sandbox_vaults").select("vault_id,status").eq("user_id",target).maybeSingle(),
   db.from("ig_fb_sandbox_asset_wallets").select("asset_id,status,deposit_address,destination_tag").eq("user_id",target)
  ]);
  if(v.error||w.error)return reply(503,{error:"Sandbox state unavailable"});
  return reply(200,{sandboxOnly:true,realFundsEnabled:false,vault:v.data,wallets:w.data});
 }
 if(!["reserveVault","reserveAsset"].includes(String(input.action)))return reply(400,{error:"Unknown operation"});
 // Only whitelisted *sandbox asset IDs* may be requested. Do not infer asset IDs from symbols.
 const allowed=(Deno.env.get("FIREBLOCKS_SANDBOX_ASSET_IDS")||"").split(",").map(s=>s.trim()).filter(Boolean);
 const asset=String(input.assetId||"");
 if(input.action==="reserveAsset"&&(!/^[A-Z0-9_]{2,40}$/.test(asset)||!allowed.includes(asset)))
  return reply(400,{error:"Sandbox asset ID not allowlisted"});
 const keyId=Deno.env.get("FIREBLOCKS_SANDBOX_API_KEY");
 const pem=(Deno.env.get("FIREBLOCKS_SANDBOX_PRIVATE_KEY_PKCS8")||"").replace(/\\n/g,"\n");
 if(!keyId||!pem)return reply(503,{error:"Fireblocks sandbox not connected. No request made"});
 const result=input.action==="reserveVault"?
  await db.rpc("ig_fb_reserve_sandbox_vault",{p_actor:user.id,p_subject:target}):
  await db.rpc("ig_fb_reserve_sandbox_wallet",{p_actor:user.id,p_subject:target,p_asset:asset});
 if(result.error)return reply(409,{error:"Sandbox reservation rejected"});
 const op=result.data;
 if(!op?.newReservation)return reply(200,{sandboxOnly:true,alreadyReserved:true,
  status:op?.status,needsManualReconciliation:op?.status!=="provisioned",
  vaultId:op?.vaultId||null,depositAddress:op?.depositAddress||null});
 try{
  const isVault=input.action==="reserveVault";
  const path=isVault?"/v1/vault/accounts":"/v1/vault/accounts/"+op.vaultId+"/"+asset;
  const payload=isVault?{name:"IG-SBX-"+target,customerRefId:"ig-sbx-"+target,hiddenOnUI:true,autoFuel:false,vaultType:"MPC"}:{};
  const data=await api(path,payload,op.idempotencyKey,keyId,pem);
  if(isVault){
   if(!/^\d+$/.test(String(data?.id)))throw Error("Invalid vault identifier");
   const changed=await db.from("ig_fb_sandbox_vaults").update({status:"provisioned",vault_id:String(data.id),updated_at:new Date().toISOString()})
    .eq("user_id",target).eq("status","reserved").select("vault_id").maybeSingle();
   if(changed.error||!changed.data)throw Error("Reconciliation required");
   return reply(200,{sandboxOnly:true,realFundsEnabled:false,status:"provisioned",vaultId:String(data.id)});
  }
  const address=typeof data?.address==="string"&&data.address.length>10?data.address:null;
  const tag=typeof data?.tag==="string"&&data.tag?data.tag:null;
  const status=address?"provisioned":"awaiting_address_verification";
  const changed=await db.from("ig_fb_sandbox_asset_wallets")
   .update({status,deposit_address:address,destination_tag:tag,updated_at:new Date().toISOString()})
   .eq("user_id",target).eq("asset_id",asset).eq("status","reserved").select("status").maybeSingle();
  if(changed.error||!changed.data)throw Error("Reconciliation required");
  return reply(200,{sandboxOnly:true,realFundsEnabled:false,status,assetId:asset,depositAddress:address,destinationTag:tag});
 }catch{
  // The API outcome may be unknown. Never re-submit with a new key until manually reconciled.
  await db.from("ig_fb_sandbox_ops_audit").insert({actor_id:user.id,subject_user_id:target,
   action:"manual_reconciliation_required",details:{operation:input.action,assetId:input.action==="reserveAsset"?asset:null}});
  return reply(503,{error:"Sandbox operation requires manual reconciliation; do not retry with a new account"});
 }
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
