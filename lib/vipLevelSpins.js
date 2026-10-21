import {resolveIdentity} from './identity.js';

export const VIP_WHEEL_STAGES = [
 {stage:1,minLevel:1,maxLevel:11,name:'Stage 1',color:'from-emerald-500 to-green-800'},
 {stage:2,minLevel:12,maxLevel:24,name:'Stage 2',color:'from-amber-400 to-orange-700'},
 {stage:3,minLevel:25,maxLevel:34,name:'Stage 3',color:'from-violet-400 to-purple-800'},
];
export function stageForVipLevel(level){
 if(!Number.isInteger(level)||level<1||level>34)throw Error('VIP level must be between 1 and 34.');
 return level<=11?1:level<=24?2:3;
}
export function summarizeVipSpins(rows){
 if(!Array.isArray(rows)||rows.length>34)throw Error('Saved spins could not be verified.');
 const seen=new Set(),stages={1:0,2:0,3:0};
 for(const row of rows){
  if(!row||seen.has(row.level)||row.stage!==stageForVipLevel(row.level))throw Error('Saved spins could not be verified.');
  seen.add(row.level);stages[row.stage]++;
 }
 return {total:rows.length,stages};
}
export function createVipLevelSpins(client){
 return {async list(expectedUserId){
  const user=await resolveIdentity(client);
  if(!user||user.id!==expectedUserId||user.is_excluded)throw Error('Sign in to view your saved VIP spins.');
  const {data,error}=await client.from('ig_vip_level_spins')
   .select('user_id,level,stage,level_name,required_xp,earned_xp,catalog_revision,source,earned_at')
   .eq('user_id',user.id).order('level',{ascending:true}).limit(35);
  if(error)throw error;
  const rows=data??[];
  if(rows.some(row=>row.user_id!==user.id))throw Error('Saved spins could not be verified.');
  return {rows,...summarizeVipSpins(rows)};
 }};
}
