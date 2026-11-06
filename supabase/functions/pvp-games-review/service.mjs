import {randomBytes,randomUUID} from 'node:crypto';
import {createGame,authorizedAction,playerView} from './runtime/engine.mjs';
export const onlineGames=Object.freeze({poker2:2,poker4:4,poker6:6,poker7:7,poker8:8,poker9:9,omaha2:2,omaha4:4,omaha6:6,omaha7:7,omaha8:8,omaha9:9,pineapple6:6,crazy6:6,lazy6:6,stud5:6,draw5:6,triple27:6,blackjack:1,roulette:1,craps:1,baccarat:1,chess:2,rummy:2,rummy6:6,spades:4,battleship:2,battleship6:2,checkers:2,dominoes:2,euchre:4,hearts:4,pinochle:4,connectfour:2,backgammon:2,reversi:2,gomoku:2,words:2});
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
export const failure=(code,status=400)=>Object.assign(new Error(code),{code,status});
const fail=(c,s)=>{throw failure(c,s);};
export function canonical(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';}
function actionSafe(a,depth=0,bid=null){
 if(depth>12)fail('INVALID_ACTION');
 if(a===null||typeof a==='string'||typeof a==='boolean'||typeof a==='number'&&Number.isSafeInteger(a))return;
 if(!a||typeof a!=='object')fail('INVALID_ACTION');
 for(const[k,v]of Object.entries(a)){if(['actor','actorId','userId','role','token','player','wallet','balance','payout','credits','__proto__','constructor','prototype'].includes(k))fail('CALLER_AUTHORITY_FORBIDDEN');if(k==='amount'&&(depth!==0||!bid||!(v===null&&bid.nullable||Number.isInteger(v)&&v>=bid.min&&v<=bid.max)))fail('INVALID_NONMONETARY_BID');actionSafe(v,depth+1);}
}
export function privateSnapshot(room,actor){
 if(!room.members.includes(actor.id))fail('ROOM_MEMBERSHIP_REQUIRED',403);
 const view=playerView(room,actor.id);view.practiceOnly=true;view.seats=view.seats.map((s,i)=>({...s,bot:false,occupied:!!room.seats[i],name:room.seats[i]?'Player '+(i+1):'Empty seat'}));
 return {protocol:'ig.pvp.snapshot.v1',roomId:room.id,viewerId:actor.id,revision:room.version,view,financialExecutionEnabled:false};
}
export function createHostedPvpService({store,resolveActor,makeId=randomUUID,seed=()=>randomBytes(4).readUInt32LE()}){
 return {async execute(token,input){
  const actor=await resolveActor(token);
  if(!actor||!uuid(actor.id)||actor.is_excluded!==false||!['player','tester','admin','superadmin'].includes(actor.role))fail('ACCOUNT_NOT_ELIGIBLE',403);
  if(!input||Array.isArray(input)||typeof input!=='object'||typeof input.op!=='string')fail('INVALID_REQUEST');
  const fields={snapshot:['op','roomId'],create:['op','game','requestId'],invite:['op','roomId','requestId','expectedVersion','targetId'],join:['op','roomId','requestId','expectedVersion','seat'],action:['op','roomId','requestId','expectedVersion','action']}[input.op];
  if(!fields||Object.keys(input).some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(input,k)))fail('INVALID_REQUEST_FIELDS');
  if(input.op!=='create'&&!uuid(input.roomId))fail('INVALID_ROOM');
  if(input.op!=='snapshot'&&!uuid(input.requestId))fail('REQUEST_ID_REQUIRED');
  if(canonical(input).length>16384)fail('REQUEST_TOO_LARGE',413);
  if(input.op==='create'&&!Object.hasOwn(onlineGames,input.game))fail('GAME_NOT_REVIEWED');
  if(input.op==='snapshot'){const data=await store.read(actor.id,input.roomId,null);return {snapshot:privateSnapshot(data.room,actor),financialExecutionEnabled:false};}
  if(actor.role==='tester')fail('READ_ONLY_ROLE',403);
  const existing=await store.read(actor.id,input.roomId??null,input.requestId);
  if(existing.receipt){if(canonical(existing.payload)!==canonical(input))fail('REQUEST_PAYLOAD_CONFLICT',409);return {receipt:existing.receipt,snapshot:privateSnapshot(existing.room,actor),financialExecutionEnabled:false};}
  let room;
  if(input.op==='create'){
   room={id:makeId(),game:input.game,title:input.game+' private practice room',owner:actor.id,version:1,members:[actor.id],seats:Array(onlineGames[input.game]).fill(null),names:{[actor.id]:'Player 1'},state:createGame(input.game,seed())};room.seats[0]=actor.id;
  }else{
   room=structuredClone(existing.room);privateSnapshot(room,actor);
   if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||room.version!==input.expectedVersion)fail('ROOM_VERSION_CONFLICT',409);
   if(input.op==='invite'){
    if(room.owner!==actor.id)fail('OWNER_REQUIRED',403);if(!uuid(input.targetId))fail('INVALID_INVITEE');if(!room.members.includes(input.targetId))room.members.push(input.targetId);
   }else if(input.op==='join'){
    if(!Number.isInteger(input.seat)||input.seat<0||input.seat>=room.seats.length||room.seats[input.seat]||room.seats.includes(actor.id))fail('SEAT_UNAVAILABLE',409);room.seats[input.seat]=actor.id;room.names[actor.id]='Player '+(input.seat+1);
   }else{
    if(!room.seats.every(Boolean))fail('WAITING_FOR_PLAYERS',409);
    if(!input.action||Array.isArray(input.action)||typeof input.action.type!=='string')fail('INVALID_ACTION');actionSafe(input.action,0,input.action.type==='bid'?(room.game==='spades'?{min:0,max:13,nullable:false}:room.game==='pinochle'?{min:25,max:250,nullable:true}:null):(['blackjack','baccarat','craps'].includes(room.game)&&['bet','deal','roll'].includes(input.action.type)?{min:2,max:100,nullable:false}:null));
    try{room.state=authorizedAction(room,actor.id,structuredClone(input.action));}catch{fail('GAME_ACTION_REJECTED',409);}
   }
   room.version++;
  }
  const saved=await store.commit({actor:actor.id,request:input.requestId,payload:input,room,expected:input.op==='create'?0:input.expectedVersion});
  return {receipt:saved.receipt,snapshot:privateSnapshot(saved.room,actor),financialExecutionEnabled:false};
 }};
}
