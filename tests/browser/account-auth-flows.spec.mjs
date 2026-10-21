import { test, expect } from '@playwright/test';

// The real Supabase JS client talks only to intercepted fixtures in this suite.
// These tests do not send mail or create hosted users.
const api = 'https://qonqemhljgxlwpghkxhn.supabase.co';
const storageKey = 'sb-qonqemhljgxlwpghkxhn-auth-token';
const userA = { id:'11111111-1111-4111-8111-111111111111',email:'account-a@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{} };
const userB = { ...userA,id:'22222222-2222-4222-8222-222222222222',email:'account-b@example.invalid' };
function session(user) {
  const exp = Math.floor(Date.now()/1000)+3600;
  const payload = Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aud:'authenticated',exp})).toString('base64url');
  return { access_token:`e30.${payload}.fixture`,refresh_token:'fixture-'+user.id,token_type:'bearer',expires_in:3600,expires_at:exp,user };
}
async function setup(page,{signedIn=false,unconfirmed=false}={}) {
  const state = { user:userA, calls:[], unconfirmed };
  if (signedIn) await page.addInitScript(({key,value})=>{
    // Seed once per tab, so a later navigation cannot undo a tested sign-out.
    if (!sessionStorage.getItem('auth-fixture-seeded')) {
      localStorage.setItem(key,JSON.stringify(value));
      sessionStorage.setItem('auth-fixture-seeded','true');
    }
  },{key:storageKey,value:session(userA)});
  await page.route(api+'/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    const body=request.postDataJSON();
    // Modern Auth error codes require the API version header, exposed over CORS.
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Expose-Headers':'X-Supabase-Api-Version','X-Supabase-Api-Version':'2024-01-01'},body:status===204?undefined:JSON.stringify(data)});
    if(method==='OPTIONS')return reply(null,204);
    state.calls.push({path,method,body,search:url.search});
    if(path==='/auth/v1/token') {
      if(state.unconfirmed)return reply({code:'email_not_confirmed',msg:'Email not confirmed'},400);
      return reply(session(state.user));
    }
    if(path==='/auth/v1/signup')return reply({user:state.user,session:null});
    if(['/auth/v1/resend','/auth/v1/recover'].includes(path))return reply({});
    if(path==='/auth/v1/logout')return reply(null,204);
    if(path==='/auth/v1/user')return reply(state.user);
    if(path==='/rest/v1/profiles')return reply([{id:state.user.id,email:state.user.email,full_name:state.user.id===userA.id?'Account A':'Account B',is_excluded:false,kyc_status:'pending'}]);
    if(path==='/rest/v1/user_roles')return reply([{role:'player'}]);
    if(path.startsWith('/rest/v1/'))return reply([]);
    if(path.startsWith('/functions/v1/'))return reply({});
    return reply({error:'Unexpected test request'},400);
  });
  return state;
}

test('signup checks password confirmation, retains email and offers a rate-limited resend',async({page})=>{
  const state=await setup(page);
  await page.clock.install();
  await page.goto('/login?mode=signup');
  await page.getByLabel('Full name',{exact:true}).fill('New player');
  await page.getByLabel('Email',{exact:true}).fill(userA.email);
  await page.getByLabel('Password',{exact:true}).fill('Example-aA7!');
  await page.getByLabel('Confirm password',{exact:true}).fill('Different-aA7!');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords must match.');
  expect(state.calls.filter(c=>c.path==='/auth/v1/signup')).toHaveLength(0);
  await page.getByLabel('Confirm password',{exact:true}).fill('Example-aA7!');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Confirm your email'})).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue(userA.email);
  await expect(page.getByRole('button',{name:'Resend confirmation email',exact:true})).toBeDisabled();
  expect(state.calls.filter(c=>c.path==='/auth/v1/signup')).toHaveLength(1);
  await page.clock.runFor(61000);
  await page.getByRole('button',{name:'Resend confirmation email',exact:true}).click();
  await expect(page.getByText('If this address has an account awaiting confirmation, a new link will arrive by email. Check your spam folder too.')).toBeVisible();
  const calls=state.calls.filter(c=>c.path==='/auth/v1/resend');
  expect(calls).toHaveLength(1);expect(calls[0].body.type).toBe('signup');expect(calls[0].body.email).toBe(userA.email);
  expect(new URLSearchParams(calls[0].search).get('redirect_to')).toBe('http://127.0.0.1:4180');
});

