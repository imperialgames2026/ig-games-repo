import assert from 'node:assert/strict';
import {Image} from 'imagescript';
const origin=process.argv[2];assert.equal(origin,'http://127.0.0.1:54321');
for(const [w,h] of [[240,240],[2000,2000],[6000,4000]]){
 const image=new Image(w,h);image.fill(0x123456ff);
 for(const [format,encode] of [['png',()=>image.encode()],['jpeg',()=>image.encodeJPEG()],['webp',()=>image.encodeWebP()]]){
  const bytes=await encode();const r=await fetch(origin+'/functions/v1/resource-probe?count=3',{method:'POST',body:bytes,signal:AbortSignal.timeout(30000)});
  assert.equal(r.status,w*h>4000000?422:200,`${w}x${h} ${format}`);
  const result=await r.json();console.log(JSON.stringify({probe:'bounded-raster',w,h,format,count:3,status:r.status,wall_ms:result.wall_ms}));
 }
}
const image=new Image(2000,2000);let seed=7;
for(let p=0;p<image.bitmap.length;p+=4){for(let k=0;k<3;k++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.bitmap[p+k]=seed>>>24;}image.bitmap[p+3]=255;}
const bytes=await image.encodeJPEG(85);assert(bytes.length<8388608);
const r=await fetch(origin+'/functions/v1/resource-probe?count=3',{method:'POST',body:bytes,signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'three maximum-size synthetic noisy JPEGs must fit the worker budget');
console.log(JSON.stringify({probe:'noisy-jpeg',pixels:4000000,count:3,size:bytes.length,status:r.status,...await r.json()}));
