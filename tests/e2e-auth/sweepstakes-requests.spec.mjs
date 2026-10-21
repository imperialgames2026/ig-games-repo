import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Request checks require isolated local Supabase');
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function account(role='player'){
 const email='intake-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const result=await service.auth.admin.createUser({email,password,email_confirm:true});expect(result.error).toBeNull();
 const user=result.data.user;
 if(role!=='player')expect((await service.from('user_roles').update({role}).eq('user_id',user.id)).error).toBeNull();
 return {...user,email,password};
}
async function login(page,user){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);}
test('player submits AMOE and a KYC-checked prize request; owner history and admin audit use real Supabase',async({page})=>{
 const player=await account();await login(page,player);
 const before=await service.from('wallets').select('*').eq('user_id',player.id).single();expect(before.error).toBeNull();
 await page.goto('/AMOE');await page.getByLabel('Entries requested',{exact:true}).fill('3');await page.getByRole('button',{name:'Submit Free Entry',exact:true}).click();await expect(page.getByRole('status')).toContainText('recorded as pending');await expect(page.getByRole('article')).toContainText('3 entries requested · pending');
 await page.reload();await expect(page.getByRole('article')).toContainText('3 entries requested · pending');
 await page.goto('/PrizeClaims');await expect(page.getByRole('button',{name:'Submit Prize Claim'})).toBeDisabled();
 expect((await service.from('profiles').update({kyc_status:'approved'}).eq('id',player.id)).error).toBeNull();
 await page.reload();await expect(page.getByRole('button',{name:'Submit Prize Claim'})).toBeEnabled();
 await page.getByLabel('Amount',{exact:true}).fill('19.25');await page.getByLabel('Network',{exact:true}).fill('SOL');await page.getByLabel('Wallet Address',{exact:true}).fill('ExampleDeliveryAddress123');await page.getByRole('button',{name:'Submit Prize Claim'}).click();await expect(page.getByRole('status')).toContainText('submitted for review');await expect(page.getByText('Crypto Prize · 19.25',{exact:true})).toBeVisible();
 const after=await service.from('wallets').select('*').eq('user_id',player.id).single();expect(after.data).toEqual(before.data);
 const claims=await service.from('ig_prize_claim_requests').select('*').eq('user_id',player.id);expect(claims.data).toHaveLength(1);expect(claims.data[0].amount).toBe('19.25');expect(claims.data[0].status).toBe('submitted');
 const staff=await account('admin');await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());await login(page,staff);
 await page.goto('/AdminSweepstakesAudit');await expect(page.getByRole('heading',{name:'Sweepstakes Audit Trail'})).toBeVisible();await expect(page.getByText(player.id,{exact:true})).toBeVisible();await page.getByRole('tab',{name:'Prize Claims',exact:true}).click();await expect(page.getByText(player.id,{exact:true})).toBeVisible();await expect(page.getByText('Wallet: ExampleDeliveryAddress123',{exact:true})).toBeVisible();
 const other=await account();const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});expect((await client.auth.signInWithPassword({email:other.email,password:other.password})).error).toBeNull();expect((await client.from('ig_prize_claim_requests').select('id').eq('user_id',player.id)).data).toHaveLength(0);
});
