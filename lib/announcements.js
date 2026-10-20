import {resolveIdentity} from './identity.js';
export const announcementFields='id,title,message,type,link_url,is_active,priority,expires_at,created_at,revision';
export function normalizeAnnouncement(input){
 const title=String(input.title??'').trim(),message=String(input.message??'').trim();
 if(!title||title.length>160||!message||message.length>3000)throw Error('Enter a title up to 160 characters and a message up to 3000 characters.');
 if(!['special','challenge','tournament'].includes(input.type))throw Error('Choose an announcement type.');
 const priority=Number(input.priority);
 if(!Number.isInteger(priority)||Math.abs(priority)>1000)throw Error('Priority must be a whole number between -1000 and 1000.');
 if(typeof input.is_active!=='boolean')throw Error('Active must be a boolean.');
 const link_url=String(input.link_url??'').trim()||null;
 if(link_url){
  if(link_url.length>2048||/[\s\\\x00-\x1f\x7f]/.test(link_url))throw Error('Use a valid HTTPS URL or site path.');
  const relative=/^\/(?:$|[A-Za-z0-9])/.test(link_url);
  let url;try{url=new URL(link_url,'https://imperialgaming.llc');}catch{throw Error('Use a valid HTTPS URL or site path.');}
  if((!relative&&!link_url.startsWith('https://'))||url.protocol!=='https:'||url.username||url.password)throw Error('Use a valid HTTPS URL or site path.');
 }
 let expires_at=null;
 if(input.expires_at){const date=new Date(input.expires_at);if(!Number.isFinite(date.getTime()))throw Error('Choose a valid expiration date.');expires_at=date.toISOString();}
 return {title,message,type:input.type,link_url,is_active:input.is_active,priority,expires_at};
}
const same=(row,payload)=>Object.entries(payload).every(([k,v])=>k==='expires_at'?(!v&&!row[k]||new Date(v).getTime()===new Date(row[k]).getTime()):row[k]===v);
export function createAnnouncements(client){
 const staff=async()=>{const u=await resolveIdentity(client);if(!u||u.is_excluded||!['admin','superadmin'].includes(u.role))throw Error('Admin access required.');return u;};
 return {
  async list({admin=false}={}){
   if(admin)await staff();
   let q=client.from('ig_announcements').select(announcementFields).order('priority',{ascending:false}).order('created_at',{ascending:false});
   if(!admin)q=q.eq('is_active',true).or('expires_at.is.null,expires_at.gt.'+new Date().toISOString());
   const {data,error}=await q.limit(100);if(error)throw error;return data??[];
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
