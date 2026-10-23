export const KYC_CONSENT_VERSION='2026-10-22';
export const KYC_BUCKET='ig-kyc-evidence';
export function createKyc(client){
 async function call(action,payload={}){
  const {data,error}=await client.functions.invoke('ig-kyc-v1',{body:{action,...payload}});
  if(error){let message='Identity service unavailable. Please try again.';try{message=(await error.context?.json())?.error||message;}catch{}throw Object.assign(Error(message),{status:error.context?.status});}
  if(data?.error)throw Error(data.error);return data;
 }
 return {call,async action(action,payload){return (await call(action,payload)).result;},async upload(id,kind,file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Use JPEG, PNG or WebP images up to 8 MiB.');
  const signed=await call('upload',{id,kind});
  const {error}=await client.storage.from(KYC_BUCKET).uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,cacheControl:'0',upsert:false});
  if(error)throw Error('Image upload failed. Cancel this draft if you need to replace an image.');
 }};
}
