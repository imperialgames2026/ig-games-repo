import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup({catalog=[],catalogError=null,anonymous=false,excluded=false}={}) {
 let handler; const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:anonymous}},error:null})},
  from(table){
   calls.push(table);
   if(!['profiles','user_roles','ig_practice_game_catalog'].includes(table))throw Error('Held request reached practice state');
   const result=table==='profiles'?{data:{is_excluded:excluded},error:null}:table==='user_roles'?{data:{role:'player'},error:null}:{data:catalog,error:catalogError};
   const query={select(){return query;},eq(){return query;},maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};
   return query;
  },rpc(){throw Error('Held request reached settlement');}};
 const source=readFileSync(new URL('../supabase/functions/ig-slot-practice-v1/index.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,
  {createClient:()=>client,Response,JSON,console:{error(){}},GAMES:{},validateSpinInput(){throw Error('Held spin reached validation');},
   Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://qonqemhljgxlwpghkxhn.supabase.co':'fixture'},serve:fn=>handler=fn}});
 return {calls,request:body=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify(body)}))};
}

test('held slot catalog blocks state, refill and spin before account writes or settlement',async()=>{
 for(const action of ['state','refill','spin']){
  const h=setup();const response=await h.request({action,game:'mystic-forest'});
  assert.equal(response.status,403);assert.match((await response.json()).error,/held/);
  assert.deepEqual(h.calls,['profiles','user_roles','ig_practice_game_catalog']);
 }
});
test('catalog errors fail closed and one published game never enables a different held game',async()=>{
 const failed=setup({catalogError:{code:'unavailable'}});assert.equal((await failed.request({action:'state'})).status,503);
 const other=setup({catalog:[{slug:'diamond-dynasty'}]});assert.equal((await other.request({action:'spin',game:'mystic-forest'})).status,403);
});
test('anonymous and excluded accounts cannot reach the game catalog boundary',async()=>{
 const anonymous=setup({anonymous:true});assert.equal((await anonymous.request({action:'state'})).status,401);assert.deepEqual(anonymous.calls,[]);
 const excluded=setup({excluded:true});assert.equal((await excluded.request({action:'state'})).status,403);assert(!excluded.calls.includes('ig_practice_game_catalog'));
});
