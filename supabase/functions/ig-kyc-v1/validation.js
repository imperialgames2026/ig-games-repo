import {validateQueue} from './privacy.js';
export const MAX_IMAGE_BYTES=8*1024*1024;
export const KINDS=['id_front','id_back','selfie'];
export const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function exact(value,keys){if(!object(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('Unexpected fields');}
export function imageInfo(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length<24||b.length>MAX_IMAGE_BYTES)throw Error('Choose an image up to 8 MiB');
 let mime,width,height;
 const ascii=(start,end)=>String.fromCharCode(...b.slice(start,end));
 if(ascii(1,4)==='PNG'&&b[0]===137&&ascii(12,16)==='IHDR') {mime='image/png';width=v.getUint32(16);height=v.getUint32(20);}
 else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
  mime='image/webp';const type=ascii(12,16);
  if(type==='VP8X'&&b.length>=30){width=1+b[24]+(b[25]<<8)+(b[26]<<16);height=1+b[27]+(b[28]<<8)+(b[29]<<16);if(b[20]&2)throw Error('Animated images are not accepted');}
  else if(type==='VP8L'&&b.length>=25&&b[20]===47){width=1+b[21]+((b[22]&63)<<8);height=1+(b[22]>>6)+(b[23]<<2)+((b[24]&15)<<10);}
  else if(type==='VP8 '&&b.length>=30&&b[23]===157&&b[24]===1&&b[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
 }else if(b[0]===255&&b[1]===216){
  mime='image/jpeg';let p=2;
  while(p+4<b.length){if(b[p++]!==255)break;while(b[p]===255)p++;const marker=b[p++];if(marker===218||marker===217)break;
   if(marker===1||(marker>=208&&marker<=215))continue;
   const size=v.getUint16(p);if(size<2||p+size>b.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=v.getUint16(p+3);width=v.getUint16(p+5);break;}p+=size;
  }
 }
 if(!mime||!width||!height||Math.min(width,height)<120||Math.max(width,height)>6000||width*height>24000000)throw Error('Use a JPEG, PNG or WebP image between 120 and 6000 pixels, up to 24 megapixels');
 return {mime,width,height,size:b.length};
}
export function normalizeFaceResult(input){
 exact(input,['status','cosine_similarity','id_image_sharpness','selfie_sharpness']);
 if(!['compared','manual_review_required'].includes(input.status))throw Error('Invalid comparison status');
 if(input.status!=='compared')return {status:'manual_review_required',model:'OpenCV YuNet + SFace',score_calibrated:false};
 if(!Number.isFinite(input.cosine_similarity)||Math.abs(input.cosine_similarity)>1||![input.id_image_sharpness,input.selfie_sharpness].every(x=>Number.isFinite(x)&&x>=0&&x<=1e9))throw Error('Invalid advisory measurement');
 return {...input,display_similarity_index_0_to_100:Math.round((input.cosine_similarity+1)*500)/10,model:'OpenCV YuNet + SFace',score_calibrated:false};
}
export function validateInput(b){
 const fields={mine:[],queue:['status','cursor','limit'],begin:['full_name','birth_date','country','document_type','consent','consent_version','face_consent'],upload:['id','kind'],submit:['id'],cancel:['id'],detail:['id'],evidence:['id','kind'],review:['id','revision','outcome','reason','customer_message','checks'],worker_claim:[],worker_finish:['id','lease','result'],worker_expired:[],worker_purged:['id']};
 if(!object(b)||!Object.hasOwn(fields,b.action))throw Error('Unknown action');exact(b,['action',...fields[b.action]]);
 if(fields[b.action].includes('id')&&!UUID.test(b.id||''))throw Error('Invalid submission ID');
 if(fields[b.action].includes('kind')&&!KINDS.includes(b.kind))throw Error('Invalid evidence type');
 if(b.action==='queue')validateQueue(b);
 if(b.action==='begin'){
  if(typeof b.full_name!=='string'||b.full_name.trim().length<2||b.full_name.length>120||/[\x00-\x1f<>]/.test(b.full_name)||!/^\d{4}-\d{2}-\d{2}$/.test(b.birth_date||'')||!/^[A-Z]{2}$/.test(b.country||'')||!['passport','driver_license','national_id'].includes(b.document_type)||b.consent!==true||b.consent_version!=='2026-10-22'||typeof b.face_consent!=='boolean')throw Error('Complete the identity details and consent');
 }
 if(b.action==='review'){
  if(!Number.isInteger(b.revision)||b.revision<0||!['approved','rejected','needs_changes','escalated'].includes(b.outcome)||typeof b.reason!=='string'||b.reason.trim().length<10||b.reason.length>1000||typeof b.customer_message!=='string'||b.customer_message.length>500)throw Error('Complete the review details');
  exact(b.checks,['document_authenticity','selfie_match','age_review','liveness_review']);
  if(Object.values(b.checks).some(v=>typeof v!=='boolean'))throw Error('Invalid review checks');
 }
 if(b.action==='worker_finish'){if(!UUID.test(b.lease||''))throw Error('Invalid lease');b.result=normalizeFaceResult(b.result);}
 return b;
}
