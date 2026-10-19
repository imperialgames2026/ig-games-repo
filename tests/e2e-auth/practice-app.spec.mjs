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
 await page.getByRole('textbox',{name:'Display name',exact:true}).fill('Local player');
 await page.getByRole('button',{name:'Set display name',exact:true}).click();
 await expect(page.getByText('Local player',{exact:true})).toBeVisible();
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
test('dice commit and reveal is verified in the browser',async({page})=>{
 await signin(page);await page.goto('/PlayDice', {waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/roll/i}).click();
 await expect(page.getByText('✓ Server commitment and dice outcome verified locally',{exact:true})).toBeVisible();
 const {data}=await admin.from('fair_seed_commitments').select('status').eq('user_id',fixtures[0].id);
 expect(data.some(row=>row.status==='revealed')).toBe(true);
});
test('payment preparation records, lists and cancels without moving wallet funds',async({page})=>{
 await signin(page);await page.goto('/Payments', {waitUntil:'domcontentloaded'});
 await page.getByLabel('Amount',{exact:true}).fill('0.01');
 await page.getByRole('button',{name:'Save preparation request'}).click();
 await expect(page.getByRole('status')).toContainText('No funds have moved');
 await expect(page.getByText('Awaiting provider connection',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Cancel request'}).click();
 await expect(page.getByText('Cancelled',{exact:false})).toBeVisible();
 const {data,error}=await admin.from('wallets').select('cent_balance,igd_balance,igt_balance').eq('user_id',fixtures[0].id).single();
 expect(error).toBeNull();expect(Number(data.cent_balance)+Number(data.igd_balance)+Number(data.igt_balance)).toBe(0);
});
test('withdrawal preparation preserves the selected asset, network and destination without debiting funds',async({page})=>{
 await signin(page);await page.goto('/Withdraw',{waitUntil:'domcontentloaded'});
 await expect(page.getByLabel('Request type',{exact:true})).toHaveValue('withdrawal');
 await page.getByLabel('Asset',{exact:true}).selectOption('USDC');
 await page.getByLabel('Network',{exact:true}).selectOption('solana');
 await page.getByLabel('Amount',{exact:true}).fill('1.25');
 const destination='11111111111111111111111111111111';
 await page.getByLabel('Destination address',{exact:true}).fill(destination);
 await page.getByRole('button',{name:'Save preparation request'}).click();
 await expect(page.getByRole('status')).toContainText('No funds have moved');
 const {data,error}=await admin.from('payment_preparation_requests').select('kind,asset,network,amount,destination,status').eq('user_id',fixtures[0].id).eq('kind','withdrawal').single();
 expect(error).toBeNull();expect(data).toEqual({kind:'withdrawal',asset:'USDC',network:'solana',amount:1.25,destination,status:'awaiting_provider'});
 const other=createClient(url,config.ANON_KEY,{auth:{persistSession:false}});
 expect((await other.auth.signInWithPassword({email:fixtures[1].email,password})).error).toBeNull();
 const privateRows=await other.from('payment_preparation_requests').select('id').eq('user_id',fixtures[0].id);
 expect(privateRows.error).toBeNull();expect(privateRows.data).toEqual([]);
 await page.getByRole('button',{name:'Cancel request'}).click();
 await expect(page.locator('article').filter({hasText:'withdrawal'}).getByText('Cancelled',{exact:false})).toBeVisible();
 const wallet=await admin.from('wallets').select('cent_balance,igd_balance,igt_balance').eq('user_id',fixtures[0].id).single();
 expect(wallet.error).toBeNull();expect(Number(wallet.data.cent_balance)+Number(wallet.data.igd_balance)+Number(wallet.data.igt_balance)).toBe(0);
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
