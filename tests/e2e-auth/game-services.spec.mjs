import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL))throw Error('Game tests require isolated local Supabase');
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const clients=[],ids=[];
test.beforeAll(async()=>{
 for(let i=0;i<2;i++){
  const email='game-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A1!';
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
  ids.push(data.user.id);
  const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;clients.push(client);
 }
});
async function call(client,name,body){
 const {data,error}=await client.functions.invoke(name,{body});
 if(error){const detail=await error.context?.clone().json().catch(()=>null);throw Error(name+': '+(detail?.error||error.message));}
 if(data?.error)throw Error(data.error);return data;
}
for(const [game,name] of [['craps','ig-multiplayer-practice'],['roulette','ig-multiplayer-practice'],['blackjack','ig-blackjack-practice'],['baccarat','ig-shared-event-practice']]){
 test('two authenticated players can join '+game+' using server-owned practice chips',async()=>{
  for(const client of clients){
   const body={action:'join',...(game==='blackjack'?{}:{game})};
   const joined=await call(client,name,body);
   expect(joined.state.joined).toBe(true);expect(Number(joined.state.chips)).toBeGreaterThan(0);
  }
  for(const client of clients){
   const state=await call(client,name,{action:'state',...(game==='blackjack'?{}:{game})});
   expect(state.state.joined).toBe(true);
  }
 });
}
for(const variant of ['holdem','omaha']){
 test('authenticated '+variant+' tables deal private cards to their owners only',async()=>{
  const {tableId}=await call(clients[0],'poker-table-v1',{action:'create',variant});
  await call(clients[1],'poker-table-v1',{action:'join',tableId});
  await call(clients[0],'poker-table-v1',{action:'start',tableId});
  const first=await call(clients[0],'poker-table-v1',{action:'snapshot',tableId});
  const second=await call(clients[1],'poker-table-v1',{action:'snapshot',tableId});
  expect(first.holeCards).toHaveLength(variant==='omaha'?4:2);
  expect(second.holeCards).toHaveLength(variant==='omaha'?4:2);
  expect(first.holeCards).not.toEqual(second.holeCards);
  expect(first.seats).toHaveLength(2);
  for(const seat of first.seats)expect(seat.private_hole).toBeUndefined();
 });
}
test('Crash and Trenball share the same live committed round for both players',async()=>{
 for(const client of clients){const data=await call(client,'ig-crash-v2',{action:'join'});expect(data.state.joined).toBe(true);}
 const first=await call(clients[0],'ig-crash-v2',{action:'state'}),second=await call(clients[1],'ig-crash-v2',{action:'state'});
 expect(first.state.round).toBe(second.state.round);expect(first.state.commitment).toBe(second.state.commitment);
 expect(first.state.practiceOnly).toBe(true);expect(first.state.realMoneyEnabled).toBe(false);
});
test('joining all practice games leaves financial wallets unchanged',async()=>{
 const {data,error}=await admin.from('wallets').select('cent_balance,igd_balance,igt_balance').in('user_id',ids);
 expect(error).toBeNull();expect(data).toHaveLength(2);
 for(const row of data)expect(Number(row.cent_balance)+Number(row.igd_balance)+Number(row.igt_balance)).toBe(0);
});
