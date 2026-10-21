import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';

// Real local Auth and candidate poker service, with disposable player fixtures.
// This suite never provisions or runs bots and cannot target a remote project.
const config=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL))throw Error('Poker UI tests require isolated local Supabase');
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const players=[];
test.beforeAll(async()=>{
 for(let index=0;index<2;index++){
  const email='poker-ui-'+crypto.randomUUID()+'@example.invalid';
  const password='Local-'+crypto.randomUUID()+'-A1!';
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw error;
  const client=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
  players.push({id:data.user.id,email,password,client});
 }
});
async function signin(page,index=0){
 await page.goto('/login',{waitUntil:'domcontentloaded'});
 await page.getByRole('textbox',{name:'Email',exact:true}).fill(players[index].email);
 await page.getByLabel('Password',{exact:true}).fill(players[index].password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).not.toHaveURL(/\/login(?:\?.*)?$/);
}
async function call(index,body){
 const {data,error}=await players[index].client.functions.invoke('poker-table-v1',{body});
 if(error){const detail=await error.context?.clone().json().catch(()=>null);throw Error(detail?.error||error.message);}
 if(data?.error)throw Error(data.error);return data;
}

test('a player can create, extend a turn, finish and deal the next chip-only hand',async({page})=>{
 await signin(page);
 await page.goto('/PlayPoker',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Create eight-seat Hold’em table',exact:true}).click();
 await expect(page).toHaveURL(/\/PlayPoker\?tableId=/);
 const tableId=new URL(page.url()).searchParams.get('tableId');
 await call(1,{action:'join',tableId,variant:'holdem'});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.getByText('Your stack: 1,000 tester chips',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Deal hand · 2+ players',exact:true}).click();
 await expect(page.getByRole('timer',{name:'Turn time remaining'})).toContainText('remaining');
 const before=await call(0,{action:'snapshot',tableId});
 const bank=page.getByRole('button',{name:'Free +30 seconds',exact:true});
 await bank.click();
 await expect(bank).toHaveCount(0);
 const extended=await call(0,{action:'snapshot',tableId});
 expect(Date.parse(extended.table.turnDeadlineAt)-Date.parse(before.table.turnDeadlineAt)).toBe(30000);
 expect(extended.seats.map(seat=>seat.stack)).toEqual(before.seats.map(seat=>seat.stack));
 await page.getByRole('button',{name:'Fold',exact:true}).click();
 await expect(page.getByText('Hand complete · stacks carried forward',{exact:true})).toBeVisible();
 const complete=await call(0,{action:'snapshot',tableId});
 expect(complete.seats.reduce((total,seat)=>total+Number(seat.stack)+Number(seat.committed),0)).toBe(2000);
 await page.getByRole('button',{name:'Deal next hand',exact:true}).click();
 await expect(page.getByText('Hand #2',{exact:false})).toBeVisible();
 const second=await call(0,{action:'snapshot',tableId});
 expect(second.table.handNo).toBe(2);expect(second.holeCards).toHaveLength(2);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByText('Hand #2',{exact:false})).toBeVisible();
 await expect(page.getByText('Your private cards',{exact:true})).toBeVisible();
 const recovered=await call(0,{action:'snapshot',tableId});
 expect(recovered.seats.reduce((total,seat)=>total+Number(seat.stack)+Number(seat.committed),0)).toBe(2000);
 const wallet=await admin.from('wallets').select('cent_balance,igd_balance,igt_balance').eq('user_id',players[0].id).single();
 expect(wallet.error).toBeNull();
 expect(Number(wallet.data.cent_balance)+Number(wallet.data.igd_balance)+Number(wallet.data.igt_balance)).toBe(0);
});

test('a wrong-variant invite cannot take a seat until opened in the correct poker room',async({page})=>{
 const {tableId}=await call(0,{action:'create',variant:'omaha'});
 await signin(page,1);
 await page.goto('/PlayPoker?tableId='+encodeURIComponent(tableId),{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Join open seat',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('This is an Omaha room');
 const blocked=await admin.from('poker_seats_v1').select('seat_no').eq('table_id',tableId).eq('user_id',players[1].id);
 expect(blocked.error).toBeNull();expect(blocked.data).toHaveLength(0);
 await page.goto('/PlayOmaha?tableId='+encodeURIComponent(tableId),{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Join open seat',exact:true}).click();
 await expect(page.getByText('Your stack: 1,000 tester chips',{exact:false})).toBeVisible();
 const accepted=await admin.from('poker_seats_v1').select('seat_no').eq('table_id',tableId).eq('user_id',players[1].id);
 expect(accepted.error).toBeNull();expect(accepted.data).toHaveLength(1);
});
