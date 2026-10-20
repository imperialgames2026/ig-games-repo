import {test,expect} from '@playwright/test';
const actor='11111111-1111-4111-8111-111111111111';
async function setup(page,{lostResponse=false}={}) {
 const role='player'; let failList=false, prepared=0; const ids=[];
  const user = { id: actor, email: 'ui-fixture@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const profile = { id: actor, email: user.email, full_name: 'UI Player', display_name: null, profile_picture: null, is_excluded: false, kyc_status: 'pending' };
  const rounds = new Map(), commits = [], writes = [];

  const payload = Buffer.from(JSON.stringify({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
  await page.addInitScript(({ user, payload }) => {
    localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token', JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user }));
  }, { user, payload });
  await page.route('https://qonqemhljgxlwpghkxhn.supabase.co/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' },
      body: status === 204 ? undefined : JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return reply(null, 204);
    if (path === '/auth/v1/user') return reply(user);
    if (path === '/rest/v1/user_roles') return reply([{ role }]);
    if (path === '/rest/v1/profiles') {
      if (request.method() === 'PATCH') {
        const patch = request.postDataJSON(); writes.push(patch); Object.assign(profile, patch);
        return reply({ id: actor });
      }
      return reply([profile]);
    }
    if (path === '/rest/v1/wallets') return reply([{ id: 'wallet', user_id: actor, cent_balance: 100, igt_balance: 100, igd_balance: 0 }]);
    if (path.startsWith('/rest/v1/')) return reply([]);
    if (path.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path.startsWith('/storage/v1/object/')) return reply({ Key: path.split('/object/')[1], Id: actor });

    if(path==='/functions/v1/ig-payment-requests') {
      const body=request.postDataJSON();
      if(body.action==='prepare') {
        ids.push(body.requestId); prepared++;
        if(lostResponse) {lostResponse=false;return reply({error:'Response lost'},503);}
        failList=true;
        return reply({message:'Request saved. No funds moved.'});
      }
      if(body.action==='list') {
        if(failList) {failList=false;return reply({error:'History unavailable'},503);}
        return reply({requests:[]});
      }
    }
    return reply({});
  });
  return {ids,count:()=>prepared};
}
test('saved request plus refresh failure offers history retry without a second preparation',async({page})=>{
 const state=await setup(page);await page.goto('/Withdraw');
 await page.getByLabel('Amount',{exact:true}).fill('1');
 await page.getByLabel('Destination address',{exact:true}).fill('synthetic-test-only');
 await page.getByRole('button',{name:'Save preparation request',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Request saved.'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Your request was saved');
 await expect(page.getByLabel('Amount',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Refresh history',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveCount(0);
 expect(state.count()).toBe(1);
});
test('uncertain preparation retry reuses the original UUID',async({page})=>{
 const state=await setup(page,{lostResponse:true});await page.goto('/Withdraw');
 await page.getByLabel('Amount',{exact:true}).fill('1');
 await page.getByLabel('Destination address',{exact:true}).fill('synthetic-test-only');
 await page.getByRole('button',{name:'Save preparation request',exact:true}).click();
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(page.getByLabel('Amount',{exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:'Save preparation request',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Your request was saved');
 expect(state.ids).toHaveLength(2);expect(new Set(state.ids).size).toBe(1);
});
