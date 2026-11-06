import {test,expect} from '@playwright/test';

test.use({launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}});
async function publicFixture(page){
 const actor='11111111-1111-4111-8111-111111111111';
 const user={id:actor,email:'navigation-fixture@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{}};
 const payload=Buffer.from(JSON.stringify({sub:actor,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 await page.addInitScript(({user,payload})=>localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify({access_token:`e30.${payload}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})),{user,payload});
 await page.route('https://qonqemhljgxlwpghkxhn.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const data=path==='/auth/v1/user'?user:path==='/rest/v1/user_roles'?[{role:'player'}]:path==='/rest/v1/profiles'?[{id:actor,email:user.email,display_name:'Synthetic Player',is_excluded:false}]:[];
  return route.fulfill({status:req.method()==='OPTIONS'?204:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:req.method()==='OPTIONS'?undefined:JSON.stringify(data)});
 });
}
for(const reducedMotion of ['no-preference','reduce']){
 test(`mobile fairness to Home navigation keeps content painted (${reducedMotion})`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion});await publicFixture(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/FairnessManifesto');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.locator('div.fixed.bottom-0').getByRole('link',{name:'Home',exact:true}).click();
  await expect(page).toHaveURL(/\/Home$/);
  const hero=page.getByRole('heading',{level:1}).filter({hasText:'IMPERIAL'});
  await expect(hero).toBeVisible();
  const content=page.locator('main > .w-full').filter({has:hero});
  await expect(content).toHaveCSS('opacity','1');
  await expect(page.getByText('Practice chips have no cash value.',{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
 });
}
