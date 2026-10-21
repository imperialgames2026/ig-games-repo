import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Wheel checks require isolated local Supabase');
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function account(role='player'){
 const email='wheel-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const result=await service.auth.admin.createUser({email,password,email_confirm:true});expect(result.error).toBeNull();const user=result.data.user;
 if(role!=='player')expect((await service.from('user_roles').update({role}).eq('user_id',user.id)).error).toBeNull();
 return {...user,email,password};
}
async function login(page,user){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);}
test('VIP levels earn one saved spin each, retain 11/13/10 stage counts and never expose another owner',async({page})=>{
 const player=await account(),other=await account();
 try{
  await login(page,player);await page.goto('/VIP');const wheel=page.getByRole('region',{name:'VIP Reward Wheel',exact:true});
  await expect(wheel.getByRole('status')).toHaveText('1 saved spin');
  for(const [xp,total,stage2,stage3] of [[2000000,12,1,0],[1000000000,24,13,0],[1500000000,25,13,1],[10000000000,34,13,10]]){
   expect((await service.from('wallets').update({experience_points:xp}).eq('user_id',player.id)).error).toBeNull();await page.reload();
   await expect(wheel.getByRole('status')).toHaveText(total+' saved spins');await expect(wheel.getByRole('article',{name:'Stage 2 reward wheel'})).toContainText(stage2+' saved spins');await expect(wheel.getByRole('article',{name:'Stage 3 reward wheel'})).toContainText(stage3+' saved spins');
  }
  await expect(wheel.getByRole('article',{name:'Stage 1 reward wheel'})).toContainText('11 saved spins');await expect(wheel.getByRole('button',{name:'Spinning opens when prizes are ready'})).toBeDisabled();
  await wheel.getByText('Earned spin history',{exact:true}).click();await expect(wheel.getByRole('row')).toHaveCount(35);
  await page.goto('/Bonuses');await expect(page.getByRole('region',{name:'VIP Reward Wheel'}).getByRole('status')).toHaveText('34 saved spins');await expect(page.getByText(/Jackpot on spin #500,000/)).toHaveCount(0);
  const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});expect((await client.auth.signInWithPassword({email:other.email,password:other.password})).error).toBeNull();
  expect((await client.from('ig_vip_level_spins').select('level').eq('user_id',player.id)).data).toHaveLength(0);
  expect((await client.from('ig_vip_wheel_settings').select('stage,segments')).data).toHaveLength(0);
  const own=await client.from('ig_vip_level_spins').select('level').eq('user_id',other.id);expect(own.data).toHaveLength(1);
 }finally{await service.auth.admin.deleteUser(player.id);await service.auth.admin.deleteUser(other.id);}
});
test('superadmin edits every wheel section, exact amounts and weights; ordinary admins remain read-only',async({page,browser})=>{
 const owner=await account('superadmin'),staff=await account('admin');const before=await service.from('ig_vip_wheel_settings').select('stage,segments').order('stage');expect(before.error).toBeNull();
 const context=await browser.newContext({baseURL:test.info().project.use.baseURL});
 try{
  await login(page,owner);await page.goto('/AdminRewardWheels');await expect(page.getByRole('heading',{name:'Reward Wheel Settings'})).toBeVisible();
  const walletBefore=await service.from('wallets').select('*').eq('user_id',owner.id).single();
  for(const stage of [1,2,3]){
   await page.getByRole('button',{name:new RegExp('^Stage '+stage)}).click();await page.getByRole('button',{name:'Edit stage '+stage+' rewards',exact:true}).click();
   await page.getByLabel('Section 1 reward',{exact:true}).fill('Owner reward '+stage);await page.getByLabel('Section 1 amount',{exact:true}).fill('9999999999999999.12345678');await page.getByLabel('Section 1 unit',{exact:true}).fill('IGT');await page.getByLabel('Section 1 weight',{exact:true}).fill('50');await page.getByLabel('Section 1 notes',{exact:true}).fill('Draft reward rules for stage '+stage);
   await page.getByRole('button',{name:'Save stage '+stage+' rewards',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Stage '+stage+' settings saved.');
   const saved=await service.from('ig_vip_wheel_settings').select('segments').eq('stage',stage).single();expect(saved.data.segments[0]).toMatchObject({reward:'Owner reward '+stage,amount:'9999999999999999.12345678',unit:'IGT',weight:50});
  }
  expect((await service.from('wallets').select('*').eq('user_id',owner.id).single()).data).toEqual(walletBefore.data);
  await page.reload();await page.getByRole('button',{name:/^Stage 3/}).click();await expect(page.getByLabel('Section 1 amount',{exact:true})).toHaveValue('9999999999999999.12345678');
  await page.getByRole('button',{name:'Edit stage 3 rewards'}).click();await page.getByLabel('Section 1 amount',{exact:true}).fill('1e3');await page.getByRole('button',{name:'Save stage 3 rewards'}).click();await expect(page.getByRole('alert')).toContainText('8 decimal places');
  await page.getByLabel('Section 1 amount',{exact:true}).fill('42.25');
  expect((await service.from('ig_vip_wheel_settings').update({segments:before.data[2].segments}).eq('stage',3)).error).toBeNull();
  await page.getByRole('button',{name:'Save stage 3 rewards'}).click();await expect(page.getByRole('alert')).toContainText('wheel changed');await expect(page.getByLabel('Section 1 amount',{exact:true})).toHaveValue('42.25');
  await page.getByRole('button',{name:'Discard stage 3 draft and reload'}).click();
  const otherPage=await context.newPage();await login(otherPage,staff);await otherPage.goto('/AdminRewardWheels');await expect(otherPage.getByText('Only a superadmin can change wheel rewards.')).toBeVisible();await expect(otherPage.getByRole('button',{name:/Edit stage/})).toHaveCount(0);await expect(otherPage.getByLabel('Section 1 amount',{exact:true})).toBeDisabled();
 }finally{
  for(const row of before.data??[])await service.from('ig_vip_wheel_settings').update({segments:row.segments}).eq('stage',row.stage);
  await context.close();await service.auth.admin.deleteUser(owner.id);await service.auth.admin.deleteUser(staff.id);
 }
});
