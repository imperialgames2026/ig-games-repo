import {test,expect} from '@playwright/test';

test.use({launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}});
const actor='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
async function setup(page,{unavailable=false}={}){
 const user={id:actor,email:'tournament-ui@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{}};
 const payload=Buffer.from(JSON.stringify({sub:actor,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 await page.addInitScript(({user,payload})=>localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify({access_token:`e30.${payload}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user})),{user,payload});
 let registered=false;const writes=[];
 await page.route('https://qonqemhljgxlwpghkxhn.supabase.co/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:status===204?undefined:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return reply(null,204);
  if(path==='/auth/v1/user')return reply(user);
  if(path==='/rest/v1/user_roles')return reply([{role:'player'}]);
  if(path==='/rest/v1/profiles')return reply([{id:actor,email:user.email,display_name:'Synthetic Player',is_excluded:false}]);
  if(path.startsWith('/rest/v1/'))return reply([]);
  if(path==='/functions/v1/poker-events-v1'){
   const body=req.postDataJSON();
   if(body.action==='register'){writes.push(body);registered=true;return reply({registered:true});}
   if(unavailable)return reply({error:'Synthetic tournament service unavailable'},503);
   return reply({events:[{id:eventId,name:'Synthetic free tournament',format:'scheduled_mtt',status:'registration',maxPlayers:6,seatsPerTable:6,tableCount:1,startingStack:5000,registered:registered?1:0,practiceOnly:true,realValueEnabled:false,levels:[{level:1,smallBlind:25,bigBlind:50,durationSeconds:600}],myEntry:registered?{event_id:eventId,user_id:actor,status:'registered'}:null}]});
  }
  return reply({error:'Unexpected synthetic request'},400);
 });
 return writes;
}
for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
 test(`free registration and pool confirmation at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);const writes=await setup(page);
  await page.goto('/PokerTournaments');await page.getByRole('button',{name:/Synthetic free tournament/}).click();
  await expect(page.getByRole('heading',{name:'Blind schedule'})).toBeVisible();
  await page.getByRole('button',{name:'Register free (practice)',exact:true}).click();
  await expect(page.getByText('You are in the tournament pool.',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Register free (practice)',exact:true})).toHaveCount(0);
  expect(writes).toEqual([{action:'register',eventId}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}
test('unavailable tournament service shows an error without registration controls',async({page})=>{
 await setup(page,{unavailable:true});await page.goto('/PokerTournaments');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Register free (practice)',exact:true})).toHaveCount(0);
});
