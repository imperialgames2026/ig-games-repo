import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info, x-supabase-api-version"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return reply({});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 const jwt=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!jwt)return reply({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(jwt);
 if(authError||!user)return reply({error:"Invalid session"},401);
 const db=createClient(url,secret,{auth:{persistSession:false}});
 const input=await req.json().catch(()=>null);
 if(!input||typeof input!=="object")return reply({error:"Invalid payload"},400);
 const {data:eligibility,error:eligibilityError}=await db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle();
 if(eligibilityError || !eligibility || eligibility.is_excluded !== false)return reply({error:"Account ineligible for gameplay"},403);
 const {data:roleRow,error:roleCheckError}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
 if(roleCheckError)return reply({error:"Cannot check account permission"},503);
 if(!roleRow || !["player","admin","superadmin","tester"].includes(roleRow.role))return reply({error:"Account role not authorized"},403);
 if(roleRow?.role==="tester" && !["list","tables"].includes(input.action))return reply({error:"Read-only tester account"},403);
 if(input.action==="list"){
  const {data:events,error}=await db.from("poker_events_v1").select("id,name,format,status,config,version,current_level,level_started_at,created_at").in("status",["registration","running","paused","finished"]).order("created_at",{ascending:false}).limit(50);
  if(error)return reply({error:"Unable to list events"},500);
  const publicEvents=(events??[]).filter(e=>["scheduled_mtt","sit_and_go"].includes(e.format)
    &&e.config?.practiceOnly===true&&e.config?.realValueEnabled!==true
    &&Number(e.config?.buyInUnits??0)===0);
  const {data:entries,error:entriesError}=await db.from("poker_event_entries_v1").select("event_id,user_id,status,table_id,seat_no").eq("user_id",user.id);
  if(entriesError)return reply({error:"Unable to load your tournament registrations"},500);
  const {data:allEntries,error:allEntriesError}=publicEvents.length
    ?await db.from("poker_event_entries_v1").select("event_id").in("event_id",publicEvents.map(e=>e.id))
    :{data:[],error:null};
  if(allEntriesError)return reply({error:"Unable to load tournament registration counts"},500);
  const counts=new Map<string,number>();for(const x of allEntries??[])counts.set(x.event_id,(counts.get(x.event_id)??0)+1);
  const own=new Map<string,any>();for(const e of entries??[])own.set(e.event_id,e);
  return reply({events:publicEvents.map(e=>({id:e.id,name:e.name,format:e.format,status:e.status,version:e.version,maxPlayers:e.config?.maxPlayers,seatsPerTable:e.config?.seatsPerTable,tableCount:e.config?.tableCount,startingStack:e.config?.startingStack,levels:e.config?.levels??[],startAt:e.config?.startAt,currentLevel:e.current_level,levelStartedAt:e.level_started_at,createdAt:e.created_at,practiceOnly:true,realValueEnabled:false,registered:counts.get(e.id)??0,myEntry:own.get(e.id)??null}))});
 }
 if(typeof input.eventId!=="string"||!/^[0-9a-f-]{36}$/i.test(input.eventId))return reply({error:"Invalid event ID"},400);
 if(input.action==="register"){
  const {data,error}=await db.rpc("poker_event_register_v1",{p_event:input.eventId,p_actor:user.id});
  return error?reply({error:error.message},409):reply(data);
 }
 if(input.action==="tables"){
  const {data:entry}=await db.from("poker_event_entries_v1").select("table_id,seat_no,status").eq("event_id",input.eventId).eq("user_id",user.id).maybeSingle();
  if(!entry)return reply({error:"Not registered"},403);
  const {data:tables,error}=await db.from("poker_tables_v1").select("id,status,hand_no,small_blind,big_blind").eq("event_id",input.eventId);
  if(error)return reply({error:"Could not load tables"},500);
  return reply({myTableId:entry.table_id,mySeat:entry.seat_no,myStatus:entry.status,tables:tables??[]});
 }
 return reply({error:"Unknown action"},400);
});