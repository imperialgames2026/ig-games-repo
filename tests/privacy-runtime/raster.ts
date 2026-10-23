import {Image} from 'npm:imagescript@3.3.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import {validateImageFile} from '../../supabase/functions/ig-kyc-v1/image-file.js';
Deno.serve(async req=>{
 const start=performance.now();
 try{const bytes=new Uint8Array(await req.arrayBuffer()),count=Number(new URL(req.url).searchParams.get('count')||1);
 if(![1,2,3].includes(count))return new Response('invalid',{status:400});
 let result;for(let n=0;n<count;n++)result=await validateImageFile(bytes,Image.decode.bind(Image),jpeg.decode);
 return Response.json({result,wall_ms:Math.round(performance.now()-start)});
 }catch{return Response.json({error:'Invalid image or decoder failure'},{status:422});}
});
