import { createClient } from "npm:@supabase/supabase-js@2.57.4";
// Staging-only, Superadmin-operated poker test agents. No real funds or wallet RPCs.
type C={rank:number;suit:"c"|"d"|"h"|"s"};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type"}});
const hex=(x:Uint8Array)=>Array.from(x,b=>b.toString(16).padStart(2,"0")).join("");
const score5=(hand:C[]):number[]=>{
 const ranks=hand.map(c=>c.rank).sort((a,b)=>b-a),count=new Map<number,number>();
 for(const r of ranks)count.set(r,(count.get(r)??0)+1);
 const g=[...count].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
 const flush=hand.every(c=>c.suit===hand[0].suit);
 const u=[...new Set(ranks)];if(u.includes(14))u.push(1);
 let straight=0;for(let i=0;i<=u.length-5;i++)if(u[i]-u[i+4]===4){straight=u[i];break;}
 if(flush&&straight)return [8,straight];
 if(g[0][1]===4)return [7,g[0][0],g[1][0]];
 if(g[0][1]===3&&g[1][1]===2)return [6,g[0][0],g[1][0]];
 if(flush)return [5,...ranks];
 if(straight)return [4,straight];
 if(g[0][1]===3)return [3,g[0][0],...g.slice(1).map(x=>x[0]).sort((a,b)=>b-a)];
 if(g[0][1]===2&&g[1][1]===2)return [2,Math.max(g[0][0],g[1][0]),Math.min(g[0][0],g[1][0]),g[2][0]];
 if(g[0][1]===2)return [1,g[0][0],...g.slice(1).map(x=>x[0]).sort((a,b)=>b-a)];
 return [0,...ranks];
};
const compare=(a:number[],b:number[])=>{for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]??0)!==(b[i]??0))return Math.sign((a[i]??0)-(b[i]??0));return 0;};
const best=(cards:C[])=>{let result:number[]=[];for(let a=0;a<7;a++)for(let b=a+1;b<7;b++){const candidate=score5(cards.filter((_,i)=>i!==a&&i!==b));if(!result.length||compare(candidate,result)>0)result=candidate;}return result;};
const random=(max:number)=>{const upper=4294967296,cutoff=Math.floor(upper/max)*max;let value=0;do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=cutoff);return value%max;};
async function committedDeck(seed:string,handId:string):Promise<{deck:C[];commitment:string}>{
 const encoder=new TextEncoder();
 const commitment=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(seed+":"+handId))));
 const key=await crypto.subtle.importKey("raw",encoder.encode(seed),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 let counter=0;
 async function sample(n:number){const limit=Math.floor(4294967296/n)*n;for(;;){const mac=await crypto.subtle.sign("HMAC",key,encoder.encode(handId+":"+counter++));const value=new DataView(mac).getUint32(0,false);if(value<limit)return value%n;}}
 const deck:C[]=[];for(const suit of ["c","d","h","s"] as const)for(let rank=2;rank<=14;rank++)deck.push({rank,suit});
 for(let i=deck.length-1;i>0;i--){const j=await sample(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {deck,commitment};
}
function awards(seats:{seat_no:number;committed:number;folded:boolean;private_hole:C[]}[],board:C[],button:number){
 const scores=new Map<number,number[]>();for(const seat of seats)if(!seat.folded)scores.set(seat.seat_no,best([...seat.private_hole,...board]));
 const levels=[...new Set(seats.map(s=>s.committed).filter(n=>n>0))].sort((a,b)=>a-b),out:{seat:number;chips:number}[]=[];
 let previous=0;
 for(const level of levels){
  const participants=seats.filter(s=>s.committed>=level),pot=(level-previous)*participants.length;previous=level;
  const eligible=participants.filter(s=>!s.folded);
  if(!eligible.length)throw Error("No eligible pot winner");
  let top=scores.get(eligible[0].seat_no)!;
  for(const s of eligible)if(compare(scores.get(s.seat_no)!,top)>0)top=scores.get(s.seat_no)!;
  const winners=eligible.filter(s=>compare(scores.get(s.seat_no)!,top)===0).sort((a,b)=>((a.seat_no-button-1+6)%6)-((b.seat_no-button-1+6)%6));
  const share=Math.floor(pot/winners.length),remainder=pot%winners.length;
  winners.forEach((s,i)=>out.push({seat:s.seat_no,chips:share+(i<remainder?1:0)}));
 }
 return out;
}

const REF="qonqemhljgxlwpghkxhn";
const cors={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
const roster=[
 {key:"ace",name:"Imperial Ace [AI BOT]",style:"tight"},
 {key:"baron",name:"Bluff Baron [AI BOT]",style:"aggressive"},
 {key:"carl",name:"Calling Carl [AI BOT]",style:"caller"},
 {key:"wendy",name:"Wildcard Wendy [AI BOT]",style:"wildcard"},
];
const uid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Bot={key:string;user_id:string;public_name:string;strategy:string};
type Seat={table_id:string;seat_no:number;user_id:string;stack:number;street_bet:number;committed:number;folded:boolean;all_in:boolean;acted:boolean;private_hole:C[]};
type Table={id:string;owner_id:string;status:string;version:number;street:string;current_bet:number;min_raise:number;big_blind:number;turn_index:number|null;button:number;board:C[];hand_no:number;dealt_count:number;turn_deadline_at:string|null};
const safe=async <T>(promise:PromiseLike<{data:T|null,error:any}>):Promise<T>=>{
 const {data,error}=await promise;if(error)throw Error(error.message||"Database operation unavailable");
 return data as T;
};
function decision(table:Table, seat:Seat, bot:Bot) {
 const due=Math.max(0,Number(table.current_bet)-Number(seat.street_bet));
 const cards=Array.isArray(seat.private_hole)?seat.private_hole:[];
 const ranks=cards.map(c=>Number(c.rank)), high=Math.max(...ranks,0);
 const pair=ranks.length===2&&ranks[0]===ranks[1];
 const good=pair||high>=13||ranks.reduce((n,r)=>n+r,0)>=22;
 const boardPair=table.board.some(c=>ranks.includes(Number(c.rank)));
 const strong=good||boardPair;
 const w=random(100);
 if(bot.strategy==="tight" && due>0 && !strong && due>Math.min(10,seat.stack))return {move:"fold",amount:0};
 if(bot.strategy==="wildcard" && w<7 && seat.stack>0)return {move:"allin",amount:0};
 if(bot.strategy==="wildcard" && due>0 && w<23)return {move:"fold",amount:0};
 const canRaise=!seat.acted && seat.stack>=due+Number(table.min_raise) &&
    Number(table.current_bet)+Number(table.min_raise)<=Number(seat.street_bet)+Number(seat.stack);
 const raise=(bot.strategy==="aggressive" && w<72)||(bot.strategy==="wildcard" && w<40)||
    (bot.strategy==="tight" && strong && w<28);
 if(canRaise && raise) {
   const desired=Number(table.current_bet)+Number(table.min_raise)+(strong?Math.min(20,seat.stack-due-Number(table.min_raise)):0);
   const amount=Math.min(Number(seat.street_bet)+Number(seat.stack),desired);
   return {move:table.current_bet===0?"bet":"raise",amount};
 }
 if(due>0) {
   if(bot.strategy==="tight"&&!strong&&w<65)return {move:"fold",amount:0};
   return {move:"call",amount:0};
 }
 return {move:"check",amount:0};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"";
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(url!=="https://"+REF+".supabase.co"||!publicKey||!secret)return reply({error:"Bots may run only in configured staging"},503);
 const bearer=req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
 if(!bearer)return reply({error:"Sign-in required"},401);
 const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(bearer);
 if(authError||!user||user.is_anonymous)return reply({error:"Invalid session"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 let input:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>512)return reply({error:"Too much input"},413);input=JSON.parse(raw);}
 catch{return reply({error:"Malformed request"},400);}
 if(!input||typeof input!=="object"||Array.isArray(input)||typeof input.action!=="string")return reply({error:"Invalid request"},400);
 const action=input.action;
 if(!["roster","list","provision","create","step","run"].includes(action))return reply({error:"Unsupported action"},400);
 const hasTable=["roster","step","run"].includes(action);
 const keys=hasTable?["action","tableId"]:["action"];
 if(Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(input,k)))return reply({error:"Unexpected request fields"},400);
 if(hasTable && (typeof input.tableId!=="string"||!uid.test(input.tableId)))return reply({error:"Invalid table"},400);
 const [{data:profile,error:profileError},{data:role,error:roleError}]=await Promise.all([
  db.from("profiles").select("id,is_excluded").eq("id",user.id).maybeSingle(),
  db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle(),
 ]);
 if(profileError||roleError)return reply({error:"Unable to verify account"},503);
 if(!profile||profile.id!==user.id||profile.is_excluded!==false||!role)return reply({error:"Account not eligible"},403);
 const isAdmin=role.role==="superadmin";
 if(action!=="roster"&&!isAdmin)return reply({error:"Superadmin required for bot testing"},403);
 try{
  const bots=await safe<Bot[]>(db.from("ig_poker_lab_bots").select("key,user_id,public_name,strategy").order("key"));
  if(action==="provision"){
    const created:string[]=[];
    for(const person of roster){
      if(bots.some(b=>b.key===person.key))continue;
      const password=hex(crypto.getRandomValues(new Uint8Array(40)));
      const email="imperial-staging-poker-"+person.key+"@example.invalid";
      const {data:createdUser,error:createError}=await db.auth.admin.createUser({
        email,password,email_confirm:true,
        app_metadata:{imperial_poker_bot:true,staging_only:true},
      });
      if(createError||!createdUser.user)throw Error("Bot provisioning failed for "+person.key+": "+(createError?.message||"unknown"));
      const id=createdUser.user.id;
      // Nobody can use the random password to log in; mark Auth account banned as a second barrier.
      const {error:banError}=await db.auth.admin.updateUserById(id,{ban_duration:"876000h"});
      if(banError)throw Error("Could not disable interactive login for bot "+person.key);
      await safe(db.from("profiles").update({display_name:person.name,full_name:person.name}).eq("id",id).select("id").single());
      await safe(db.from("user_roles").upsert({user_id:id,role:"player"},{onConflict:"user_id"}).select("user_id").single());
      await safe(db.from("ig_poker_lab_bots").insert({
        key:person.key,user_id:id,public_name:person.name,strategy:person.style,
      }).select("key").single());
      created.push(person.name);
    }
    return reply({ok:true,created,bots:[...bots.map(b=>b.public_name),...created],practiceOnly:true});
  }
  if(action==="list"){
    const labs=await safe<any[]>(db.from("ig_poker_lab_tables").select("table_id,created_at").order("created_at",{ascending:false}).limit(10));
    return reply({bots:bots.map(b=>({key:b.key,name:b.public_name,strategy:b.strategy})),tables:labs,practiceOnly:true});
  }
  if(action==="create"){
    if(bots.length!==4)return reply({error:"Provision all four test bots first"},422);
    const ace=bots.find(b=>b.key==="ace")!;
    const tableId=await safe<string>(db.rpc("poker_create_v1",{p_owner:ace.user_id,p_stack:1000}));
    for(const bot of bots.filter(b=>b.key!=="ace")){
       await safe(db.rpc("poker_join_v1",{p_table:tableId,p_actor:bot.user_id}));
    }
    await safe(db.from("ig_poker_lab_tables").insert({table_id:tableId,created_by:user.id}).select("table_id").single());
    return reply({ok:true,tableId,joined:bots.length,practiceOnly:true});
  }
  const tableId=String(input.tableId);
  const {data:lab}=await db.from("ig_poker_lab_tables").select("table_id,created_by").eq("table_id",tableId).maybeSingle();
  if(!lab)return reply({error:"Not a registered test lab table"},404);
  if(action==="roster"){
    const {data:seat}=await db.from("poker_seats_v1").select("seat_no").eq("table_id",tableId).eq("user_id",user.id).maybeSingle();
    if(!seat&&!isAdmin)return reply({error:"Only seated players can inspect bot labels"},403);
    const registered=await safe<any[]>(db.from("poker_seats_v1").select("seat_no,user_id").eq("table_id",tableId));
    return reply({tableId,bots:registered.flatMap(s=>{
      const b=bots.find(x=>x.user_id===s.user_id);
      return b?[{seatNo:s.seat_no,name:b.public_name,strategy:b.strategy,isBot:true}]:[];
    }),practiceOnly:true});
  }
  async function stage(){
    const table=await safe<Table>(db.from("poker_tables_v1").select("*").eq("id",tableId).single());
    const seats=await safe<Seat[]>(db.from("poker_seats_v1").select("*").eq("table_id",tableId).order("seat_no"));
    if(!bots.some(b=>b.user_id===table.owner_id))throw Error("Lab owner was not a registered bot");
    if(action==="run"&&seats.some(s=>!bots.some(b=>b.user_id===s.user_id)))
      throw Error("Automatic run refused: a human player has joined. Use step mode.");
    const total=seats.reduce((n,s)=>n+Number(s.stack)+Number(s.committed),0);
    if(total!==seats.length*1000)throw Error("Practice-chip conservation failed before action");
    if(table.status==="waiting"||table.status==="complete"){
      if(seats.filter(s=>s.stack>0).length<2)return {status:"out_of_chips",tableId};
      const seed=crypto.randomUUID()+crypto.randomUUID(),handNo=Number(table.hand_no)+1;
      const {deck,commitment}=await committedDeck(seed,tableId+":"+handNo);
      await safe(db.rpc("poker_start_v2",{p_table:tableId,p_owner:table.owner_id,
        p_deck:deck,p_commitment:commitment,p_seed:seed,p_hand_no:handNo}));
      return {action:"deal",handNo};
    }
    if(table.status==="showdown"){
      if(table.street!=="river"){
        await safe(db.rpc("poker_advance_v1",{p_table:tableId}));
        return {action:"next_street",street:table.street};
      }
      const payout=awards(seats,table.board,table.button);
      await safe(db.rpc("poker_settle_v1",{p_table:tableId,p_version:table.version,p_awards:payout}));
      return {action:"settle",handNo:table.hand_no,payout};
    }
    if(table.status!=="playing")throw Error("Unexpected table status");
    const actor=seats.find(s=>s.seat_no===table.turn_index);
    if(!actor)throw Error("Missing turn actor");
    const bot=bots.find(b=>b.user_id===actor.user_id);
    if(!bot)return {action:"human_turn",seatNo:actor.seat_no};
    const move=decision(table,actor,bot);
    await safe(db.rpc("poker_action_v3",{p_table:tableId,p_actor:actor.user_id,
      p_action_id:crypto.randomUUID(),p_version:table.version,p_action:move.move,p_amount:move.amount,
      p_system_timeout:false}));
    return {action:move.move,bot:bot.public_name,handNo:table.hand_no,amount:move.amount};
  }
  if(action==="step"){
    const step=await stage();
    return reply({ok:true,tableId,step,practiceOnly:true});
  }
  const trace:any[]=[];
  for(let n=0;n<48;n++){
    const step=await stage();trace.push(step);
    if(step.action==="settle"||step.action==="human_turn"||step.status==="out_of_chips")break;
    const updated=await safe<Table>(db.from("poker_tables_v1").select("status").eq("id",tableId).single());
    if(updated.status==="complete")break;
  }
  const finished=await safe<any>(db.from("poker_tables_v1").select("status,street,version,hand_no").eq("id",tableId).single());
  const finalSeats=await safe<{stack:number;committed:number}[]>(db.from("poker_seats_v1").select("stack,committed").eq("table_id",tableId));
  const sum=finalSeats.reduce((x,s)=>x+Number(s.stack)+Number(s.committed),0);
  if(sum!==finalSeats.length*1000)throw Error("Practice chips not conserved after bot run");
  return reply({ok:true,tableId,table:finished,steps:trace,
    practiceChipsConserved:true,totalPracticeChips:sum,practiceOnly:true,financialActionsEnabled:false});
 }catch(error){
  console.error("poker bot lab:",error instanceof Error?error.message:"unknown");
  return reply({error:error instanceof Error?error.message:"Staging bot operation failed"},422);
 }
});
