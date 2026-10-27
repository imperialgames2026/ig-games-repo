import {fixturePlan,assertLocal} from './policy.mjs';
// Calling requires an independently approved running disposable stack.
// Secrets are supplied in memory by its future runner, never persisted here.
export async function seedAuth({origin,run,serviceKey,passwords,phase="browser",fetchImpl=fetch}){
 assertLocal(origin);if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('runtime approval interlock missing');
 const descriptors=fixturePlan(run,phase),users=[];
 if(!serviceKey||!Array.isArray(passwords)||passwords.length!==descriptors.length||passwords.some(p=>typeof p!=='string'||p.length<24))throw Error('ephemeral fixture credentials missing');
 for(let i=0;i<descriptors.length;i++){
 const f=descriptors[i];const r=await fetchImpl(origin+'/auth/v1/admin/users',{method:'POST',headers:{authorization:`Bearer ${serviceKey}`,apikey:serviceKey,'content-type':'application/json'},body:JSON.stringify({email:f.email,password:passwords[i],email_confirm:true,user_metadata:f.metadata}),signal:AbortSignal.timeout(10000)});
 if(r.status!==200&&r.status!==201)throw Error('Synthetic Auth fixture creation failed');
 const u=await r.json();if(!/^[a-f0-9-]{36}$/i.test(u.id)||u.email!==f.email)throw Error('Malformed synthetic identity');
 users.push({...f,id:u.id});
 }
 // Role/exclusion provisioning is deliberately separate reviewed SQL, never
 // trusted signup metadata or a customer profile write.
 return users;
}
