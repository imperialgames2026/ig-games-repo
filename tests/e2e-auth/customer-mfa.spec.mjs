import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';

const config=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL))throw Error('MFA acceptance requires disposable local Supabase');
const client=()=>createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
// Test-side RFC 6238 code generator only; production validation belongs to Auth.
function totp(secret,now=Date.now()){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of secret.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid fixture secret');bits+=n.toString(2).padStart(5,'0');}
 const key=Buffer.from(bits.match(/.{8}/g).map(byte=>parseInt(byte,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(now/30000)));
 const digest=createHmac('sha1',key).update(counter).digest();const offset=digest.at(-1)&15;
 return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
async function nextCode(secret){
 await new Promise(resolve=>setTimeout(resolve,30000-Date.now()%30000+300));
 return totp(secret);
}
async function login(page,email,password){
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
test('real TOTP enrollment, wrong-code denial, database/Edge/RPC enforcement, backup factor and removal',async({page})=>{
 test.setTimeout(150000);
 const email=`mfa-${randomUUID()}@example.invalid`,password=`Local-${randomUUID()}-aA7!`;
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();
 const id=created.data.user.id;
 try{
  await login(page,email,password);await page.goto('/Profile');
  await page.getByLabel('Authenticator name',{exact:true}).fill('Primary phone');
  await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
  await page.getByText('Show manual setup key',{exact:true}).click();
  const secret=(await page.locator('details code').textContent()).trim();
  const expired=totp(secret,Date.now()-600000);
  await page.getByLabel('Authenticator code',{exact:true}).fill(expired);
  await page.getByRole('button',{name:'Enable authenticator',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  await page.getByLabel('Authenticator code',{exact:true}).fill(totp(secret));
  await page.getByRole('button',{name:'Enable authenticator',exact:true}).click();
  await expect(page.getByText('Enabled · 1 verified authenticator',{exact:true})).toBeVisible();
  // Independent password-only session, bypassing all app UI.
  const low=client();expect((await low.auth.signInWithPassword({email,password})).error).toBeNull();
  const factors=await low.auth.mfa.listFactors();expect(factors.error).toBeNull();
  const primary=factors.data.totp[0].id;
  const profiles=await low.from('profiles').select('id').eq('id',id);
  expect(profiles.error).toBeNull();expect(profiles.data).toEqual([]);
  const denied=await low.functions.invoke('ig-support-v1',{body:{action:'mine'}});
  expect(denied.error?.context?.status).toBe(403);
  expect((await low.rpc('ign_action',{p_action:'demo_grant',p_operation_id:randomUUID()})).error?.code).toBe('42501');
  expect((await low.auth.mfa.unenroll({factorId:primary})).error).toBeTruthy();
  const bad=await low.auth.mfa.challengeAndVerify({factorId:primary,code:expired});expect(bad.error).toBeTruthy();
  expect((await low.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel).toBe('aal1');
  // Re-login via browser must show the challenge before profile information.
  await page.evaluate(async()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));if(key)localStorage.removeItem(key);});
  await login(page,email,password);
  await expect(page.getByRole('heading',{name:'Two-step verification',exact:true})).toBeVisible();
  await page.getByLabel('Authenticator code',{exact:true}).fill(await nextCode(secret));
  await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Two-step verification',exact:true})).toHaveCount(0);
  await page.goto('/Profile');
  await expect(page.getByRole('heading',{name:'Profile Settings',exact:true})).toBeVisible();
  // Add independent backup using its own key, then remove the primary with the backup.
  await page.getByLabel('Authenticator name',{exact:true}).fill('Backup device');
  await page.getByRole('button',{name:'Add backup authenticator',exact:true}).click();
  await page.getByText('Show manual setup key',{exact:true}).click();
  const backupSecret=(await page.locator('details code').textContent()).trim();
  await page.getByLabel('Authenticator code',{exact:true}).fill(totp(backupSecret));
  await page.getByRole('button',{name:'Enable authenticator',exact:true}).click();
  await expect(page.getByText('Enabled · 2 verified authenticators',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Remove Primary phone',exact:true}).click();
  await page.getByLabel('Verify with',{exact:true}).selectOption({label:'Backup device'});
  await page.getByLabel('Authenticator code',{exact:true}).fill(await nextCode(backupSecret));
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();
  await expect(page.getByText('Enabled · 1 verified authenticator',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Remove Backup device',exact:true})).toBeVisible();
 }finally{expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();}
});
