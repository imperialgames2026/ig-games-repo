import {test,expect} from '@playwright/test';
const actor='11111111-1111-4111-8111-111111111111';
async function setup(page,role='player'){
 const user={id:actor,email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{}};
 const profile={id:actor,email:user.email,full_name:'Synthetic Fixture',is_excluded:false,kyc_status:'pending_review'};
 const calls=[],state={profile,calls,status:'submitted',oldQueue:false};
 const exp=Math.floor(Date.now()/1000)+3600,payload=Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp})).toString('base64url');
 await page.addInitScript(value=>localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify(value)),{user,access_token:`e30.${payload}.fixture`,refresh_token:'fixture',token_type:'bearer',expires_at:exp,expires_in:3600});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='qonqemhljgxlwpghkxhn.supabase.co')return route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return reply({});
  if(url.pathname==='/auth/v1/user')return reply(user);
  if(url.pathname==='/rest/v1/profiles')return reply([profile]);
  if(url.pathname==='/rest/v1/user_roles')return reply([{role}]);
  if(url.pathname.startsWith('/rest/v1/'))return reply([]);
  if(url.pathname==='/functions/v1/ig-kyc-v1'){
   const b=req.postDataJSON();calls.push(b);
   const row={id:actor,user_id:actor,country:'US',created_at:'2026-10-22T12:00:00Z',expires_at:'2026-11-22T12:00:00Z',document_type:'passport',status:state.status};
   if(b.action==='mine')return reply({result:[row]});
   if(b.action==='cancel'){state.status='cancelled';return reply({result:{}});}
   if(b.action==='queue'&&state.oldQueue){if(b.status!==undefined)return reply({error:'Invalid or incomplete identity request'},400);return reply({result:[row]});}
   if(b.action==='queue')return reply({result:{rows:[{...row,user_id:b.cursor?'22222222-2222-4222-8222-222222222222':actor,status:b.status==='approved'?'approved':'submitted'}],next_cursor:b.cursor||b.status==='approved'?null:{created_at:row.created_at,id:row.id}}});
   throw Error('Forbidden or unexpected action '+b.action);
  }
  return reply({});
 });
 return state;
}
test('refresh synchronizes the account badge with the current profile and cancellation clears active submission',async({page})=>{
 const state=await setup(page);await page.goto('/KYCVerification');
 const account=page.locator('section').filter({has:page.getByRole('heading',{name:'Account status'})});
 await expect(account).toContainText('pending review');
 state.profile.kyc_status='approved';await page.getByRole('button',{name:'Refresh status',exact:true}).click();await expect(account).toContainText('approved');
 await page.getByRole('button',{name:'Cancel this submission'}).click();await expect(page.getByRole('heading',{name:'Start a submission'})).toBeVisible();
 expect(state.calls.some(x=>x.action==='cancel')).toBe(true);
});
test('reviewer can paginate and filter without requesting evidence or comparison',async({page})=>{
 const state=await setup(page,'admin');await page.goto('/AdminKYC');
 await expect(page.getByRole('button',{name:/11111111 · US/})).toBeVisible();
 await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.getByRole('button',{name:/22222222 · US/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Previous page',exact:true}).click();await expect(page.getByRole('button',{name:/11111111 · US/})).toBeVisible();
 await page.getByLabel('Submission status').selectOption('approved');await expect(page.getByRole('button',{name:'Previous page',exact:true})).toBeDisabled();
 await expect.poll(()=>state.calls.filter(x=>x.action==='queue').at(-1)).toEqual({action:'queue',status:'approved',limit:25});
 expect(state.calls.every(x=>x.action==='queue')).toBe(true);
});

test('new reviewer UI reports the old API limit instead of crashing or hiding truncation',async({page})=>{
 const state=await setup(page,'admin');state.oldQueue=true;await page.goto('/AdminKYC');
 await expect(page.getByRole('button',{name:/11111111 · US/})).toBeVisible();
 await expect(page.getByText(/Only the most recent 100 submissions/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
 expect(state.calls.filter(x=>x.action==='queue').slice(0,2)).toEqual([{action:'queue',status:'pending',limit:25},{action:'queue'}]);
});
