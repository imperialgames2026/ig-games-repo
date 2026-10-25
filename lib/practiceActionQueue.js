const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function parameters(action,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid practice action.');
 const keys=Object.keys(input).sort().join(',');
 if(action==='bet'&&keys==='target,units'&&typeof input.target==='string'&&input.target.length>0&&input.target.length<=64&&Number.isSafeInteger(input.units)&&input.units>0)return {target:input.target,units:input.units};
 if(action==='roll'&&keys==='expectedRound'&&Number.isSafeInteger(input.expectedRound)&&input.expectedRound>=0)return {expectedRound:input.expectedRound};
 if(action==='crashBet'&&keys==='mode,round,target,units'&&Number.isSafeInteger(input.round)&&input.round>=1&&Number.isSafeInteger(input.units)&&input.units>=1&&input.units<=100&&['crash_manual','crash_auto','tren_red','tren_green','tren_yellow'].includes(input.mode)&&(input.mode==='crash_auto'?[1.5,2,3,5,10].includes(input.target):input.target===null))return {round:input.round,mode:input.mode,target:input.target,units:input.units};
 if(action==='cashout'&&keys==='betId,round'&&Number.isSafeInteger(input.round)&&input.round>=1&&typeof input.betId==='string'&&uuid.test(input.betId))return {round:input.round,betId:input.betId};
 if(['blackjackBet','baccaratBet'].includes(action)&&keys==='target,units'&&Number.isSafeInteger(input.units)&&input.units>=1&&input.units<=100&&(action==='blackjackBet'?['main','perfect_pairs']:['player','banker','tie']).includes(input.target))return {target:input.target,units:input.units};
 if(['blackjack_deal','blackjack_hit','blackjack_stand','blackjack_resolve','baccarat_resolve'].includes(action)&&keys==='expectedRound'&&Number.isSafeInteger(input.expectedRound)&&input.expectedRound>=1)return {expectedRound:input.expectedRound};
 if(action==='refill'&&keys==='')return {};
 throw Error('Invalid practice action.');
}

// Only an idempotency receipt and practice input are stored, never credentials,
// cards, seeds or balances. A surviving record is uncertain after reload.
export function createPracticeActionQueue({storage,key,makeId}){
 let pending=null;
 const saved=storage.getItem(key);
 if(saved){
  try{
   const record=JSON.parse(saved);
   if(!uuid.test(record.requestId)||Object.keys(record).sort().join(',')!=='action,params,requestId,uncertain')throw Error();
   pending={action:record.action,params:parameters(record.action,record.params),requestId:record.requestId,uncertain:true};
  }catch{throw Error('Pending practice action cannot be restored safely. Contact support before placing more chips.');}
 }
 const copy=()=>pending?{...pending,params:{...pending.params}}:null;
 const save=record=>{storage.setItem(key,JSON.stringify(record));pending=record;};
 const confirm=requestId=>{
  if(pending?.requestId!==requestId)return;
  storage.removeItem(key);pending=null;
 };
 return {
  peek:copy,
  prepare(action,input){
   const params=parameters(action,input);
   if(pending&&(pending.action!==action||JSON.stringify(pending.params)!==JSON.stringify(params)))throw Error('Confirm the pending practice action before starting a different one.');
   const next=pending||{action,params,requestId:makeId(),uncertain:false};
   if(!uuid.test(next.requestId))throw Error('A stable practice request ID is required.');
   save(next);return copy();
  },
  confirm,
  failed(requestId,{definitiveRejection=false}={}){
   if(pending?.requestId!==requestId)return;
   if(definitiveRejection&&!pending.uncertain){confirm(requestId);return;}
   pending={...pending,uncertain:true};save(pending);
  },
 };
}