test('unconfirmed login offers resend and does not enforce the new-password length on existing accounts',async({page})=>{
  const state=await setup(page,{unconfirmed:true});
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(userA.email);
  await page.getByLabel('Password',{exact:true}).fill('old123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Confirm your email'})).toBeVisible();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue(userA.email);
  expect(state.calls.filter(c=>c.path==='/auth/v1/token')).toHaveLength(1);
});

test('recovery requests use the approved callback and cannot be repeated while cooling down',async({page})=>{
  const state=await setup(page);
  await page.goto('/login?mode=recovery');
  await page.getByLabel('Email',{exact:true}).fill(userA.email);
  await page.getByRole('button',{name:'Send reset link',exact:true}).click();
  await expect(page.getByText('If an account exists for this address, a password reset link will arrive by email.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Send reset link',exact:true})).toBeDisabled();
  const calls=state.calls.filter(c=>c.path==='/auth/v1/recover');
  expect(calls).toHaveLength(1);
  expect(new URLSearchParams(calls[0].search).get('redirect_to')).toBe('http://127.0.0.1:4180/ResetPassword');
});

test('a failed confirmation callback on the homepage reaches the resend screen',async({page})=>{
  await setup(page);
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Untrusted');
  await expect(page.getByRole('heading',{name:'Confirm your email'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
  await expect(page.getByText('Untrusted',{exact:true})).toHaveCount(0);
});

test('an expired recovery link cannot change an existing signed-in account password',async({page})=>{
  const state=await setup(page,{signedIn:true});
  await page.goto('/ResetPassword#error=access_denied&error_code=otp_expired');
  await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
  await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Request a new link',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Reset your password'})).toBeVisible();
  expect(state.calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT')).toHaveLength(0);
});

test('password save survives a same-account USER_UPDATED event without losing success',async({page})=>{
  const state=await setup(page,{signedIn:true});
  await page.goto('/ResetPassword');
  await page.getByLabel('New password',{exact:true}).fill('Updated-aA7!');
  await page.getByLabel('Confirm new password',{exact:true}).fill('Updated-aA7!');
  await page.getByRole('button',{name:'Update password',exact:true}).click();
  await expect(page.getByText('Password updated.',{exact:false})).toBeVisible();
  expect(state.calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT')).toHaveLength(1);
});

test('an account switch clears both an unfinished password form and cached private data',async({page})=>{
  const state=await setup(page,{signedIn:true});
  await page.goto('/ResetPassword');
  await page.getByLabel('New password',{exact:true}).fill('Do-not-save-aA7!');
  await page.evaluate(async()=>{const {queryClientInstance}=await import('/lib/query-client.js');queryClientInstance.setQueryData(['private-sentinel'],{owner:'A'});});
  state.user=userB;
  await page.evaluate(async value=>{const {supabase}=await import('/lib/supabaseClient.js');await supabase.auth.setSession(value);},session(userB));
  await expect(page.getByText('Updating the password for '+userB.email+'.')).toBeVisible();
  await expect(page.getByLabel('New password',{exact:true})).toHaveValue('');
  expect(await page.evaluate(async()=>{const {queryClientInstance}=await import('/lib/query-client.js');return queryClientInstance.getQueryData(['private-sentinel']);})).toBeUndefined();
  expect(state.calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT')).toHaveLength(0);
});

test('sign-out clears cached data and returns protected routes to sign-in',async({page})=>{
  await setup(page,{signedIn:true});
  await page.goto('/ResetPassword');
  await page.getByLabel('New password',{exact:true}).fill('Draft-aA7!');
  await page.evaluate(async()=>{
    const {queryClientInstance}=await import('/lib/query-client.js');queryClientInstance.setQueryData(['private-sentinel'],{owner:'A'});
    const {supabase}=await import('/lib/supabaseClient.js');await supabase.auth.signOut();
  });
  await expect(page.getByText('The reset link is missing or expired.',{exact:false})).toBeVisible();
  expect(await page.evaluate(async()=>{const {queryClientInstance}=await import('/lib/query-client.js');return queryClientInstance.getQueryData(['private-sentinel']);})).toBeUndefined();
  await page.goto('/Profile');
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});
