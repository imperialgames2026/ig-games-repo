import {resolveIdentity} from './identity.js';
export const announcementFields='id,title,message,type,link_url,is_active,priority,expires_at,created_at,revision';
// Shared with the database trigger: DNS-hostname HTTPS URLs or local paths.
// IP literals and credential-bearing authorities are intentionally not accepted.
export function validAnnouncementLink(value){
 if([...value].length>2048||/[\s\\\x00-\x1f\x7f]/u.test(value))return false;
 if(/^\/(?:$|[A-Za-z0-9])/.test(value))return true;
 const m=value.match(/^https:\/\/([^/?#]+)(?:[/?#].*)?$/u);
 if(!m)return false;
 const parts=m[1].split(':');if(parts.length>2)return false;
 const [host,port]=parts;
 if(host.length>253||!host.split('.').every(label=>/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))||!/[A-Za-z]/.test(host.split('.').at(-1)))return false;
 return port===undefined||(/^[0-9]{1,5}$/.test(port)&&Number(port)<=65535);
}
export function normalizeAnnouncement(input){
 const title=String(input.title??'').trim(),message=String(input.message??'').trim();
 if(!title||[...title].length>160||!message||[...message].length>3000)throw Error('Enter a title up to 160 characters and a message up to 3000 characters.');
 if(!['special','challenge','tournament'].includes(input.type))throw Error('Choose an announcement type.');
 const priority=Number(input.priority);
 if(!Number.isInteger(priority)||Math.abs(priority)>1000)throw Error('Priority must be a whole number between -1000 and 1000.');
 if(typeof input.is_active!=='boolean')throw Error('Active must be a boolean.');
 const link_url=String(input.link_url??'').trim()||null;
 if(link_url){
  if(!validAnnouncementLink(link_url))throw Error('Use a valid HTTPS hostname URL or site path.');
 }
 let expires_at=null;
 if(input.expires_at){const date=new Date(input.expires_at);if(!Number.isFinite(date.getTime()))throw Error('Choose a valid expiration date.');expires_at=date.toISOString();}
 return {title,message,type:input.type,link_url,is_active:input.is_active,priority,expires_at};
}
const same=(row,payload)=>Object.entries(payload).every(([k,v])=>k==='expires_at'?(!v&&!row[k]||new Date(v).getTime()===new Date(row[k]).getTime()):row[k]===v);
export function createAnnouncements(client){
 const staff=async()=>{const u=await resolveIdentity(client);if(!u||u.is_excluded||!['admin','superadmin'].includes(u.role))throw Error('Admin access required.');return u;};
 return {
  async list({admin=false,page=0}={}){
   if(admin)await staff();
   if(!Number.isInteger(page)||page<0)throw Error('Invalid announcement page');
   let q=client.from('ig_announcements').select(announcementFields).order('priority',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false});
   // PostgreSQL casts the literal 'now' using server time, also for staff
   // whose read policy includes drafts and expired rows. Never use device time.
   if(!admin)q=q.eq('is_active',true).or('expires_at.is.null,expires_at.gt.now');
   const {data,error}=await (admin?q.range(page*100,page*100+99):q.limit(100));if(error)throw error;return data??[];
  },
  async archive({id,revision}){
   await staff();
   if(!id||!Number.isInteger(revision)||revision<1)throw Error('Refresh the announcement before archiving.');
   const result=await client.from('ig_announcements').update({is_active:false}).eq('id',id).eq('revision',revision).select(announcementFields).maybeSingle();
   if(result.error)throw result.error;
   if(result.data)return result.data;
   const check=await client.from('ig_announcements').select(announcementFields).eq('id',id).maybeSingle();
   if(!check.error&&check.data?.is_active===false&&check.data.revision===revision+1)return check.data;
   throw Error('This announcement changed. Reload the list before archiving again.');
  },
  /** @param {any} input @param {{id?:string,revision?:number}} [options] */
  async save(input,{id,revision}={}){
   await staff();const payload=normalizeAnnouncement(input);
   if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id??''))throw Error('A stable announcement ID is required.');
   let result;
   if(revision===undefined)result=await client.from('ig_announcements').insert({id,...payload}).select(announcementFields).single();
   else{
    if(!Number.isInteger(revision)||revision<1)throw Error('Refresh the announcement before editing.');
    result=await client.from('ig_announcements').update(payload).eq('id',id).eq('revision',revision).select(announcementFields).maybeSingle();
   }
   if(!result.error&&result.data)return result.data;
   if((revision===undefined&&result.error?.code==='23505')||(revision!==undefined&&!result.error)){
    const check=await client.from('ig_announcements').select(announcementFields).eq('id',id).maybeSingle();
    if(!check.error&&check.data&&same(check.data,payload)&&
      (revision===undefined||check.data.revision===revision+1))return check.data;
    throw Error('This announcement changed. Reload the list before saving again.');
   }
   throw result.error??Error('Save could not be confirmed. Retry the unchanged announcement.');
  }
 };
}
