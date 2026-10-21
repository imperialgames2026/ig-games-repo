import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {verifyOriginalsRound} from '../../lib/originalsFairness.js';
import {verifyMinesRound} from '../../lib/minesFairness.js';

const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Originals/Mines tests require the isolated local backend');
const admin=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let owner,other,email,password,userId;
test.beforeAll(async()=>{
 password='Local-'+crypto.randomUUID()+'-A7!';
 const clients=[];
 for(let i=0;i<2;i++){
  const address='proof-'+crypto.randomUUID()+'@example.invalid';
  const created=await admin.auth.admin.createUser({email:address,password,email_confirm:true});if(created.error)throw created.error;
  const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email:address,password});if(login.error)throw login.error;
  clients.push(client);if(i===0){email=address;userId=created.data.user.id;}
 }
 [owner,other]=clients;
});
async function call(client,name,body){
 const result=await client.functions.invoke(name,{body});
 if(result.error)throw Error(name+': '+((await result.error.context?.clone().json().catch(()=>null))?.error||result.error.message));
 return result.data;
}
for(const game of ['coin','hashdice','limbo','plinko','wheel']){
 test(game+' commits and reveals through real authenticated Edge Runtime with an owner-bound proof',async()=>{
  const roundId=crypto.randomUUID(),clientSeed='local-proof-🎲-'+game;
  const commit=await call(owner,'ig-originals-practice',{action:'commit',game,requestId:roundId});
  expect(commit.phase).toBe('committed');expect(commit.serverSeed).toBeUndefined();
  const reveal=await call(owner,'ig-originals-practice',{action:'reveal',game,roundId,clientSeed});
  expect(await verifyOriginalsRound(commit,reveal,{game,clientSeed})).toBe(true);
  const replay=await call(owner,'ig-originals-practice',{action:'reveal',game,roundId,clientSeed});
  expect(replay).toEqual(reveal);
  const denied=await other.functions.invoke('ig-originals-practice',{body:{action:'reveal',game,roundId,clientSeed}});
  // The reviewed RPC intentionally classifies an existing other-owner round as
  // an idempotency/ownership conflict (23505), mapped by the handler to409.
  expect(denied.error?.context?.status).toBe(409);
  expect(await denied.error.context.clone().json()).toEqual({error:'Round request conflicts with an earlier request'});
 });
}
test('Mines hides the active board, verifies a stopped round and preserves financial wallets',async()=>{
 const roundId=crypto.randomUUID(),clientSeed='local-mines-🎲';
 const commit=(await call(owner,'ig-mines-practice',{action:'commit',roundId,mineCount:3})).state;
 const active=(await call(owner,'ig-mines-practice',{action:'start',roundId,requestId:crypto.randomUUID(),version:commit.version,clientSeed})).state;
 expect(active.phase).toBe('active');expect(active.mines).toBeUndefined();expect(active.serverSeed).toBeUndefined();
 const denied=await other.functions.invoke('ig-mines-practice',{body:{action:'state',roundId}});expect(denied.error?.context?.status).toBe(404);
 const ended=(await call(owner,'ig-mines-practice',{action:'finish',roundId,requestId:crypto.randomUUID(),version:active.version})).state;
 expect(await verifyMinesRound({...commit,clientSeed},ended)).toBe(true);
 const wallet=await owner.from('wallets').select('cent_balance,igd_balance,igt_balance').eq('user_id',userId).single();
 expect(wallet.error).toBeNull();expect(Object.values(wallet.data).reduce((total,n)=>total+Number(n),0)).toBe(0);
});
async function signIn(page){
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
}
test('CoinFlip browser completes a real server round and verifies its fairness proof',async({page})=>{
 await signIn(page);await page.goto('/PlayCoinFlip');await page.getByRole('button',{name:'Flip coin',exact:true}).click();
 await expect(page.getByText('Fairness proof verified on your device',{exact:false})).toBeVisible();
 await expect(page.getByRole('alert')).toHaveCount(0);
});
test('Mines browser resumes an active round on reload and verifies its ended board',async({page})=>{
 await signIn(page);await page.goto('/PlayMines');await page.getByRole('button',{name:'Commit round',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start committed round',exact:true})).toBeVisible();
 await page.getByLabel('Client seed',{exact:true}).fill('browser-mines-proof');await page.getByRole('button',{name:'Start committed round',exact:true}).click();
 await expect(page.getByRole('button',{name:'Stop and reveal board',exact:true})).toBeVisible();await page.reload();
 await expect(page.getByRole('button',{name:'Stop and reveal board',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Stop and reveal board',exact:true}).click();
 await expect(page.getByText('Board proof verified on your device',{exact:false})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});
