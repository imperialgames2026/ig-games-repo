const recoveryReasons=new Set(['legacy_receipt','actor_mismatch','payload_mismatch']);
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
 if(action==='pokerAct'&&keys==='amount,move,tableId,version'&&typeof input.tableId==='string'&&uuid.test(input.tableId)&&Number.isSafeInteger(input.version)&&input.version>=0&&['fold','check','call','allin','bet','raise'].includes(input.move)&&Number.isSafeInteger(input.amount)&&input.amount>=0)return {tableId:input.tableId,version:input.version,move:input.move,amount:input.amount};
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
   const keys=Object.keys(record).sort().join(',');
   if(!uuid.test(record.requestId)||typeof record.uncertain!=='boolean'||!['action,params,requestId,uncertain','action,params,recovery,requestId,uncertain'].includes(keys)||(Object.hasOwn(record,'recovery')&&(!recoveryReasons.has(record.recovery)||record.action!=='pokerAct')))throw Error();
   pending={action:record.action,params:parameters(record.action,record.params),requestId:record.requestId,uncertain:true,...(record.recovery?{recovery:record.recovery}:{})};
  }catch{throw Error('Pending practice action cannot be restored safely. Contact support before placing more chips.');}
 }
 const copy=()=>pending?{...pending,params:{...pending.params}}:null;
 const save=record=>{storage.setItem(key,JSON.stringify(record));pending=record;};
 const confirm=requestId=>{
  if(pending?.requestId!==requestId)return;
  if(pending.recovery)throw Error('This poker receipt requires reconciliation before new actions.');
  storage.removeItem(key);pending=null;
 };
 return {
  peek:copy,
  prepare(action,input){
   if(pending?.recovery)throw Error('This poker receipt requires reconciliation. Refresh the table instead of resubmitting.');
   const params=parameters(action,input);
   if(pending&&(pending.action!==action||JSON.stringify(pending.params)!==JSON.stringify(params)))throw Error('Confirm the pending practice action before starting a different one.');
   const next=pending||{action,params,requestId:makeId(),uncertain:false};
   if(!uuid.test(next.requestId))throw Error('A stable practice request ID is required.');
   save(next);return copy();
  },
  confirm,
  requireReconciliation(requestId,reason){
   if(pending?.requestId!==requestId||pending.action!=='pokerAct'||!recoveryReasons.has(reason))throw Error('Invalid poker reconciliation request.');
   pending={...pending,recovery:reason,uncertain:true};save(pending);
  },
  failed(requestId,{definitiveRejection=false}={}){
   if(pending?.requestId!==requestId)return;
   if(definitiveRejection&&!pending.uncertain){confirm(requestId);return;}
   pending={...pending,uncertain:true};save(pending);
  },
 };
}
