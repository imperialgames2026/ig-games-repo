// Fireblocks Webhooks V2 sandbox: verify detached RS512 JWS against Fireblocks sandbox JWKS.
// Quarantine events for reconciliation. Never credit user balances from a webhook.
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const PROJECT="qonqemhljgxlwpghkxhn";
const JWKS_URL="https://sandbox-keys.fireblocks.io/.well-known/jwks.json";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const H={"content-type":"application/json","cache-control":"no-store"};
const reply=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers:H});
const b64decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),x=>x.charCodeAt(0));
const b64encode=(bytes:Uint8Array)=>{let str="";for(const n of bytes)str+=String.fromCharCode(n);return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
const hex=(bytes:Uint8Array)=>[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
async function verified(raw:Uint8Array,jws:string):Promise<boolean>{
 const segments=jws.split(".");
 if(segments.length!==3||segments[1]!==""||segments[0].length>1500||segments[2].length>1500)return false;
 let header:Record<string,unknown>;
 try{header=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(b64decode(segments[0])))}catch{return false}
 if(header.alg!=="RS512"||typeof header.kid!=="string"||!header.kid||header.b64===false||header.crit)return false;
 const response=await fetch(JWKS_URL,{signal:AbortSignal.timeout(4500)});
 if(!response.ok)throw Error("Sandbox key discovery unavailable");
 const keys=(await response.json()).keys;
 if(!Array.isArray(keys))throw Error("JWKS invalid");
 const match=keys.find((k:Record<string,unknown>)=>k.kid===header.kid&&k.kty==="RSA"&&k.alg==="RS512"&&k.use==="sig");
 if(!match)return false;
 const key=await crypto.subtle.importKey("jwk",match,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-512"},false,["verify"]);
 const message=new TextEncoder().encode(segments[0]+"."+b64encode(raw));
 return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64decode(segments[2]),message);
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply(405,{error:"POST required"});
 const url=Deno.env.get("SUPABASE_URL")||"";
 if(url!=="https://"+PROJECT+".supabase.co")return reply(503,{error:"Sandbox only"});
 const expected=Deno.env.get("FIREBLOCKS_SANDBOX_WORKSPACE_ID")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!uuid.test(expected)||!service)return reply(503,{error:"Sandbox webhook not configured"});
 const detached=req.headers.get("Fireblocks-Webhook-Signature")||"";
 if(!detached)return reply(401,{error:"Missing signed notification"});
 const length=Number(req.headers.get("content-length")||0);
 if(length>1024*256)return reply(413,{error:"Payload too large"});
 const raw=new Uint8Array(await req.arrayBuffer());
 if(raw.length>1024*256)return reply(413,{error:"Payload too large"});
 let ok=false;try{ok=await verified(raw,detached)}catch{return reply(503,{error:"Signature validation service unavailable"})}
 if(!ok)return reply(401,{error:"Invalid webhook signature"});
 let event:Record<string,unknown>;
 try{event=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw))}catch{return reply(400,{error:"Invalid signed JSON"})}
 if(!event||!uuid.test(String(event.id))||event.workspaceId!==expected
 ||typeof event.eventType!=="string"||event.eventType.length>128)return reply(403,{error:"Wrong workspace or malformed event"});
 // Reject suspiciously old timestamps; negative clock skew is tolerated. Fireblocks retries are reconciled by ID.
 const created=Number(event.createdAt);
 if(!Number.isFinite(created)||created<Date.now()-1000*60*60*24*7||created>Date.now()+1000*60*10)
  return reply(400,{error:"Event timestamp outside bounded retry window"});
 const hash=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)));
 const serviceClient=createClient(url,service,{auth:{persistSession:false}});
 const existing=await serviceClient.from("ig_fb_sandbox_webhook_inbox").select("body_sha256").eq("notification_id",String(event.id)).maybeSingle();
 if(existing.error)return reply(503,{error:"Inbox unavailable"});
 if(existing.data)return existing.data.body_sha256===hash?
  reply(200,{accepted:true,duplicate:true,credited:false}):reply(409,{error:"Notification ID collision"});
 const saved=await serviceClient.from("ig_fb_sandbox_webhook_inbox").insert({
  notification_id:event.id,workspace_id:String(event.workspaceId),event_type:event.eventType,
  resource_id:typeof event.resourceId==="string"?event.resourceId:null,body_sha256:hash,
  verified_event:event,processing_status:"quarantined",credited:false,network_transfer_approved:false
 });
 if(saved.error)return reply(503,{error:"Could not quarantine notification"});
 return reply(202,{accepted:true,credited:false,processingStatus:"quarantined"});
});
