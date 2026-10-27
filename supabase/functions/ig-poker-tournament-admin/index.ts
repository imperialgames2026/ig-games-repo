import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const STAGING="qonqemhljgxlwpghkxhn";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization, apikey, content-type, x-client-info"};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
// Optional market-reference prices; never used for transfers or authoritative prize settlement.
const FIAT=new Set(["USD","EUR","GBP","CAD","AUD","JPY","CHF"]);
const TOKENS:Record<string,string>={
 BTC:"bitcoin",ETH:"ethereum",SOL:"solana",ADA:"cardano",XRP:"ripple",
 LTC:"litecoin",BNB:"binancecoin",USDC:"usd-coin",USDT:"tether",
 XMR:"monero",ARB:"arbitrum",OP:"optimism",POL:"polygon-ecosystem-token",DOGE:"dogecoin"
};
async function indicativeQuote(base:string,quote:string){
 if(base===quote)return {available:true,unitPrice:1,source:"unit identity",asOf:new Date().toISOString(),indicative:true};
 if(["PRACTICE","IC","ID","IGD","IGN","ZEPH"].includes(base))
  return {available:false,reason:"No independently verified market quote for this asset",indicative:true};
 if(!FIAT.has(quote)&&!TOKENS[quote])
  return {available:false,reason:"Display currency not supported by public quote service",indicative:true};
 const signal=AbortSignal.timeout(4500);
 try{
  if(FIAT.has(base)&&FIAT.has(quote)){
   const response=await fetch("https://open.er-api.com/v6/latest/"+base,{signal});
   if(!response.ok)throw Error("Market source unavailable");
   const data=await response.json();const price=Number(data?.rates?.[quote]);
   if(data?.result!=="success"||!Number.isFinite(price)||price<=0)throw Error("Price not provided");
   const asOf=Number(data?.time_last_update_unix);
   return {available:true,unitPrice:price,source:"open.er-api.com (reference FX rate)",
     asOf:asOf?new Date(asOf*1000).toISOString():null,indicative:true};
  }
  // The public CoinGecko endpoint does not reliably quote fiat base to crypto.
  if(!TOKENS[base])return {available:false,reason:"Unsupported fiat-to-crypto quote",indicative:true};
  const vs=quote.toLowerCase();
  const uri="https://api.coingecko.com/api/v3/simple/price?ids="+encodeURIComponent(TOKENS[base])
    +"&vs_currencies="+encodeURIComponent(vs)+"&include_last_updated_at=true";
  const response=await fetch(uri,{signal});
  if(!response.ok)throw Error("Public market feed unavailable");
  const data=await response.json();const row=data?.[TOKENS[base]];
  const price=Number(row?.[vs]),last=Number(row?.last_updated_at);
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(last)||(Date.now()/1000-last)>3600)
   throw Error("Current quote unavailable or stale");
  return {available:true,unitPrice:price,source:"CoinGecko public indicative quote",
    asOf:new Date(last*1000).toISOString(),indicative:true};
 }catch{return {available:false,reason:"Price service unavailable or stale; do not infer parity",indicative:true};}
}
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return reply(405,{error:"POST only"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if((url!=="https://"+STAGING+".supabase.co"&&!(Deno.env.get("IG_LOCAL_PRACTICE")==="true"&&url==="http://kong:8000"))||!key||!secret)return reply(503,{error:"Staging-only configuration service"});
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
 if(input.action==="awardsList"){
  if(typeof input.presetId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.presetId))
    return reply(400,{error:"Invalid preset"});
  const {data,error}=await db.from("ig_poker_tournament_awards")
    .select("place,amount,asset").eq("preset_id",input.presetId).order("place").limit(100);
  if(error)return reply(500,{error:"Unable to retrieve prize schedule"});
  return reply(200,{awards:data||[],practiceOnly:true});
 }
 if(input.action==="saveAwards"){
  if(typeof input.presetId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.presetId)
    ||!Array.isArray(input.awards)||input.awards.length>100
    ||typeof input.asset!=="string"||typeof input.displayAsset!=="string"
    ||!Number.isInteger(input.expectedRevision))return reply(400,{error:"Invalid prize schedule"});
  const {data,error}=await db.rpc("ig_poker_tournament_awards_save",{
    p_actor:user.id,p_preset:input.presetId,p_payout_asset:input.asset,
    p_display_asset:input.displayAsset,p_awards:input.awards,
    p_expected_revision:input.expectedRevision
  });
  return error?reply(400,{error:error.message.slice(0,200)}):reply(200,{awardPlan:data,practiceOnly:true});
 }
 if(input.action==="quote"){
  if(typeof input.asset!=="string"||typeof input.displayAsset!=="string")
    return reply(400,{error:"Select source and display denomination"});
  return reply(200,{quote:await indicativeQuote(input.asset,input.displayAsset)});
 }
 if(input.action==="createPracticeEvent"){
  if(typeof input.presetId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.presetId)
    ||typeof input.requestId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.requestId))
    return reply(400,{error:"Invalid preset or request ID"});
  const {data,error}=await db.rpc("ig_poker_create_event_from_preset",{
    p_actor:user.id,p_preset:input.presetId,p_request:input.requestId
  });
  return error?reply(400,{error:error.message.slice(0,200)}):reply(200,{event:data});
 }
 if(input.action!=="save"||!input.config||typeof input.config!=="object")return reply(400,{error:"Invalid action"});
 if(input.id!==undefined&&(typeof input.id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.id)))return reply(400,{error:"Invalid preset ID"});
 if(!["holdem","omaha"].includes(input.config.variant)||!Number.isInteger(input.config.seatsPerTable)||(input.config.variant==="omaha"?input.config.seatsPerTable!==6:![2,4,6,8,9].includes(input.config.seatsPerTable)))return reply(400,{error:"Unsupported poker table format"});
 const {data,error}=await db.rpc("ig_poker_tournament_preset_save",{p_actor:user.id,p_config:input.config,p_id:input.id??null});
 if(error)return reply(400,{error:error.message.slice(0,200)});
 return reply(200,{preset:data});
});
