import {test,expect} from '@playwright/test';
import {parkedPracticeGameRoutes,disabledFinancialRoutes} from '../../lib/practiceReleasePolicy.js';

// UI boundary tests only: every backend response is synthetic. This file cannot
// establish real Auth, SQL accounting, concurrency or hosted enforcement.
test.use({launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}});
async function fixture(page){
 const actor='11111111-1111-4111-8111-111111111111';
 const user={id:actor,email:'practice-policy@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{}};
 const payload=Buffer.from(JSON.stringify({sub:actor,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 await page.addInitScript(({user,payload})=>localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify({access_token:`e30.${payload}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})),{user,payload});
 const calls=[];
 await page.route('https://qonqemhljgxlwpghkxhn.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;calls.push({path,method:req.method()});
  let data=[];
  if(path==='/auth/v1/user')data=user;
  if(path==='/rest/v1/user_roles')data=[{role:'player'}];
  if(path==='/rest/v1/profiles')data=[{id:actor,email:user.email,display_name:'Synthetic Player',is_excluded:false}];
  if(path==='/rest/v1/ig_practice_game_catalog')data=[
   {slug:'crash',name:'Synthetic active Crash',route:'/PlayCrash',category:'instant',game_type:'internal',practice_only:true,real_wagers_enabled:false,is_active:true},
   {slug:'mines',name:'Synthetic parked Mines',route:'/PlayMines',category:'instant',game_type:'internal',practice_only:true,real_wagers_enabled:false,is_active:true},
   {slug:'old-slots',name:'Synthetic parked Slots',route:'/PlaySlots',category:'slots',game_type:'internal',practice_only:true,real_wagers_enabled:false,is_active:true},
  ];
  return route.fulfill({status:req.method()==='OPTIONS'?204:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:req.method()==='OPTIONS'?undefined:JSON.stringify(data)});
 });
 return calls;
}
test('catalog does not advertise parked rows even when the server returns them',async({page})=>{
 await fixture(page);await page.goto('/Games');await expect(page.getByRole('heading',{name:'Slots, Originals and Mines are parked'})).toBeVisible();await expect(page.getByText('Synthetic active Crash',{exact:true})).toBeVisible();
 for(const route of [...parkedPracticeGameRoutes,'PlaySlots'])await expect(page.locator(`a[href="/${route}"]`)).toHaveCount(0);
 await expect(page.getByText('Synthetic parked Mines',{exact:true})).toHaveCount(0);await expect(page.getByText('Synthetic parked Slots',{exact:true})).toHaveCount(0);
});
test('direct parked links never mount a game or invoke its backend',async({page})=>{
 const calls=await fixture(page);
 for(const route of [...parkedPracticeGameRoutes,'PlaySlots','PlayHotPot']){await page.goto('/'+route);await expect(page.getByRole('heading',{name:/is not accepting wagers/})).toBeVisible();}
 expect(calls.filter(x=>/\/functions\/v1\/(ig-originals-practice|ig-mines-practice|ig-final-practice|provably-fair-v2)$/.test(x.path))).toEqual([]);
});
test('disabled funding and redemption pages have no forms or request calls',async({page})=>{
 const calls=await fixture(page);
 for(const route of disabledFinancialRoutes){await page.goto('/'+route);await expect(page.getByRole('heading',{name:'Financial services are disabled',exact:true})).toBeVisible();await expect(page.locator('form')).toHaveCount(0);}
 expect(calls.filter(x=>x.path==='/functions/v1/ig-payment-requests'||x.path==='/rest/v1/ig_prize_claim_requests')).toEqual([]);
});
