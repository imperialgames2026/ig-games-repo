import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const id = '11111111-1111-4111-8111-111111111111';
function setup({ anonymous = false, code = null } = {}) {
 let handler; const calls = [];
 const client = { auth: { getUser: async () => ({ data: { user: { id,is_anonymous: anonymous } },error: null }) },
  async rpc(name,args) { calls.push({ name,args }); return { data: { phase: 'active' },error: code ? { code } : null }; } };
 const source = readFileSync(new URL('../supabase/functions/ig-final-practice/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(ts.transpileModule(source,{ compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
  { createClient: () => client,Response,JSON,Deno: { env: { get: k => k === 'SUPABASE_URL' ? 'https://qonqemhljgxlwpghkxhn.supabase.co' : 'fixture-key' },serve: fn => handler = fn } });
 return { calls,request: body => handler(new Request('https://fixture.invalid',{ method: 'POST',headers: { authorization: 'Bearer fixture' },body: JSON.stringify(body) })) };
}
test('parked instant Originals cannot mutate rounds for a verified identity',async()=>{
 const h=setup();assert.equal((await h.request({action:'move',game:'hilo',roundId:id,requestId:id,version:1,choice:'same'})).status,403);assert.equal(h.calls.length,0);
});
test('final game handler rejects caller outcomes, money, invalid choices and anonymous identities',async()=>{
 const base={action:'commit',game:'darts',roundId:id,options:{difficulty:'easy'}};
 for(const body of [{...base,amount:1},{...base,outcome:{zone:5}},{...base,user_id:id},{...base,game:'slots'},{action:'move',game:'towers',roundId:id,requestId:id,version:1,choice:'3'},{action:'move',game:'hilo',roundId:id,requestId:id,version:1,choice:'win'}]){
  const h=setup();assert.equal((await h.request(body)).status,400);assert.equal(h.calls.length,0);
 }
 const h=setup({anonymous:true});assert.equal((await h.request(base)).status,401);assert.equal(h.calls.length,0);
});
