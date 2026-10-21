import {resolveIdentity} from './identity.js';
import {stageForVipLevel} from './vipLevelSpins.js';
import {normalizeWheelAmount,validateWheelSegments} from './vipWheelSettings.js';
export const WHEEL_WALLET_UNITS=['IGN','IGD','IGT'];
export function wheelPublicationIssues(segments){
 let rows;try{rows=validateWheelSegments(segments);}catch(e){return [e.message];}
 const enabled=rows.filter(row=>row.weight>0),issues=[];
 if(!enabled.length)issues.push('Enable at least one section with a positive weight.');
 for(const row of enabled){
  if(!WHEEL_WALLET_UNITS.includes(row.unit))issues.push(`Section ${row.slot}: choose IGN, IGD or IGT for automatic wallet credit, or set its weight to 0.`);
  if(row.amount==='0')issues.push(`Section ${row.slot}: enter a reward amount greater than 0.`);
 }
 return issues;
}
export function validateWheelRelease(row){
 if(!row||![1,2,3].includes(row.stage)||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.active!=='boolean'||!Array.isArray(row.segments))throw Error('Published wheel could not be verified.');
 if(row.segments.length)validateWheelSegments(row.segments);
 if(row.active&&(!Number.isSafeInteger(row.config_revision)||row.config_revision<1||wheelPublicationIssues(row.segments).length))throw Error('Published wheel could not be verified.');
 return row;
}
export function validateWheelReceipt(row,userId,level=row?.level){
 const prize=row?.reward;
 if(!row||row.user_id!==userId||row.level!==level||row.stage!==stageForVipLevel(level)||typeof row.id!=='string'||typeof row.transaction_id!=='string'||
 !Number.isSafeInteger(row.release_revision)||row.release_revision<1||!prize||!Number.isInteger(prize.slot)||prize.slot<1||prize.slot>24||typeof prize.reward!=='string'||
 typeof prize.amount!=='string'||normalizeWheelAmount(prize.amount)==='0'||!WHEEL_WALLET_UNITS.includes(prize.unit)||typeof row.balance_after!=='string'||
 !/^(0|[1-9][0-9]{0,21})(\.[0-9]{1,8})?$/.test(row.balance_after)||!Number.isInteger(row.ticket)||!Number.isInteger(row.total_weight)||row.ticket<0||row.ticket>=row.total_weight)throw Error('Spin receipt could not be verified. Check your saved result before spinning again.');
 return row;
}
export function availableVipSpins(grants,receipts){
 const used=new Set();
 for(const receipt of receipts){if(used.has(receipt.level)||!grants.some(g=>g.level===receipt.level&&g.stage===receipt.stage))throw Error('Spin history could not be reconciled.');used.add(receipt.level);}
 return grants.filter(row=>!used.has(row.level));
}
export const pendingWheelKey=userId=>'ig:pending-vip-wheel:'+userId;
export function readPendingWheel(storage,userId){
 try{const value=JSON.parse(storage.getItem(pendingWheelKey(userId)));if(value&&Number.isInteger(value.level)&&value.level>=1&&value.level<=34&&Number.isSafeInteger(value.revision)&&value.revision>0)return value;}catch{/* No persisted request. */}
 return null;
}
export function createVipWheelDraw(client){
 const identity=async(userId,write=false)=>{
  const user=await resolveIdentity(client);
  if(!user||user.id!==userId||user.is_excluded||(write&&!['player','admin','superadmin'].includes(user.role)))throw Error('Sign in with an eligible account to use your reward wheels.');return user;
 };
 return {
  async releases(){const {data,error}=await client.from('ig_vip_wheel_releases').select('stage,revision,config_revision,active,segments,updated_at').order('stage');if(error)throw error;if(data?.length!==3||data.some((row,i)=>row.stage!==i+1))throw Error('Published wheels are unavailable.');return data.map(validateWheelRelease);},
  async receipts(userId){await identity(userId);const {data,error}=await client.from('ig_vip_wheel_receipts').select('*').eq('user_id',userId).order('level').limit(35);if(error)throw error;if(!data||data.length>34)throw Error('Spin history is unavailable.');return data.map(row=>validateWheelReceipt(row,userId));},
  async receipt(userId,level){await identity(userId);stageForVipLevel(level);const {data,error}=await client.from('ig_vip_wheel_receipts').select('*').eq('user_id',userId).eq('level',level).maybeSingle();if(error)throw error;return data?validateWheelReceipt(data,userId,level):null;},
  async spin(userId,level,revision){await identity(userId,true);stageForVipLevel(level);if(!Number.isSafeInteger(revision)||revision<1)throw Error('Reload the published wheel.');const {data,error}=await client.rpc('spin_vip_wheel',{p_level:level,p_release_revision:revision});if(error)throw error;return validateWheelReceipt(data,userId,level);},
  async publish(stage,settingsRevision,releaseRevision,active){
   const user=await resolveIdentity(client);if(user?.role!=='superadmin'||user.is_excluded)throw Error('Superadmin access required.');
   if(![1,2,3].includes(stage)||typeof active!=='boolean'||!Number.isSafeInteger(releaseRevision)||releaseRevision<1||
    (active&&(!Number.isSafeInteger(settingsRevision)||settingsRevision<1))||(!active&&settingsRevision!==null))throw Error('Reload this wheel before publishing.');
   const {data,error}=await client.rpc('publish_vip_wheel',{p_stage:stage,p_settings_revision:settingsRevision,p_release_revision:releaseRevision,p_active:active});if(error)throw error;return validateWheelRelease(data);
  }
 };
}
