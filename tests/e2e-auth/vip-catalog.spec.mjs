import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('VIP checks require isolated local Supabase');
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function account(role='player'){
 const email='vip-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const result=await service.auth.admin.createUser({email,password,email_confirm:true});expect(result.error).toBeNull();
 const user=result.data.user;
 if(role!=='player')expect((await service.from('user_roles').update({role}).eq('user_id',user.id)).error).toBeNull();
 return {...user,email,password};
}
async function login(page,user){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);}
test('player VIP uses wallet XP, all 34 published levels, and a real maximum rank',async({page})=>{
 const player=await account();
 try{
  await login(page,player);await page.goto('/VIP');
  await expect(page.getByRole('heading',{name:'△ Beginner',exact:true})).toBeVisible();
  expect((await service.from('wallets').update({experience_points:1500000000,vip_level:0}).eq('user_id',player.id)).error).toBeNull();
  await page.reload();await expect(page.getByRole('heading',{name:'✧ Eternal I',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Eternal I – Eternal X/}).click();await expect(page.getByText('10,000,000,000 XP',{exact:true})).toBeVisible();
  expect((await service.from('wallets').update({experience_points:10000000000}).eq('user_id',player.id)).error).toBeNull();
  await page.reload();await expect(page.getByRole('heading',{name:'✧ Eternal X',exact:true})).toBeVisible();await expect(page.getByText('You reached the top VIP rank.')).toBeVisible();
  await page.goto('/Profile');await expect(page.getByRole('heading',{name:'✧ Eternal X',exact:true})).toBeVisible();
  await page.goto('/AdminVIP');await expect(page.getByRole('heading',{name:'VIP Level Settings',exact:true})).toHaveCount(0);
 }finally{await service.auth.admin.deleteUser(player.id);}
});
test('superadmin publishes validated thresholds; stale edits and ordinary admin writes are denied',async({page,browser})=>{
 const owner=await account('superadmin'),staff=await account('admin');
 const snapshot=await service.from('ig_vip_catalog').select('id,levels,revision').eq('id',1).single();expect(snapshot.error).toBeNull();
 const context=await browser.newContext({baseURL:test.info().project.use.baseURL});
 try{
  await login(page,owner);await page.goto('/AdminVIP');await page.getByRole('button',{name:'Edit XP thresholds'}).click();
  await page.getByLabel('Bronze I required XP',{exact:true}).fill('0');await page.getByRole('button',{name:'Publish VIP schedule'}).click();await expect(page.getByRole('alert')).toContainText('increasing whole-number XP');
  const before=await service.from('wallets').select('*').eq('user_id',owner.id).single();
  await page.getByLabel('Bronze I required XP',{exact:true}).fill('1100');await page.getByRole('button',{name:'Publish VIP schedule'}).click();await expect(page.getByRole('status')).toHaveText('VIP schedule published.');
  const saved=await service.from('ig_vip_catalog').select('levels,revision').eq('id',1).single();expect(saved.data.levels[1].xp_required).toBe(1100);expect(saved.data.revision).toBe(snapshot.data.revision+1);
  expect((await service.from('wallets').select('*').eq('user_id',owner.id).single()).data).toEqual(before.data);
  await page.getByRole('button',{name:'Edit XP thresholds'}).click();await page.getByLabel('Bronze I required XP',{exact:true}).fill('1200');
  expect((await service.from('ig_vip_catalog').update({levels:snapshot.data.levels}).eq('id',1)).error).toBeNull();
  await page.getByRole('button',{name:'Publish VIP schedule'}).click();await expect(page.getByRole('alert').first()).toContainText('schedule changed');await expect(page.getByLabel('Bronze I required XP',{exact:true})).toHaveValue('1200');
  const staffPage=await context.newPage();await login(staffPage,staff);await staffPage.goto('/AdminVIP');await expect(staffPage.getByRole('heading',{name:'VIP Level Settings'})).toBeVisible();await expect(staffPage.getByRole('button',{name:'Edit XP thresholds'})).toHaveCount(0);await expect(staffPage.getByText('Only a superadmin can publish changes.')).toBeVisible();
  await page.getByRole('button',{name:'Discard draft and reload'}).click();await expect(page.getByRole('button',{name:'Edit XP thresholds'})).toBeVisible();
 }finally{
  await service.from('ig_vip_catalog').update({levels:snapshot.data.levels}).eq('id',1);
  await context.close();await service.auth.admin.deleteUser(owner.id);await service.auth.admin.deleteUser(staff.id);
 }
});
