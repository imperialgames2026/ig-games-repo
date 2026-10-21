import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Announcement checks require isolated local Supabase');
const admin=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
test('canonical admin creates, publishes, edits and archives a banner through the real app',async({page})=>{
 const email='announce-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const account=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(account.error).toBeNull();
 expect((await admin.from('user_roles').update({role:'admin'}).eq('user_id',account.data.user.id)).error).toBeNull();
 const title='Release notice '+crypto.randomUUID();
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
 await page.goto('/AdminAnnouncements');await expect(page.getByRole('heading',{name:'Manage Announcements'})).toBeVisible();
 await page.getByLabel('Title',{exact:true}).fill(title);await page.getByLabel('Message',{exact:true}).fill('New verified practice release');await page.getByLabel('Priority',{exact:true}).fill('1000');await page.getByLabel('Active',{exact:true}).check();
 await page.getByRole('button',{name:'Create',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Announcement saved.');
 const row=page.getByRole('article').filter({hasText:title});await expect(row).toBeVisible();
 await page.goto('/Games');await expect(page.getByText(title,{exact:true})).toBeVisible();
 const publicClient=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});
 const published=await publicClient.from('ig_announcements').select('id,title,revision').eq('title',title);expect(published.error).toBeNull();expect(published.data).toHaveLength(1);
 expect((await publicClient.from('ig_announcements').select('created_by')).error?.code).toBe('42501');
 await page.goto('/AdminAnnouncements');await page.getByRole('button',{name:'Edit '+title,exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('Updated practice notice');await page.getByRole('button',{name:'Update',exact:true}).click();await expect(page.getByRole('article').filter({hasText:title})).toContainText('Updated practice notice');
 await page.getByRole('button',{name:'Archive '+title,exact:true}).click();await expect(page.getByRole('status')).toHaveText('Announcement archived.');
 await expect.poll(async()=>{const r=await publicClient.from('ig_announcements').select('id').eq('title',title);if(r.error)throw r.error;return r.data.length;}).toBe(0);
 await page.goto('/Games');await expect(page.getByText(title,{exact:true})).toHaveCount(0);
});
test('admin can page beyond 100 rows and archive astral text; public expiry ignores browser clock',async({page,browser})=>{
 const email='announce-page-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const account=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(account.error).toBeNull();
 expect((await admin.from('user_roles').update({role:'admin'}).eq('user_id',account.data.user.id)).error).toBeNull();
 const ids=Array.from({length:101},()=>crypto.randomUUID()),target=crypto.randomUUID(),title='🎲'.repeat(81);
 try{
  const rows=ids.map((id,i)=>({id,title:'Pagination fixture '+i,message:'Local-only fixture',type:'special',is_active:false,priority:999,created_at:'2001-01-01T00:00:00Z'}));
  rows.push({id:target,title,message:'Local-only clock fixture',type:'special',is_active:true,priority:-1000,created_at:'2000-01-01T00:00:00Z',expires_at:new Date(Date.now()+3600000).toISOString()});
  expect((await admin.from('ig_announcements').insert(rows)).error).toBeNull();
  const publicContext=await browser.newContext();
  try{
   await publicContext.addInitScript(()=>{const Original=Date;globalThis.Date=class extends Original{constructor(...args){super(...(args.length?args:[Original.now()+86400000]));}static now(){return Original.now()+86400000;}};});
   const publicPage=await publicContext.newPage();await publicPage.goto('/Games');
   await expect(publicPage.getByText(title,{exact:true})).toBeVisible();
  }finally{await publicContext.close();}
  await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);
  await page.goto('/AdminAnnouncements');await expect(page.getByText('Page 1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Next page',exact:true}).click();
  await expect(page.getByRole('article').filter({hasText:title})).toBeVisible();
  await page.getByRole('button',{name:'Archive '+title,exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Announcement archived.');
  expect((await admin.from('ig_announcements').select('is_active').eq('id',target).single()).data.is_active).toBe(false);
 }finally{
  await admin.from('ig_announcements').delete().in('id',[...ids,target]);
  await admin.auth.admin.deleteUser(account.data.user.id);
 }
});
