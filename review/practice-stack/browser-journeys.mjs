import assert from 'node:assert/strict';
import {assertLocal} from './policy.mjs';
export async function verifyLoginAndRecovery({browser,email,password}){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('runtime approval interlock missing');
 if(!email.endsWith('@example.invalid'))throw Error('synthetic identities only');
 const origin=assertLocal('http://127.0.0.1:4173');
 const context=await browser.newContext();
 await context.route('**/*',r=>{let u;try{u=new URL(r.request().url());}catch{return r.abort();}return ['http://127.0.0.1:4173','http://127.0.0.1:54321'].includes(u.origin)?r.continue():r.abort();});
 const page=await context.newPage();let authCalls=0;
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:54321/auth/v1/token')&&r.status()===200)authCalls++;});
 try{
 await page.goto(origin+'/Profile');await page.waitForURL('**/login');
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByPlaceholder('Enter your name').waitFor();assert.ok(authCalls>0,'real Auth token response required');
 await page.reload();await page.getByPlaceholder('Enter your name').waitFor();
 await context.setOffline(true);await page.waitForTimeout(100);await context.setOffline(false);
 await page.reload();await page.getByPlaceholder('Enter your name').waitFor();
 await page.goto(origin+'/AdminUsers');await page.waitForURL(origin+'/');
 return {login:true,sessionReload:true,offlineReturn:true,unauthorizedAdminDenied:true,gameJourneys:false};
 }finally{await context.close();}
}
