import {createClient} from "npm:@supabase/supabase-js@2.57.4";

// Read-only operator dashboard. Locked to the existing Imperial Games staging project.
const PROJECT="qonqemhljgxlwpghkxhn";
const HEADERS={"content-type":"application/json","cache-control":"no-store",
 "access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS",
 "access-control-allow-headers":"authorization, apikey, content-type, x-client-info"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const safeMessage="Operator data temporarily unavailable";
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(request.method!=="POST")return reply(405,{error:"POST required"});
 const url=Deno.env.get("SUPABASE_URL"),publicKey=Deno.env.get("SUPABASE_ANON_KEY"),
  secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(url!=="https://"+PROJECT+".supabase.co"||!publicKey||!secret)
  return reply(503,{error:"Staging operator service unavailable"});
 const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!bearer)return reply(401,{error:"Sign-in required"});
 const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(bearer);
 if(authError||!user||user.is_anonymous)return reply(401,{error:"Invalid session"});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const [roleCheck,profileCheck]=await Promise.all([
  db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle(),
  db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle()
 ]);
 if(roleCheck.error||profileCheck.error||
  !["admin","superadmin"].includes(roleCheck.data?.role||"")||
  profileCheck.data?.is_excluded!==false)return reply(403,{error:"Admin access required"});
 const bodyText=await request.text().catch(()=>"");
 if(bodyText.length>1000)return reply(413,{error:"Request too large"});
 let input:Record<string,unknown>;try{input=JSON.parse(bodyText)}catch{return reply(400,{error:"Invalid JSON"})}
 const action=input?.action;
 if(!["overview","players","operations","support","treasury","compliance"].includes(String(action)))
  return reply(400,{error:"Unsupported read-only view"});
 const view=async(table:string,fields:string,order:string,limit=30)=>{
  const result=await db.from(table).select(fields).order(order,{ascending:false}).limit(limit);
  if(result.error)throw Error(safeMessage);
  return result.data??[];
 };
 try {
  if(action==="overview"){
   const metrics=[
    ["players","profiles","id",null],
    ["excludedPlayers","profiles","id",["is_excluded","eq",true]],
    ["pendingKyc","profiles","id",["kyc_status","eq","submitted"]],
    ["openTickets","ig_support_tickets","id",["status","in",["open","pending"]]],
    ["pendingWithdrawals","withdrawal_requests","id",["status","eq","pending"]],
    ["uncreditedObservations","crypto_deposit_observations","id",["credit_status","neq","credited"]],
    ["activePokerEvents","poker_events_v1","id",["status","eq","running"]],
    ["pokerTables","poker_tables_v1","id",null],
    ["tournamentPresets","ig_poker_tournament_presets","id",null],
    ["sandboxVaults","ig_fb_sandbox_vaults","user_id",null],
    ["quarantinedWebhooks","ig_fb_sandbox_webhook_inbox","notification_id",["processing_status","eq","quarantined"]]
   ] as const;
   const values=await Promise.all(metrics.map(async([name,table,column,filter])=>{
    let q=db.from(table).select(column,{count:"exact",head:true});
    if(filter){const [field,op,value]=filter;
     if(op==="eq")q=q.eq(field,value as string|boolean);
     else if(op==="neq")q=q.neq(field,value as string);
     else if(op==="in")q=q.in(field,value as string[]);
    }
    const {count,error}=await q;
    return [name,error?null:count??null] as const;
   }));
   const [events,tickets]=await Promise.all([
    view("poker_events_v1","id,name,format,status,created_at,current_level","created_at",6),
    view("ig_support_tickets","id,subject,status,created_at","created_at",6)
   ]);
   return reply(200,{practiceOnly:true,asOf:new Date().toISOString(),
    metrics:Object.fromEntries(values),events,tickets,
    incomplete:values.filter(([,count])=>count===null).map(([name])=>name),
    financialActionsEnabled:false});
  }
  if(action==="players"){
   const [players,countResult]=await Promise.all([
    view("profiles","id,email,display_name,full_name,kyc_status,is_excluded,created_at","created_at",60),
    db.from("profiles").select("id",{count:"exact",head:true})
   ]);
   return reply(200,{players,total:countResult.error?null:countResult.count,
    sampled:60,readOnly:true});
  }
  if(action==="operations"){
   const [withdrawals,deposits]=await Promise.all([
    view("withdrawal_requests","id,user_id,amount,payment_method,status,audit_flag,created_at","created_at",40),
    view("crypto_deposit_observations","id,user_id,network_id,asset_code,confirmations,status,credit_status,created_at","created_at",40)
   ]);
   return reply(200,{withdrawals,deposits,readOnly:true,
    notice:"Records are not a settlement authorization. Real transfers remain disabled."});
  }
  if(action==="support"){
   const tickets=await view("ig_support_tickets","id,user_id,subject,status,assigned_to,created_at,updated_at","updated_at",60);
   return reply(200,{tickets,readOnly:true});
  }
  if(action==="compliance"){
   const [kyc,audit]=await Promise.all([
    view("kyc_verifications","user_id,status,document_verified,selfie_verified,updated_at","updated_at",40),
    view("admin_action_audit","id,action,reason,created_at","created_at",30)
   ]);
   return reply(200,{kyc,audit,readOnly:true});
  }
  const [readiness,vaults,webhooks]=await Promise.all([
   db.from("crypto_treasury_integration_readiness")
    .select("provider_id,provider_name,operationally_approved,real_funds_enabled,updated_at").limit(15),
   view("ig_fb_sandbox_vaults","user_id,vault_id,status,created_at","created_at",30),
   view("ig_fb_sandbox_webhook_inbox","notification_id,event_type,processing_status,received_at","received_at",30)
  ]);
  if(readiness.error)throw Error(safeMessage);
  return reply(200,{providers:readiness.data??[],vaults,webhooks,readOnly:true,
   sandboxOnly:true,financialActionsEnabled:false});
 }catch{
  return reply(503,{error:safeMessage});
 }
});
