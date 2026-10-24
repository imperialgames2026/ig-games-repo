import { test, expect } from '@playwright/test';
const api='https://qonqemhljgxlwpghkxhn.supabase.co';
const user={id:'11111111-1111-4111-8111-111111111111',email:'mfa@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{}};
const factor={id:'22222222-2222-4222-8222-222222222222',friendly_name:'My phone',factor_type:'totp',status:'verified'};
function session(state){
  const exp=Math.floor(Date.now()/1000)+3600;
  const payload=Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',aud:'authenticated',aal:state.aal,exp})).toString('base64url');
  return {access_token:`e30.${payload}.fixture`,refresh_token:'mfa-fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user:{...user,factors:state.factors}};
}
async function fixture(page,{enrolled=false}={}){
  const state={aal:'aal1',factors:enrolled?[factor]:[],privateReads:0,verificationCalls:0,removals:0};
  await page.addInitScript(value=>localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify(value)),session(state));
  await page.route(api+'/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Expose-Headers':'X-Supabase-Api-Version','X-Supabase-Api-Version':'2024-01-01'},body:status===204?undefined:JSON.stringify(data)});
    if(method==='OPTIONS')return reply(null,204);
    if(path==='/auth/v1/user')return reply({...user,factors:state.factors});
    if(path==='/auth/v1/token')return reply(session(state));
    if(path==='/auth/v1/logout')return reply(null,204);
    if(path==='/auth/v1/factors'&&method==='POST'){
      state.factors=[...state.factors,{...factor,status:'unverified'}];
      return reply({...factor,status:'unverified',type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',secret:'JBSWY3DPEHPK3PXP',uri:'otpauth://totp/fixture'}});
    }
    if(path.endsWith('/challenge'))return reply({id:'challenge',expires_at:Math.floor(Date.now()/1000)+300});
    if(path.endsWith('/verify')){
      state.verificationCalls++;
      if(request.postDataJSON().code!=='123456')return reply({code:'mfa_verification_failed',msg:'Invalid TOTP code'},422);
      state.aal='aal2';state.factors=state.factors.map(f=>({...f,status:'verified'}));
      return reply(session(state));
    }
    if(path.startsWith('/auth/v1/factors/')&&method==='DELETE'){
      state.removals++;state.factors=[];state.aal='aal1';return reply({id:factor.id});
    }
    if(path.startsWith('/rest/')||path.startsWith('/functions/'))state.privateReads++;
    if(path==='/rest/v1/profiles')return reply([{id:user.id,email:user.email,full_name:'MFA player',is_excluded:false,kyc_status:'pending'}]);
    if(path==='/rest/v1/user_roles')return reply([{role:'player'}]);
    if(path.startsWith('/rest/'))return reply([]);
    if(path.startsWith('/functions/'))return reply({});
    return reply({error:'Unexpected fixture request'},400);
  });return state;
}
test('password-only enrolled session cannot render profile or fetch account data; wrong code stays blocked',async({page})=>{
  const state=await fixture(page,{enrolled:true});
  await page.goto('/Profile');
  await expect(page.getByRole('heading',{name:'Two-step verification',exact:true})).toBeVisible();
  expect(state.privateReads).toBe(0);
  await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Verify and continue'}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  expect(state.privateReads).toBe(0);
  await page.getByLabel('Authenticator code',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Verify and continue'}).click();
  await expect(page.getByRole('heading',{name:'Profile Settings'})).toBeVisible();
  expect(state.privateReads).toBeGreaterThan(0);
});
test('profile enrollment verifies before enabling and removal requires a fresh code',async({page})=>{
  const state=await fixture(page);
  await page.goto('/Profile');
  await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
  await expect(page.getByRole('img',{name:'Authenticator setup QR code'})).toBeVisible();
  await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Enable authenticator',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  await expect(page.getByText('Not enabled',{exact:true})).toBeVisible();
  await page.getByLabel('Authenticator code',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Enable authenticator',exact:true}).click();
  await expect(page.getByText('Enabled · 1 verified authenticator',{exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'Authenticator setup QR code'})).toHaveCount(0);
  await page.getByRole('button',{name:'Remove My phone',exact:true}).click();
  await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
  await page.getByRole('button',{name:'Confirm removal'}).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  expect(state.removals).toBe(0);
  await page.getByLabel('Authenticator code',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Confirm removal'}).click();
  await expect(page.getByText('Not enabled',{exact:true})).toBeVisible();
  expect(state.removals).toBe(1);
});
test('canceling setup removes only the pending factor and exposes no setup key afterwards',async({page})=>{
  const state=await fixture(page);
  await page.goto('/Profile');
  await page.getByRole('button',{name:'Set up authenticator',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Set up authenticator',exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'Authenticator setup QR code'})).toHaveCount(0);
  expect(state.removals).toBe(1);expect(state.verificationCalls).toBe(0);
});

test('lost-all-factors recovery route offers no password-reset or enrollment bypass',async({page})=>{
 const state=await fixture(page,{enrolled:true});
 await page.goto('/ResetPassword');
 await expect(page.getByRole('heading',{name:'Two-step verification',exact:true})).toBeVisible();
 await expect(page.getByText('Account recovery is not available in this release.',{exact:false})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Choose a new password',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Set up authenticator',exact:true})).toHaveCount(0);
 expect(state.privateReads).toBe(0);expect(state.removals).toBe(0);
 await page.getByLabel('Authenticator code',{exact:true}).fill('000000');
 await page.getByRole('button',{name:'Verify and continue'}).click();
 await expect(page.getByRole('alert')).toContainText('invalid or expired');
 expect(state.privateReads).toBe(0);expect(state.removals).toBe(0);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page).toHaveURL(/\/login$/);
});
