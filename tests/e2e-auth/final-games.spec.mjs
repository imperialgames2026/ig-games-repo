import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {verifyFinalRound} from '../../lib/finalPracticeFairness.js';
const config=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL))throw Error('Final games tests require isolated Supabase');
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let email,password,owner,other;
test.beforeAll(async()=>{
 email='final-'+crypto.randomUUID()+'@example.invalid';password='Local-'+crypto.randomUUID()+'-A7!';
 const a=await admin.auth.admin.createUser({email,password,email_confirm:true});if(a.error)throw a.error;
 owner=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false}});expect((await owner.auth.signInWithPassword({email,password})).error).toBeNull();
 const bEmail='other-'+crypto.randomUUID()+'@example.invalid';expect((await admin.auth.admin.createUser({email:bEmail,password,email_confirm:true})).error).toBeNull();
 other=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false}});expect((await other.auth.signInWithPassword({email:bEmail,password})).error).toBeNull();
});
async function call(client,body){const {data,error}=await client.functions.invoke('ig-final-practice',{body});if(error)throw Error((await error.context?.clone().json().catch(()=>null))?.error||error.message);return data.state;}
for(const [game,route] of [['darts','PlayDarts'],['dicezone','PlayDiceZone'],['hilo','PlayHiLo'],['towers','PlayTowers']]){
 test(route+' plays a real local server round and verifies its proof after reload',async({page})=>{
  await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
  await page.goto('/'+route);await page.getByRole('button',{name:'Commit round',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start committed round',exact:true})).toBeVisible();
  await page.getByLabel('Client seed',{exact:true}).fill('final-ui-🎲');await page.getByRole('button',{name:'Start committed round',exact:true}).click();
  if(game==='hilo'||game==='towers'){
   await expect(page.getByRole('button',{name:'Stop and reveal proof',exact:true})).toBeVisible();await page.reload();
   await expect(page.getByRole('button',{name:'Stop and reveal proof',exact:true})).toBeVisible();
   await page.getByRole('button',{name:game==='hilo'?'Same':'Floor 1 tile 1',exact:true}).click();
   await expect(page.getByText('Loading round…',{exact:true})).toHaveCount(0);
   const state=await call(owner,{action:'current',game});
   if(state.phase==='active')await page.getByRole('button',{name:'Stop and reveal proof',exact:true}).click();
  }
  await expect(page.getByText('Fairness proof verified on your device',{exact:false})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
  const state=await call(owner,{action:'current',game});
  const raw=await other.from('ig_final_practice_rounds').select('*');expect(raw.error).not.toBeNull();
  const conflict=await other.functions.invoke('ig-final-practice',{body:{action:'start',game,roundId:state.roundId,requestId:crypto.randomUUID(),version:0,clientSeed:'other'}});expect(conflict.error?.context?.status).toBe(409);
  const commit=await call(owner,{action:'commit',game,roundId:state.roundId,options:state.options});
  expect(await verifyFinalRound({...commit,clientSeed:'final-ui-🎲'},state)).toBe(true);
 });
}
test('Rocket joins the existing server-owned Crash flight without changing financial wallets',async()=>{
 const result=await owner.functions.invoke('ig-crash-v2',{body:{action:'join'}});expect(result.error).toBeNull();expect(result.data.state.practiceOnly).toBe(true);
 const user=await owner.auth.getUser();const balances=await owner.from('wallets').select('cent_balance,igd_balance,igt_balance').eq('user_id',user.data.user.id).single();expect(balances.error).toBeNull();
 expect(Object.values(balances.data).reduce((sum,n)=>sum+Number(n),0)).toBe(0);
});
