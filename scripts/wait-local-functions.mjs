import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Local test environment required');
const deadline=Date.now()+60000;
while(Date.now()<deadline){
 try{
  const response=await fetch(c.API_URL+'/functions/v1/ig-support-v1',{method:'POST',headers:{apikey:c.ANON_KEY,authorization:'Bearer '+c.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({action:'mine'}),signal:AbortSignal.timeout(3000)});
  const data=await response.json();
  if(response.status===401&&data.error==='Invalid session'){console.log('Authenticated function runtime is ready');process.exit(0);}
 }catch{}
 await new Promise(resolve=>setTimeout(resolve,500));
}
throw Error('Local authenticated function runtime did not become ready within 60 seconds');
