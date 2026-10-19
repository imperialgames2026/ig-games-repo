import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Deno.serve adapter only: the unchanged handler uses the real locked SDK,
// GoTrue and PostgREST. This does not emulate Edge Runtime or gateway JWT checks.
export async function verifyHandlerServices({ apiOrigin, anonKey, serviceKey, users, sql, read }) {
 assert.equal(new URL(apiOrigin).hostname,'127.0.0.1');
 function load(name) {
  let handler;
  const source=read(`supabase/functions/${name}/index.ts`).replace(/^import .*\n/,'');
  const env={SUPABASE_URL:apiOrigin,SUPABASE_ANON_KEY:anonKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
   Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},
   createClient:(url,...args)=>{assert.equal(url,apiOrigin);return createClient(url,...args);},
   Response,Request,Headers,JSON,console,
  });
  assert.equal(typeof handler,'function');return handler;
 }
 const support=load('ig-support-v1');
 const call=async(handler,body,token,method='POST')=>{
  const response=await handler(new Request(`${apiOrigin}/functions/v1/local-test`,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})}));
  return {status:response.status,data:response.status===204?null:await response.json()};
 };
 assert.equal((await call(support,null,null,'OPTIONS')).status,204);
 assert.equal((await call(support,null,null,'GET')).status,405);
 assert.equal((await call(support,{action:'mine'})).status,401);
 assert.equal((await call(support,{action:'mine'},'forged.invalid.token')).status,401);
 const a=users[0],b=users[1],ticketA=randomUUID(),ticketB=randomUUID();
 for(const value of [a.id,b.id,ticketA,ticketB])assert.match(value,/^[0-9a-f-]{36}$/);
 sql(`insert into public.ig_support_tickets(id,user_id,request_id,subject) values
 ('${ticketA}','${a.id}','${randomUUID()}','Local owner A'),('${ticketB}','${b.id}','${randomUUID()}','Local owner B');`);
 const mine=await call(support,{action:'mine'},a.token);
 assert.equal(mine.status,200);assert.deepEqual(mine.data.tickets.map(t=>t.id),[ticketA]);
 assert.equal((await call(support,{action:'messages',ticketId:ticketB},a.token)).status,404);
 assert.equal((await call(support,{action:'queue'},a.token)).status,403);
 assert.equal((await call(support,{action:'mine',user_id:b.id},a.token)).status,400);
 sql(`update public.user_roles set role='admin' where user_id='${b.id}';`);
 const queue=await call(support,{action:'queue'},b.token);
 assert.equal(queue.status,200);assert.equal(queue.data.tickets.length,2);
 sql(`update public.profiles set is_excluded=true where id='${b.id}';`);
 assert.equal((await call(support,{action:'queue'},b.token)).status,403);
 assert.equal((await call(support,{action:'mine'},b.token)).status,200);
 sql(`update auth.users set is_anonymous=true where id='${a.id}';`);
 assert.equal((await call(support,{action:'mine'},a.token)).status,401);
 sql(`update auth.users set is_anonymous=false where id='${a.id}'; update public.profiles set is_excluded=false where id='${b.id}'; update public.user_roles set role='player' where user_id='${b.id}';`);
 for(const name of ['secure-wallet','admin-mutations','ig-originals-practice','ig-admin-users-preview-v1']) {
  assert.equal((await call(load(name),{action:'unsupported-local-probe'},a.token)).status,503,`${name} must keep its staging target guard`);
 }
 console.log('PASS: unchanged handlers backed by real Auth/REST reject missing/forged/anonymous sessions and cross-owner support reads; canonical staff/exclusion boundaries hold.');
 console.log('PASS: four staging-bound handlers fail closed on a local target; their deployment guards were not bypassed. Deno.serve is a Node adapter, not Edge Runtime.');
}
