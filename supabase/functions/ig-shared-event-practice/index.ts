import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const REF = "qonqemhljgxlwpghkxhn";
const headers = {
 "Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["state","join","leave","claim","bet","resolve"]);
Deno.serve(async req => {
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if((url!=="https://"+REF+".supabase.co" && !(Deno.env.get('IG_LOCAL_PRACTICE')==='true' && url==='http://kong:8000'))||!key||!service)return json({error:"Staging-only server not configured"},503);
 const token=req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return json({error:"Authentication required"},401);
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await client.auth.getUser(token);
 if(authError||!user||user.is_anonymous)return json({error:"Invalid session"},401);
 let body:Record<string,unknown>;
 try {
  const source=await req.text();
  if(source.length>2048)return json({error:"Request too large"},413);
  body=JSON.parse(source);
 } catch{return json({error:"Invalid payload"},400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Invalid JSON body"},400);
 const {game,action,requestId,target,units,expectedRound}=body;
 if(!["crash","baccarat"].includes(String(game))||!actions.has(String(action)))return json({error:"Invalid game or action"},400);
 const expectedFields=action==="bet" ? ["game","action","requestId","target","units"] :
   action==="resolve" ? ["game","action","requestId","expectedRound"] : ["game","action"];
 if(Object.keys(body).some(k=>!expectedFields.includes(k))||
   expectedFields.some(k=>!Object.hasOwn(body,k)))return json({error:"Unexpected fields"},400);
 if(["bet","resolve"].includes(String(action))&&
    (typeof requestId!=="string"||!UUID.test(requestId)))return json({error:"Invalid idempotency ID"},400);
 if(action==="bet"&&(typeof target!=="string"||target.length>32||
    !Number.isSafeInteger(units)||Number(units)<1||Number(units)>100))return json({error:"Invalid practice bet"},400);
 if(action==="resolve"&&(!Number.isSafeInteger(expectedRound)||Number(expectedRound)<1))
    return json({error:"Invalid round version"},400);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 if(action==="state"){
    const {data,error}=await db.rpc("ig_event_state",{p_actor:user.id,p_game:game});
    if(error)return json({error:error.code==="42501"?"Not eligible":"Table temporarily unavailable"},error.code==="42501"?403:503);
    return json({state:data});
 }
 const {data,error}=await db.rpc("ig_event_action",{
    p_actor:user.id,p_game:game,p_action:action,p_request:requestId??null,
    p_target:target??null,p_units:units??null,p_expected_round:expectedRound??null
 });
 if(error){
    if(error.code==="42501")return json({error:"Action not permitted"},403);
    if(error.code==="23505")return json({error:"Request already used or round changed; refresh table"},409);
    if(error.code==="22023")return json({error:"Selection unavailable, betting closed, or insufficient practice chips"},422);
    console.error("staging event error",error.code);
    return json({error:"Table action unavailable; refresh before resubmitting"},503);
 }
 const snapshot=await db.rpc("ig_event_state",{p_actor:user.id,p_game:game});
 if(snapshot.error)return json({error:"Action accepted; refresh state before retrying"},503);
 return json({action:data,state:snapshot.data});
});
