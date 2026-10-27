import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {route} from './policy.mjs';
export function handler(requestImpl=http.request){return async(req,res)=>{
 const target=route(req.url,req.method),origin=req.headers.origin;
 if(!target||(origin&&origin!=='http://127.0.0.1:4173')){res.writeHead(403);res.end();return;}
 const cors={'access-control-allow-origin':'http://127.0.0.1:4173','vary':'Origin','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'};
 if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
 // Read the complete bounded body before forwarding any mutating request.
 const chunks=[];let size=0;
 try{for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413,cors);res.end();return;}chunks.push(chunk);}}catch{res.writeHead(400,cors);res.end();return;}
 const headers={};for(const h of ['authorization','apikey','content-type','accept','prefer','range','x-client-info','x-supabase-api-version'])if(req.headers[h])headers[h]=req.headers[h];
 let ended=false;
 const upstream=requestImpl({hostname:target.host,port:target.port,path:target.path,method:req.method,headers,timeout:10000},r=>{
  if(ended){r.destroy();return;}res.writeHead(r.statusCode,{...Object.fromEntries(Object.entries(r.headers).filter(([k])=>!['connection','transfer-encoding','access-control-allow-origin'].includes(k))),...cors});r.pipe(res);
 });
 const fail=()=>{if(ended)return;ended=true;upstream.destroy();if(!res.headersSent)res.writeHead(502,cors);res.end();};
 upstream.on('error',fail);upstream.on('timeout',fail);res.on('close',()=>{ended=true;upstream.destroy();});upstream.end(Buffer.concat(chunks));
 };}
export function makeGateway(){return http.createServer(handler());}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('startup approval interlock missing');makeGateway().listen(8000,'0.0.0.0');}
