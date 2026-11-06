import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {createPvpHandler} from '../../supabase/functions/pvp-games-review/handler.mjs';
export async function verifyOnlinePractice({apiOrigin,anonKey,serviceKey,users,sql,registerHandler}){
 assert.equal(new URL(apiOrigin).hostname,'127.0.0.1');
 const values={SUPABASE_URL:'http://kong:8000',SUPABASE_ANON_KEY:anonKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey,IG_LOCAL_PRACTICE:'true'};
 const handler=createPvpHandler({env:key=>values[key],createClient:(url,...args)=>{assert.equal(url,'http://kong:8000');return createClient(apiOrigin,...args);}});registerHandler(handler);
 const call=async(body,token)=>{const response=await handler(new Request(apiOrigin+'/functions/v1/pvp-games-review',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};};
 for(const token of [null,'forged.invalid.token'])assert.equal((await call({op:'create',game:'chess',requestId:randomUUID()},token)).status,401);
 const a=users[0],b=users[1],input={op:'create',game:'chess',requestId:randomUUID()};let result=await call(input,a.token);assert.equal(result.status,200,JSON.stringify(result.data));let s=result.data.snapshot;const roomId=s.roomId;
 assert.deepEqual((await call(input,a.token)).data.receipt,result.data.receipt);
 assert.equal((await call({op:'snapshot',roomId},b.token)).status,403);
 result=await call({op:'invite',roomId,targetId:b.id,expectedVersion:s.revision,requestId:randomUUID()},a.token);assert.equal(result.status,200);s=result.data.snapshot;
 result=await call({op:'join',roomId,seat:1,expectedVersion:s.revision,requestId:randomUUID()},b.token);assert.equal(result.status,200);s=result.data.snapshot;
 const move={op:'action',roomId,expectedVersion:s.revision,requestId:randomUUID(),action:{type:'play',from:'e2',to:'e4'}};
 result=await call(move,a.token);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.snapshot.revision,s.revision+1);
 assert.deepEqual((await call(move,a.token)).data.receipt,result.data.receipt);assert.equal((await call({...move,requestId:randomUUID()},a.token)).status,409);
 const publicClient=createClient(apiOrigin,anonKey,{auth:{persistSession:false}});assert.ok((await publicClient.from('ig_pvp_review_rooms').select('*')).error);
 const owner=createClient(apiOrigin,anonKey,{global:{headers:{Authorization:'Bearer '+a.token}},auth:{persistSession:false}});assert.ok((await owner.rpc('ig_pvp_review_read',{p_actor:a.id,p_room:roomId,p_request:null})).error);
 sql(`update public.profiles set is_excluded=true where id='${b.id}';`);assert.equal((await call({op:'snapshot',roomId},b.token)).status,403);sql(`update public.profiles set is_excluded=false where id='${b.id}';`);
 console.log('PASS: actual local GoTrue tokens, canonical roles, PostgREST/RLS, private two-player room, chess move, durable retry, stale denial and exclusion recheck.');return {roomId,handler};
}
