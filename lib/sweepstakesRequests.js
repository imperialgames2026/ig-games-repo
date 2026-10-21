import {resolveIdentity} from './identity.js';
const tables={entry:'ig_entry_requests',claim:'ig_prize_claim_requests'};
const fields={entry:'id,user_id,entry_count,status,created_at',claim:'id,user_id,amount,prize_category,network,wallet_address,status,created_at'};
export function normalizeEntryRequest(input){
 const entry_count=Number(input.entry_count);
 if(!Number.isInteger(entry_count)||entry_count<1||entry_count>10)throw Error('Request between 1 and 10 entries.');
 return {entry_count};
}
export function normalizePrizeRequest(input){
 const amount=String(input.amount??'').trim();
 if(!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(amount)||!/[1-9]/.test(amount))throw Error('Enter a positive amount with at most two decimal places.');
 const prize_category=input.prize_category;
 if(!['crypto','cash_equivalent'].includes(prize_category))throw Error('Choose a prize type.');
 const network=prize_category==='crypto'?String(input.network??'').trim():'',wallet_address=prize_category==='crypto'?String(input.wallet_address??'').trim():'';
 if(prize_category==='crypto'&&(!network||network.length>40||/[\x00-\x1f\x7f]/.test(network)||wallet_address.length<10||wallet_address.length>256||/[\s\x00-\x1f\x7f]/.test(wallet_address)))throw Error('Enter a network and a delivery address without spaces. Delivery details are reviewed before fulfillment.');
 return {amount:decimal(amount),prize_category,network,wallet_address};
}
function same(kind,row,payload){return Object.entries(payload).every(([key,value])=>key==='amount'?decimal(row[key])===decimal(value):row[key]===value);}
// Compare decimal strings without converting monetary amounts to binary floats.
function decimal(value){const [whole,fraction='']=String(value).split('.');return whole+'.'+fraction.padEnd(2,'0');}
export function createSweepstakesRequests(client){
 async function identity(){const u=await resolveIdentity(client);if(!u)throw Error('Sign in to continue.');return u;}
 function spec(kind){if(!tables[kind])throw Error('Unknown request type.');return {table:tables[kind],columns:fields[kind]};}
 return {
  async list(kind,{admin=false}={}){
   const u=await identity(),{table,columns}=spec(kind);
   if(admin&&(u.is_excluded||!['admin','superadmin'].includes(u.role)))throw Error('Admin access required.');
   let q=client.from(table).select(columns).order('created_at',{ascending:false}).limit(admin?200:50);
   if(!admin)q=q.eq('user_id',u.id);
   const {data,error}=await q;if(error)throw error;return data??[];
  },
  async submit(kind,input,id){
   const u=await identity(),{table,columns}=spec(kind);
   if(u.is_excluded||u.role==='tester')throw Error('This account cannot submit requests.');
   if(kind==='claim'&&u.kyc_status!=='approved')throw Error('Complete KYC before submitting a prize claim.');
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id??''))throw Error('A stable request ID is required.');
   const payload=kind==='entry'?normalizeEntryRequest(input):normalizePrizeRequest(input);
   const existing=await client.from(table).select(columns).eq('id',id).eq('user_id',u.id).maybeSingle();
   if(existing.error)throw existing.error;
   if(existing.data){if(same(kind,existing.data,payload))return existing.data;throw Error('This request ID was used for different details.');}
   const result=await client.from(table).insert({id,...payload}).select(columns).single();
   if(!result.error)return result.data;
   if(result.error.code==='23505'){
    const retry=await client.from(table).select(columns).eq('id',id).eq('user_id',u.id).maybeSingle();
    if(!retry.error&&retry.data&&same(kind,retry.data,payload))return retry.data;
   }
   throw result.error;
  }
 };
}
