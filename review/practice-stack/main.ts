// Isolated Edge main service only. Never stage this into a hosted function.
const allowed=new Set(['poker-table-v1','poker-events-v1','admin-poker-events','ig-blackjack-practice','ig-multiplayer-practice','ig-shared-event-practice','ig-crash-v2','ig-poker-tournament-admin','poker-receipt-resolution']);
if(Deno.env.get('IG_SYNTHETIC_STACK_APPROVED')!=='1')throw Error('startup approval interlock missing');
const c=JSON.parse(await Deno.readTextFile('/run/ig-synthetic/local-info.json'));
if(c.API_INTERNAL_URL!=='http://kong:8000')throw Error('nonlocal API');
Deno.serve(async req=>{
 const path=new URL(req.url).pathname;
 if(path==='/health')return new Response('ok');
 const slug=path.slice(1);if(!allowed.has(slug)||!['POST','OPTIONS'].includes(req.method))return new Response('not found',{status:404});
 try{
 const worker=await EdgeRuntime.userWorkers.create({servicePath:`/probe/functions/${slug}`,maybeEntrypoint:`file:///probe/functions/${slug}/index.js`,memoryLimitMb:192,workerTimeoutMs:15000,cpuTimeSoftLimitMs:1500,cpuTimeHardLimitMs:2000,noModuleCache:false,forceCreate:true,envVars:[['SUPABASE_URL',c.API_INTERNAL_URL],['SUPABASE_ANON_KEY',c.ANON_KEY],['SUPABASE_SERVICE_ROLE_KEY',c.SERVICE_ROLE_KEY],['IG_LOCAL_PRACTICE','true']]});
 return await worker.fetch(req);
 }catch{return Response.json({error:'Synthetic worker unavailable'},{status:503});}
});
