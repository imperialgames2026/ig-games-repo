import {pathToFileURL} from 'node:url';
export async function verifyPublishedRelease(origin,expectedSha,{fetcher=fetch}={}){
 const site=new URL(origin);
 if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash)throw Error('Use a public HTTPS site origin.');
 if(!/^[0-9a-f]{40}$/.test(expectedSha))throw Error('Expected full commit SHA required.');
 async function get(path){const response=await fetcher(new URL(path,site),{headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Published '+path+': HTTP '+response.status);return response;}
 const release=await (await get('/release.json')).json();
 if(release.commit!==expectedSha)throw Error('Published commit does not match expected release.');
 if(release.release_mode!=='practice'||release.backend_url!=='https://qonqemhljgxlwpghkxhn.supabase.co'||release.legacy_operations_enabled!==false||release.held_game_count!==10)throw Error('Published release configuration does not match the reviewed practice scope.');
 let assets;
 for(const route of ['/','/Games','/login','/ResetPassword','/AMOE','/PrizeClaims']){
  const response=await get(route),html=await response.text();
  if(!html.includes('<div id="root"></div>'))throw Error('App shell missing at '+route);
  const paths=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(x=>x[1]);
  const app=paths.find(x=>/^\/assets\/[^/]+\.js$/.test(x));
  if(!app)throw Error('Bundled application missing at '+route);
  if(assets&&app!==assets)throw Error('Routes serve different app builds.');
  assets=app;
 }
 const js=await (await get(assets)).text();
 if(!js.includes('qonqemhljgxlwpghkxhn.supabase.co'))throw Error('Application bundle lacks reviewed backend URL.');
 if(js.includes('@base44/sdk'))throw Error('Unexpected Base44 SDK in published bundle.');
 return {commit:release.commit,site:site.origin,release_mode:release.release_mode,migrations:release.reviewed_migration_count,routes:6,application_asset:assets};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 verifyPublishedRelease(process.argv[2],process.argv[3]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
