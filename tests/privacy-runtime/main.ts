// Disposable test gateway only. No hosted credentials, model code or bypasses.
const c=JSON.parse(await Deno.readTextFile('/probe/local-info.json'));
Deno.serve(async req=>{
 const path=new URL(req.url).pathname;
 if(path==='/health')return new Response('ok');
 if(!['/ig-kyc-v1','/resource-probe'].includes(path))return new Response('not found',{status:404});
 const app=path==='/ig-kyc-v1',name=app?'application':'raster';
 try{const worker=await EdgeRuntime.userWorkers.create({servicePath:`/probe/${name}`,maybeEntrypoint:`file:///probe/${name}/index.js`,memoryLimitMb:256,workerTimeoutMs:150000,cpuTimeSoftLimitMs:1500,cpuTimeHardLimitMs:2000,noModuleCache:false,forceCreate:true,envVars:app?[['SUPABASE_URL','http://kong:8000'],['SUPABASE_ANON_KEY',c.ANON_KEY],['SUPABASE_SERVICE_ROLE_KEY',c.SERVICE_ROLE_KEY],['IG_LOCAL_PRACTICE','true']]:[]});return await worker.fetch(req);}catch{return Response.json({error:'Isolated Edge worker failed'},{status:503});}
});
