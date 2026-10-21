import {resolveIdentity} from './identity.js';

export const VIP_STYLES = {
 Beginner:{color:'from-slate-500 to-slate-700',icon:'△'},
 Bronze:{color:'from-amber-500 to-orange-700',icon:'◇'},
 Silver:{color:'from-slate-300 to-slate-500',icon:'⬡'},
 Gold:{color:'from-emerald-400 to-green-600',icon:'⬢'},
 Platinum:{color:'from-slate-400 to-slate-600',icon:'▣'},
 Diamond:{color:'from-indigo-300 to-violet-500',icon:'◈'},
 Eternal:{color:'from-cyan-200 to-blue-400',icon:'✧'},
};
export const vipCatalogFields='id,levels,revision,updated_at';
export function validateVipLevels(levels){
 if(!Array.isArray(levels)||levels.length!==34)throw Error('The VIP schedule must contain all 34 levels.');
 let previous=-1;
 return levels.map((row,i)=>{
  if(!row||Object.keys(row).sort().join(',')!=='level,name,tier,xp_required'||row.level!==i+1||
   typeof row.name!=='string'||row.name!==row.name.trim()||! /^[A-Za-z][A-Za-z0-9 ]{0,79}$/.test(row.name)||
   !Object.hasOwn(VIP_STYLES,row.tier)||!Number.isSafeInteger(row.xp_required)||row.xp_required<=previous||
   (i===0&&row.xp_required!==0))throw Error('Use levels 1–34, valid names and tiers, and increasing whole-number XP thresholds starting at 0.');
  previous=row.xp_required;
  return {level:row.level,name:row.name,tier:row.tier,xp_required:row.xp_required};
 });
}
export function vipProgress(xp,levels){
 if(!Number.isSafeInteger(xp)||xp<0||!levels?.length)return null;
 const index=levels.findLastIndex(row=>xp>=row.xp_required);
 if(index<0)return null;
 const current={...levels[index],...VIP_STYLES[levels[index].tier]},next=levels[index+1]??null;
 const remaining=next?Math.max(0,next.xp_required-xp):0;
 const percent=next?Math.max(0,Math.min(100,Math.floor((xp-current.xp_required)/(next.xp_required-current.xp_required)*100))):100;
 return {current,next,remaining,percent,xp};
}
export function shouldCelebrateVip(previous,next){
 return !!(previous&&next&&previous.userId===next.userId&&previous.revision===next.revision&&
  next.xp>previous.xp&&next.level>previous.level);
}
export function createVipCatalog(client){
 const read=async()=>{
  const {data,error}=await client.from('ig_vip_catalog').select(vipCatalogFields).eq('id',1).single();
  if(error)throw error;
  if(!data||!Number.isSafeInteger(data.revision)||data.revision<1)throw Error('VIP schedule is unavailable.');
  return {...data,levels:validateVipLevels(data.levels)};
 };
 return {read,
  async save(levels,revision){
   const user=await resolveIdentity(client);
   if(!user||user.is_excluded||user.role!=='superadmin')throw Error('Superadmin access required.');
   const payload=validateVipLevels(levels);
   if(!Number.isSafeInteger(revision)||revision<1)throw Error('Reload the VIP schedule before saving.');
   const {data,error}=await client.from('ig_vip_catalog').update({levels:payload}).eq('id',1).eq('revision',revision).select(vipCatalogFields).maybeSingle();
   if(error)throw error;
   if(data)return {...data,levels:validateVipLevels(data.levels)};
   // An unchanged retry after a lost response may confirm the previous save.
   const current=await read();
   if(current.revision===revision+1&&JSON.stringify(current.levels)===JSON.stringify(payload))return current;
   throw Error('The VIP schedule changed. Reload it before saving again. Your draft has been kept.');
  },
  async wallet(userId){
   const {data,error}=await client.from('wallets').select('user_id,experience_points').eq('user_id',userId).single();
   if(error)throw error;
   if(!data||data.user_id!==userId||!Number.isSafeInteger(data.experience_points)||data.experience_points<0)throw Error('VIP progress is unavailable.');
   return data;
  }
 };
}
