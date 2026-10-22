import {imageInfo,MAX_IMAGE_PIXELS} from './validation.js';
const invalid=()=>{throw Error('Invalid or incomplete image file');};
function crc(bytes){let n=0xffffffff;for(const value of bytes){n^=value;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
export async function validateImageFile(bytes,decode,decodeJpeg){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const info=imageInfo(b),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const ascii=(a,z)=>String.fromCharCode(...b.subarray(a,z));
 if(info.mime==='image/png'){
  if(![137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x))invalid();
  let p=8,header=false,data=false,end=false,dataEnded=false;
  while(p<b.length){
   if(p+12>b.length)invalid();const size=v.getUint32(p),type=ascii(p+4,p+8),next=p+size+12;
   if(next>b.length||!/^[A-Za-z]{4}$/.test(type)||crc(b.subarray(p+4,next-4))!==v.getUint32(next-4))invalid();
   if(!header&&type!=='IHDR')invalid();
   if(type==='IHDR'){if(header||size!==13)invalid();header=true;}
   if(['acTL','fcTL','fdAT'].includes(type))invalid();
   if(type[0]===type[0].toUpperCase()&&!['IHDR','PLTE','IDAT','IEND'].includes(type))invalid();
   if(type==='IDAT'){if(dataEnded)invalid();data=true;}else if(data)dataEnded=true;
   if(type==='IEND'){if(size!==0||!data||next!==b.length)invalid();end=true;}
   p=next;
  }
  if(!end)invalid();
 }else if(info.mime==='image/webp'){
  if(v.getUint32(4,true)+8!==b.length)invalid();
  let p=12,frames=0;
  while(p<b.length){
   if(p+8>b.length)invalid();const type=ascii(p,p+4),size=v.getUint32(p+4,true),next=p+8+size+(size%2);
   if(next>b.length)invalid();
   if(type==='ANIM'||type==='ANMF'||(type==='VP8X'&&(size!==10||(b[p+8]&2))))invalid();
   if(type==='VP8 '||type==='VP8L')frames++;
   p=next;
  }
  if(frames!==1)invalid();
 }else{
  if(b.at(-2)!==255||b.at(-1)!==217)invalid();
 }
 // Decode pixels, never faces. Explicit allocation budget is checked by each
 // codec before allocation, including embedded bitstream dimensions.
 // ImageScript's JPEG decoder tolerates truncated entropy streams. Use the
 // strict JPEG codec instead; an appended EOI must not mask missing pixels.
 const image=info.mime==='image/jpeg'
  ?decodeJpeg(b,{useTArray:true,tolerantDecoding:false,maxResolutionInMP:MAX_IMAGE_PIXELS/1000000,maxMemoryUsageInMB:100})
  :await decode(b,{applyOrientation:false,maxPixels:MAX_IMAGE_PIXELS});
 if(image.width!==info.width||image.height!==info.height||(image.bitmap??image.data)?.length!==info.width*info.height*4)invalid();
 return info;
}
