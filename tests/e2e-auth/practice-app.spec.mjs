import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';

// This suite creates fixtures only in the isolated local Supabase instance.
const config=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
const url=config.API_URL;
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(url))throw Error('Authenticated tests require isolated local Supabase');
const admin=createClient(url,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const fixtures=[];
let password;
test.beforeAll(async()=>{
 password='Local-'+crypto.randomUUID()+'-aA7!';
 for(let i=0;i<2;i++){
  const email=`practice-${crypto.randomUUID()}@example.invalid`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw error;fixtures.push({id:data.user.id,email});
 }
});
async function signin(page,i=0){
 await page.goto('/login', {waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'Email',exact:true}).fill(fixtures[i].email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).not.toHaveURL(/\/login$/);
}
test('registered player has a canonical role and can save a one-time display name',async({page})=>{
 await signin(page);await page.goto('/Profile', {waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:/profile/i}).first()).toBeVisible();
 const {data,error}=await admin.from('user_roles').select('role').eq('user_id',fixtures[0].id).single();
 expect(error).toBeNull();expect(data.role).toBe('player');
 await page.getByPlaceholder('Choose a username').fill('Local player');
 await page.getByRole('button',{name:'Save',exact:true}).last().click();
 await expect(page.getByText('Display name saved!',{exact:true})).toBeVisible();
});
test('player can open a private support case and another account cannot read it',async({page})=>{
 await signin(page);await page.goto('/Support', {waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'New ticket'}).click();
 await page.getByLabel('Ticket subject').fill('Authenticated readiness check');
 await page.getByLabel('Ticket message').fill('Practice game support test');
 await page.getByRole('button',{name:'Submit ticket'}).click();
 await expect(page.getByText('Support ticket created. Our team can now review it.')).toBeVisible();
 await expect(page.getByText('Practice game support test',{exact:true})).toBeVisible();
 const id=new URL(page.url()).searchParams.get('ticket');
 const other=createClient(url,config.ANON_KEY,{auth:{persistSession:false}});
 const login=await other.auth.signInWithPassword({email:fixtures[1].email,password});expect(login.error).toBeNull();
 const result=await other.functions.invoke('ig-support-v1',{body:{action:'messages',ticketId:id}});
 expect(result.error?.context?.status).toBe(404);
});
test('parked games do not mount their practice engines after real sign-in',async({page})=>{
 await signin(page);const calls=[];page.on('request',req=>{const path=new URL(req.url()).pathname;if(/\/functions\/v1\/(ig-originals-practice|ig-mines-practice|ig-final-practice|provably-fair-v2)$/.test(path))calls.push(path);});
 for(const route of ['PlayDice','PlayDarts','PlayDiceZone','PlayHiLo','PlayTowers','PlayRocket','PlayCoinFlip','PlayHashDice','PlayLimbo','PlayPlinko','PlayWheel','PlayMines','PlaySlots']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:/is not accepting wagers/})).toBeVisible();
 }
 expect(calls).toEqual([]);
});
test('financial routes cannot prepare funding or redemption requests after real sign-in',async({page})=>{
 await signin(page);const calls=[];page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/functions/v1/ig-payment-requests'||path==='/rest/v1/ig_prize_claim_requests')calls.push(path);});
 for(const route of ['Payments','Withdraw','CryptoWallet','DepositNetworks','PrizeClaims']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Financial services are disabled',exact:true})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);
 }
 expect(calls).toEqual([]);
});
test('a recovery link can set a new password and the new password signs in',async({page})=>{
 const {data,error}=await admin.auth.admin.generateLink({type:'recovery',email:fixtures[1].email,options:{redirectTo:'http://127.0.0.1:4173/ResetPassword'}});
 expect(error).toBeNull();
 const action=new URL(data.properties.action_link);
 expect(action.origin).toBe(url);
 await page.goto(action.toString(),{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();
 const replacement='Local-'+crypto.randomUUID()+'-bB8!';
 await page.getByLabel('New password',{exact:true}).fill(replacement);
 await page.getByLabel('Confirm new password',{exact:true}).fill(replacement);
 await page.getByRole('button',{name:'Update password',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Password updated.');
 const check=createClient(url,config.ANON_KEY,{auth:{persistSession:false}});
 const result=await check.auth.signInWithPassword({email:fixtures[1].email,password:replacement});
 expect(result.error).toBeNull();expect(result.data.user.id).toBe(fixtures[1].id);
});
