import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
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

const bestOmaha=(hole:C[],board:C[]):number[]=>{
  if(!Array.isArray(hole)||hole.length!==4||!Array.isArray(board)||board.length!==5)
    throw Error("OMAHA_REQUIRES_FOUR_HOLE_FIVE_BOARD");
  let highest:number[]=[];
  // Omaha: EXACTLY two hole cards and EXACTLY three community cards.
  for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)
    for(let x=0;x<5;x++)for(let y=x+1;y<5;y++)for(let z=y+1;z<5;z++){
      const score=score5([hole[a],hole[b],board[x],board[y],board[z]]);
      if(!highest.length||compare(score,highest)>0)highest=score;
    }
  return highest;
};

function awards(seats:{seat_no:number;committed:number;folded:boolean;private_hole:C[]}[],board:C[],button:number,variant:string){
 const scores=new Map<number,number[]>();for(const seat of seats)if(!seat.folded)scores.set(seat.seat_no,variant==='omaha'?bestOmaha(seat.private_hole,board):best([...seat.private_hole,...board]));
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
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"POST required"},405);
 const jwt=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!jwt)return json({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=createClient(url,key,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(jwt);
 if(authError||!user)return json({error:"Invalid session"},401);
 const db=createClient(url,secret,{auth:{persistSession:false}});
 try{
  const body=await req.json();const action=body.action;
  const {data:eligibility,error:eligibilityError}=await db.from("profiles").select("is_excluded").eq("id",user.id).maybeSingle();
 if(eligibilityError || !eligibility || eligibility.is_excluded !== false)return json({error:"Account ineligible for gameplay"},403);
 const {data:roleRow,error:roleCheckError}=await db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(roleCheckError)return json({error:"Cannot check account permission"},503);
  if(!roleRow || !["player","admin","superadmin","tester"].includes(roleRow.role))return json({error:"Account role not authorized"},403);
  if(roleRow?.role==="tester")return json({error:"Read-only tester account"},403);
  if(action==="create"){
   const variant=body.variant??"holdem";
   if(!["holdem","omaha"].includes(variant))return json({error:"Unsupported poker variant"},400);
   const {data,error}=await db.rpc(variant==="omaha"?"poker_create_omaha_v1":"poker_create_v1",
     {p_owner:user.id,p_stack:1000});if(error)throw error;
   return json({tableId:data,variant,practiceOnly:true});
  }
  const tableId=body.tableId;
  if(typeof tableId!=="string"||!/^[0-9a-f-]{36}$/i.test(tableId))return json({error:"Invalid table ID"},400);
  if(action==="join"){
   const {data,error}=await db.rpc("poker_join_v1",{p_table:tableId,p_actor:user.id});if(error)throw error;
   return json({seat:data});
  }
  const {data:membership,error:memberError}=await db.from("poker_seats_v1").select("seat_no").eq("table_id",tableId).eq("user_id",user.id).maybeSingle();
  if(memberError||!membership)return json({error:"Not seated"},403);
  // Expired turns are settled under the same Postgres table-row lock as player actions.
  // This is also safe for concurrent client polls and reloads.
  if(["snapshot","act","buyTime","tick"].includes(action)){
   const {error:timeoutError}=await db.rpc("poker_timeout_turn_v1",{p_table:tableId});
   if(timeoutError)throw timeoutError;
  }
  const {data:table,error:tableError}=await db.from("poker_tables_v1").select("*").eq("id",tableId).single();
  if(tableError||!table)return json({error:"Table unavailable"},404);
  if(action==="start"){
   if(table.event_id){
    const {error:clockError}=await db.rpc("poker_event_tick_v1",{p_event:table.event_id});
    if(clockError)throw clockError;
   }
   if(table.owner_id!==user.id)return json({error:"Only table owner may start"},403);
   const seed=crypto.randomUUID()+crypto.randomUUID(),handNo=Number(table.hand_no)+1;
   const {deck,commitment}=await committedDeck(seed,tableId+":"+handNo);
   const {data,error}=await db.rpc(table.variant==="omaha"?"poker_start_omaha_v1":"poker_start_v2",{p_table:tableId,p_owner:user.id,p_deck:deck,p_commitment:commitment,p_seed:seed,p_hand_no:handNo});if(error)throw error;
   return json({started:true,...data,deckCommitment:commitment});
  }
  if(action==="act"){
   if(typeof body.actionId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.actionId)||!Number.isSafeInteger(body.version))return json({error:"Missing action ID or version"},400);
   const {data,error}=await db.rpc("poker_action_v3",{p_table:tableId,p_actor:user.id,p_action_id:body.actionId,p_version:body.version,p_action:body.move,p_amount:body.amount??0,p_system_timeout:false});
   if(error)throw error;
   return json(data);
  }
  if(action==="buyTime"){
   if(typeof body.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)||!Number.isSafeInteger(body.version)||!["PRACTICE","IGD","IGN"].includes(body.currency))
    return json({error:"Invalid time extension request"},400);
   const {data,error}=await db.rpc("poker_buy_time_v1",{p_table:tableId,p_actor:user.id,p_request:body.requestId,p_version:body.version,p_currency:body.currency});
   if(error)throw error;
   return json(data);
  }
  if(action==="tick"){
   // The snapshot request refreshes the view after the server-side timeout check.
   return json({tableId,version:table.version,turnDeadlineAt:table.turn_deadline_at,turnIndex:table.turn_index,status:table.status});
  }
  if(action==="advance"){
   if(table.status!=="showdown"||table.street==="river")return json({error:"Not advanceable"},409);
   const {data,error}=await db.rpc("poker_advance_v1",{p_table:tableId});if(error)throw error;return json(data);
  }
  if(action==="settle"){
   if(table.status!=="showdown"||table.street!=="river"||!Array.isArray(table.board)||table.board.length!==5)return json({error:"Hand not ready"},409);
   const {data:seats,error:seatsError}=await db.from("poker_seats_v1").select("seat_no,committed,folded,private_hole").eq("table_id",tableId).order("seat_no");
   if(seatsError)throw seatsError;
   const payout=awards(seats,table.board,table.button,table.variant);
   const {data,error}=await db.rpc("poker_settle_v1",{p_table:tableId,p_version:table.version,p_awards:payout});if(error)throw error;
   return json({result:data,awards:payout});
  }
  if(action==="sync"){
   if(!table.event_id)return json({error:"Not a tournament table"},409);
   const {data,error}=await db.rpc("poker_event_sync_v1",{p_event:table.event_id});
   if(error)throw error;
   return json(data);
  }
  if(action==="level"){
   if(!table.event_id)return json({error:"Not a tournament table"},409);
   const {data,error}=await db.rpc("poker_event_tick_v1",{p_event:table.event_id});
   if(error)throw error;
   return json(data);
  }
  if(action==="snapshot"){
   const {data:seats,error:seatsError}=await db.from("poker_seats_v1").select("seat_no,user_id,stack,committed,street_bet,folded,all_in,acted").eq("table_id",tableId).order("seat_no");
   if(seatsError)throw seatsError;
   const {data:hole}=await db.from("poker_seats_v1").select("private_hole").eq("table_id",tableId).eq("user_id",user.id).single();
   const publicTable={id:table.id,variant:table.variant,status:table.status,version:table.version,button:table.button,turnIndex:table.turn_index,street:table.street,board:table.board,smallBlind:table.small_blind,bigBlind:table.big_blind,currentBet:table.current_bet,minRaise:table.min_raise,deckCommitment:table.deck_commitment,handNo:table.hand_no,eventId:table.event_id,ownerId:table.owner_id,
    turnStartedAt:table.turn_started_at,turnDeadlineAt:table.turn_deadline_at,
    turnExtensionUsed:table.turn_extension_used};
   const {data:priceConfig}=await db.from("poker_timebank_prices_v1").select("igd_price,ign_price,payment_enabled,practice_preview_enabled").eq("singleton",true).maybeSingle();
   const price={igd:priceConfig?.igd_price??"0.15",ign:priceConfig?.ign_price??null,
    paymentEnabled:priceConfig?.payment_enabled===true,practicePreviewEnabled:priceConfig?.practice_preview_enabled===true};
   return json({table:publicTable,seats,holeCards:hole?.private_hole??[],serverNow:new Date().toISOString(),timebank:price,
    ...(table.status==="complete"?{revealedSeed:table.seed_secret,verificationHandId:tableId+":"+table.hand_no}: {})});
  }
  return json({error:"Unsupported action"},400);
 }catch(error){const message=error instanceof Error?error.message:"Internal error";return json({error:message},409);}
});
