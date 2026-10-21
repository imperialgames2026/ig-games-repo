import {resolveIdentity} from './identity.js';
import {VIP_WHEEL_STAGES} from './vipLevelSpins.js';
export const wheelSettingsFields='stage,segments,revision,updated_at';
export function normalizeWheelAmount(value){
 const text=String(value??'').trim();
 if(!/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,8})?$/.test(text))throw Error('Use an amount with up to 16 whole digits and 8 decimal places.');
 return text.includes('.')?text.replace(/0+$/,'').replace(/\.$/,''):text;
}
export function validateWheelSegments(segments){
 if(!Array.isArray(segments)||segments.length<2||segments.length>24)throw Error('Each wheel needs 2–24 sections.');
 return segments.map((row,i)=>{
  if(!row||Object.keys(row).sort().join(',')!=='amount,notes,reward,slot,unit,weight'||row.slot!==i+1||
   typeof row.reward!=='string'||!row.reward.trim()||[...row.reward].length>80||
   typeof row.unit!=='string'||!row.unit.trim()||[...row.unit].length>24||
   typeof row.notes!=='string'||[...row.notes].length>240||
   typeof row.amount!=='string'||!Number.isInteger(row.weight)||row.weight<0||row.weight>10000)throw Error('Check each section’s reward, amount, unit, notes and whole-number weight (0–10,000).');
  return {slot:row.slot,reward:row.reward.trim(),amount:normalizeWheelAmount(row.amount),unit:row.unit.trim(),weight:row.weight,notes:row.notes.trim()};
 });
}
export function wheelOdds(segments){
 const total=segments.reduce((sum,row)=>sum+Number(row.weight||0),0);
 return segments.map(row=>total>0?Number(row.weight||0)/total*100:0);
}
function validated(row){
 if(!row||!VIP_WHEEL_STAGES.some(s=>s.stage===row.stage)||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('Wheel settings are unavailable.');
 return {...row,segments:validateWheelSegments(row.segments)};
}
export function createVipWheelSettings(client){
 const staff=async(write=false)=>{
  const user=await resolveIdentity(client);
  if(!user||user.is_excluded||!(write?['superadmin']:['admin','superadmin']).includes(user.role))throw Error(write?'Superadmin access required.':'Admin access required.');
  return user;
 };
 const read=async stage=>{
  const {data,error}=await client.from('ig_vip_wheel_settings').select(wheelSettingsFields).eq('stage',stage).single();
  if(error)throw error;return validated(data);
 };
 return {
  async list(){
   await staff();
   const {data,error}=await client.from('ig_vip_wheel_settings').select(wheelSettingsFields).order('stage',{ascending:true}).limit(4);
   if(error)throw error;
   if(!data||data.length!==3||data.some((row,i)=>row.stage!==i+1))throw Error('All three wheel settings could not be loaded.');
   return data.map(validated);
  },
  async save(stage,segments,revision){
   await staff(true);
   if(!VIP_WHEEL_STAGES.some(s=>s.stage===stage)||!Number.isSafeInteger(revision)||revision<1)throw Error('Reload this wheel before saving.');
   const payload=validateWheelSegments(segments);
   const {data,error}=await client.from('ig_vip_wheel_settings').update({segments:payload}).eq('stage',stage).eq('revision',revision).select(wheelSettingsFields).maybeSingle();
   if(error)throw error;
   if(data)return validated(data);
   const current=await read(stage);
   if(current.revision===revision+1&&JSON.stringify(current.segments)===JSON.stringify(payload))return current;
   throw Error('This wheel changed. Your draft is preserved; reload before saving again.');
  }
 };
}
