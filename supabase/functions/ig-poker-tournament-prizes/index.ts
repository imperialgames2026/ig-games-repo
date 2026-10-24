import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const PROJECT="qonqemhljgxlwpghkxhn";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
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
 if(request.method!=="POST")return json(405,{error:"POST required"});
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(url!=="https://"+PROJECT+".supabase.co"||!anon||!service)return json(503,{error:"Staging only"});
 const token=request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)/i)?.[1];
 if(!token)return json(401,{error:"Authentication required"});
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return json(401,{error:"Invalid session"});
 if(!hasCompletedMfa(user,token))return json(403,{error:'Two-step verification required',code:'mfa_required'});
 let body;try{body=await request.json()}catch{return json(400,{error:"Invalid JSON"})}
 if(typeof body?.eventId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.eventId))return json(400,{error:"Bad event"});
 const db=createClient(url,service,{auth:{persistSession:false}});
 const {data:event,error}=await db.from("poker_events_v1").select("id,name,status,config")
   .eq("id",body.eventId).maybeSingle();
 if(error)return json(503,{error:"Cannot load prize schedule"});
 if(!event||!["registration","running","finished"].includes(event.status)||event.config?.practiceOnly!==true)
  return json(404,{error:"Tournament prize schedule not published"});
 const cfg=event.config;const count=Number(cfg.paidPlaces);
 if(!Number.isInteger(count)||count<0||count>100||!Array.isArray(cfg.awardSchedule)||cfg.awardSchedule.length!==count)
  return json(503,{error:"Prize schedule verification failed"});
 const asset=String(cfg.payoutAsset||"PRACTICE"),displayAsset=String(cfg.payoutDisplayAsset||"USD");
 const quote=await indicativeQuote(asset,displayAsset);
 return json(200,{eventId:event.id,name:event.name,status:event.status,awards:cfg.awardSchedule,
   paidPlaces:count,payoutAsset:asset,displayAsset,quote,awardScheduleHash:cfg.awardScheduleHash,
   payoutsActivated:false,practiceOnly:true});
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
