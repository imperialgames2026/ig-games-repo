import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type"}});
const integer=(n:unknown,min:number,max:number)=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=min&&n<=max;
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return respond({});
 if(req.method!=="POST")return respond({error:"POST required"},405);
 const jwt=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!jwt)return respond({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(jwt);
 if(authError||!user)return respond({error:"Invalid session"},401);
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 const {data:role,error:roleError}=await admin.from("user_roles").select("role").eq("user_id",user.id).eq("role","superadmin").maybeSingle();
 if(roleError||!role)return respond({error:"Superadmin permission required"},403);
 const input=await req.json().catch(()=>null);
 if(!input||typeof input!=="object")return respond({error:"Invalid JSON"},400);
 if(input.action==="list"){
  const {data,error}=await admin.from("poker_events_v1").select("id,name,format,status,config,version,created_at").order("created_at",{ascending:false}).limit(100);
  return error?respond({error:"Unable to load drafts"},500):respond({events:data});
 }
 if(input.action==="publish"||input.action==="start"){
  if(typeof input.eventId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.eventId)||!Number.isSafeInteger(input.version)||input.version<0||typeof input.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestId))return respond({error:"Invalid event or version"},400);
  const method=input.action==="publish"?"poker_event_publish_v1":"poker_event_start_v1";
  const {data,error}=await admin.rpc(method,{p_event:input.eventId,p_actor:user.id,p_version:input.version,p_request:input.requestId});
  return error?respond({error:error.message},409):respond(data);
 }
 if(input.action!=="create")return respond({error:"Unknown action"},400);
 const name=input.name,format=input.format,config=input.config,requestId=input.requestId;
 if(typeof name!=="string"||name.trim().length<3||name.length>90||!["scheduled_mtt","sit_and_go","ring"].includes(format)||typeof config!=="object"||!config||Array.isArray(config)||typeof requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))
  return respond({error:"Invalid configuration"},400);
 const {maxPlayers,seatsPerTable,startingStack,smallBlind,bigBlind,levels,startAt,buyInMin,buyInMax}=config;
 if(!integer(maxPlayers,2,10000)||!integer(seatsPerTable,2,6)||maxPlayers<seatsPerTable&&format==="scheduled_mtt"||!integer(startingStack,100,1000000)||!integer(smallBlind,1,100000)||!integer(bigBlind,2,200000)||bigBlind<smallBlind*2)
  return respond({error:"Invalid seats, chips or blinds"},400);
 if(format==="sit_and_go"&&(maxPlayers!==seatsPerTable||maxPlayers>6))return respond({error:"Single-table Sit & Go must fill a single table"},400);
 if(format==="ring"&&(maxPlayers>6||!integer(buyInMin,bigBlind*20,1000000)||!integer(buyInMax,buyInMin,1000000)))return respond({error:"Invalid ring buy-in limits"},400);
 if(format==="scheduled_mtt"&&(typeof startAt!=="string"||!Number.isFinite(Date.parse(startAt))||Date.parse(startAt)<=Date.now()))return respond({error:"Scheduled start must be in the future"},400);
 if(!Array.isArray(levels)||levels.length<1||levels.length>100||!levels.every((l:any,i:number)=>l&&l.level===i+1&&integer(l.smallBlind,1,100000000)&&integer(l.bigBlind,2,200000000)&&l.bigBlind>=2*l.smallBlind&&integer(l.ante,0,100000000)&&integer(l.durationSeconds,60,7200)))
  return respond({error:"Invalid blind schedule"},400);
 const safeConfig={maxPlayers,seatsPerTable,startingStack,smallBlind,bigBlind,levels:levels.map((l:any)=>({level:l.level,smallBlind:l.smallBlind,bigBlind:l.bigBlind,ante:l.ante,durationSeconds:l.durationSeconds})), ...(format==="scheduled_mtt"?{startAt:new Date(startAt).toISOString()}:{}), ...(format==="ring"?{buyInMin,buyInMax}:{}),practiceOnly:true,realValueEnabled:false};
 const {data,error}=await admin.rpc("poker_event_create_v1",{p_actor:user.id,p_request:requestId,p_name:name.trim(),p_format:format,p_config:safeConfig});
 if(error)return respond({error:"Unable to create draft; request may conflict with an existing ID"},409);
 return respond(data,201);
});
