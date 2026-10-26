import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { GAMES, evaluateGrid, generateGrid, validateSpinInput } from "./validation.js";

const SLOTS_PARKED=true; // Release policy; no caller or environment override.
const STAGING_REF="qonqemhljgxlwpghkxhn";
const cors={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization, apikey, content-type, x-client-info","access-control-allow-methods":"POST, OPTIONS"};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const ROLES=new Set(["player","admin","superadmin"]);
function randomInt(max:number){
 const upper=4294967296,cutoff=Math.floor(upper/max)*max;let value=0;
 do{value=crypto.getRandomValues(new Uint32Array(1))[0];}while(value>=cutoff);
 return value%max;
}
Deno.serve(async(req)=>{
 try{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return send({error:"POST required"},405);
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(url!==`https://${STAGING_REF}.supabase.co`||!key||!secret)return send({error:"Staging slot service unavailable"},503);
  const token=req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return send({error:"Authentication required"},401);
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return send({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:profile,error:profileError},{data:role,error:roleError}]=await Promise.all([
   db.from("profiles").select("id,is_excluded").eq("id",user.id).maybeSingle(),
   db.from("user_roles").select("role").eq("user_id",user.id).maybeSingle()
  ]);
  if(profileError||roleError)return send({error:"Account verification unavailable"},503);
  if(!profile||profile.is_excluded!==false||!role||!ROLES.has(role.role))return send({error:"Account not eligible for slot practice"},403);
  let body:any;
  try{const raw=await req.text();if(raw.length>1000)return send({error:"Request too long"},413);body=JSON.parse(raw);}catch{return send({error:"Invalid JSON"},400);}
  if(!body||typeof body!=="object"||Array.isArray(body))return send({error:"Invalid request"},400);
  // Even state initializes an account, so deny before all slot data access.
  if(SLOTS_PARKED)return send({error:"GAME_PARKED"},403);
  const action=body.action;
  if(action==="state"){
   await db.from("ig_slot_practice_accounts").upsert({user_id:user.id},{onConflict:"user_id",ignoreDuplicates:true});
   const {data,error}=await db.from("ig_slot_practice_accounts").select("chips").eq("user_id",user.id).single();
   if(error)throw error;
   return send({practiceOnly:true,realMoneyEnabled:false,chips:Number(data.chips)});
  }
  if(action==="refill"){
   const {data,error}=await db.rpc("ig_slot_practice_refill_v1",{p_actor:user.id});
   if(error)return send({error:error.message},409);
   return send({practiceOnly:true,realMoneyEnabled:false,chips:Number(data)});
  }
  if(action!=="spin")return send({error:"Unsupported action"},400);
  const game=body.game,requestId=body.requestId,bet=body.betUnits,lines=body.lines;
  if(typeof requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)||!validateSpinInput(game,bet,lines))
   return send({error:"Invalid practice spin"},400);
  const {data:prior,error:priorError}=await db.from("ig_slot_practice_spins").select("game,bet_units,lines,grid,winning_cells,scatter_count,paid_units,balance_after,id").eq("user_id",user.id).eq("request_id",requestId).maybeSingle();
  if(priorError)throw priorError;
  if(prior){
   if(prior.game!==game||Number(prior.bet_units)!==bet||Number(prior.lines)!==lines)return send({error:"Request ID already used for a different spin"},409);
   return send({practiceOnly:true,realMoneyEnabled:false,spinId:prior.id,chips:Number(prior.balance_after),paidUnits:Number(prior.paid_units),grid:prior.grid,winningCells:prior.winning_cells,scatterCount:prior.scatter_count,replayed:true});
  }
  const grid=generateGrid(game,randomInt);
  const result={grid,...evaluateGrid(game,bet,lines,grid)};
  const {data,error}=await db.rpc("ig_slot_practice_spin_v1",{p_actor:user.id,p_request:requestId,p_game:game,p_bet_units:bet,p_lines:lines,p_grid:result.grid,p_winning_cells:result.winningCells,p_scatter_count:result.scatterCount,p_paid_units:result.paidUnits});
  if(error)return send({error:error.message},409);
  return send({practiceOnly:true,realMoneyEnabled:false,...data});
 }catch(error){console.error("ig-slot-practice-v1",error);return send({error:"Slot practice unavailable"},503);}
});
