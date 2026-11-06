import { EncounterActionError, resolvePlayerEncounterAction, resolveServerHostileTurn, type EncounterState, type PlayerEncounterAction } from './encounter-actions.ts';
import { secureRandomInt } from './rules.ts';
interface Dependencies {
 authenticate(token:string):Promise<{id:string;isAnonymous?:boolean}|null>;
 rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{code?:string}|null}>;
 randomInt?:(upperExclusive:number)=>number;
}
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type, x-client-info'};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).length===names.length&&names.every(n=>Object.hasOwn(v,n));
function validCommand(v:unknown):v is PlayerEncounterAction {
 if(!record(v))return false;
 if(v.type==='skill')return keys(v,['type','skillId','targetId'])&&((v.skillId==='spark_burst'&&v.targetId==='sentinel')||(v.skillId==='guarding_vow'&&v.targetId==='hero'));
 if(v.type==='attack')return keys(v,['type','targetId'])&&v.targetId==='sentinel';
 if(v.type==='end_turn'||v.type==='abandon')return keys(v,['type']);
 return v.type==='move'&&keys(v,['type','path'])&&Array.isArray(v.path)&&v.path.length>0&&v.path.length<=6&&v.path.every(p=>record(p)&&keys(p,['x','y'])&&Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y));
}
class RpcFailure {readonly code:string;constructor(code:string){this.code=code;}}
export function createEncounterHandler(deps:Dependencies) {
 return async(request:Request):Promise<Response>=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json(405,{error:'POST required'});
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return json(401,{error:'Sign in required'});
  let user;
  try{user=await deps.authenticate(token);}catch{return json(503,{error:'Sign-in service unavailable'});}
  if(!user||user.isAnonymous)return json(401,{error:'Invalid session'});
  let input:unknown;
  try{
   const reader=request.body?.getReader();if(!reader)return json(400,{error:'Request required'});
   let length=0;const chunks:Uint8Array[]=[];
   while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return json(413,{error:'Request too large'});}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   input=JSON.parse(new TextDecoder().decode(bytes));
  }catch{return json(400,{error:'Invalid JSON'});}
  if(!record(input))return json(400,{error:'Invalid request'});
  const rpc=async(name:string,args:Record<string,unknown>)=>{const r=await deps.rpc(name,args);if(r.error)throw new RpcFailure(r.error.code??'');return r.data;};
  try{
   if((input.action==='start'||input.action==='resume')&&keys(input,input.action==='start'?['action','characterId','requestId']:['action','characterId'])&&uuid(input.characterId)&&(input.action==='resume'||uuid(input.requestId)))
    return json(200,await rpc('ig_campaign_trial_open_v1',{p_user_id:user.id,p_character_id:input.characterId,p_request_id:input.action==='start'?input.requestId:null}));
   if(input.action!=='act'||!keys(input,['action','encounterId','requestId','expectedRevision','command'])||!uuid(input.encounterId)||!uuid(input.requestId)||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||!validCommand(input.command))
    return json(400,{error:'Invalid trial action'});
   const command={expectedRevision:input.expectedRevision,command:input.command};
   const prepared=await rpc('ig_campaign_trial_prepare_v1',{p_user_id:user.id,p_encounter_id:input.encounterId,p_request_id:input.requestId,p_command:command});
   if(!record(prepared))throw new Error('Invalid stored state');
   if(Object.hasOwn(prepared,'replay'))return json(200,prepared.replay);
   const rng=deps.randomInt??secureRandomInt;
   let result=resolvePlayerEncounterAction(prepared.state as EncounterState,user.id,Number(input.expectedRevision),input.command,rng);
   const events=[result.event];
   while(result.state.phase==='awaiting_server_turn'){
    if(events.length>=33)throw new Error('Server turn bound');
    result=resolveServerHostileTurn(result.state,result.state.revision,rng);events.push(result.event);
   }
   return json(200,await rpc('ig_campaign_trial_commit_v1',{p_user_id:user.id,p_encounter_id:input.encounterId,p_request_id:input.requestId,p_command:command,p_next_state:result.state,p_events:events}));
  }catch(error){
   if(error instanceof EncounterActionError){
    if(error.code==='INVALID_STATE')return json(503,{error:'Trial service unavailable'});
    return json(error.code==='STALE_REVISION'?409:422,{error:error.message,code:error.code});
   }
   if(error instanceof RpcFailure){
    if(error.code==='P0002')return json(404,{error:'Hero or trial unavailable'});
    if(error.code==='40001'||error.code==='22023')return json(409,{error:'Trial changed or request ID conflicts. Refresh before trying again.'});
    if(error.code==='P0003')return json(409,{error:'Trial or loadout is locked, complete, or at its action limit. Refresh or leave the trial.'});
    if(error.code==='P0005')return json(429,{error:'Practice trial start limit reached. Try again later.'});
    if(error.code==='P0004')return json(422,{error:'Hero or equipped weapon is not supported in this practice trial.'});
   }
   return json(503,{error:'Trial service unavailable'});
  }
 };
}
