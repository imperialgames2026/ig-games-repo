import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL))throw Error('Wheel redemption tests require isolated local Supabase');
const service=createClient(c.API_URL,c.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function account(role='player'){
 const email='wheel-draw-'+crypto.randomUUID()+'@example.invalid',password='Local-'+crypto.randomUUID()+'-A8!';
 const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});expect(error).toBeNull();const user=data.user;
 if(role!=='player')expect((await service.from('user_roles').update({role}).eq('user_id',user.id)).error).toBeNull();
 const client=createClient(c.API_URL,c.ANON_KEY,{auth:{persistSession:false}});expect((await client.auth.signInWithPassword({email,password})).error).toBeNull();
 return {...user,email,password,client};
}
async function login(page,user){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).not.toHaveURL(/\/login$/);}
const prizes=unit=>[{slot:1,reward:'Repeatable '+unit+' reward',amount:'1.12345678',unit,weight:1,notes:'Same section can win on separate spins.'},{slot:2,reward:'Disabled jackpot',amount:'1',unit:'BTC',weight:0,notes:''}];
async function prepare(owner){
 const saved=await service.from('ig_vip_wheel_settings').select('stage,segments').order('stage');expect(saved.error).toBeNull();
 for(const [stage,unit] of [[1,'IGT'],[2,'IGD'],[3,'IGN']]){
  const update=await service.from('ig_vip_wheel_settings').update({segments:prizes(unit)}).eq('stage',stage).select('revision').single();expect(update.error).toBeNull();
  const release=await service.from('ig_vip_wheel_releases').select('revision').eq('stage',stage).single();
  const result=await owner.client.rpc('publish_vip_wheel',{p_stage:stage,p_settings_revision:update.data.revision,p_release_revision:release.data.revision,p_active:true});expect(result.error).toBeNull();
 }
 return saved.data;
}
async function cleanup(users,saved){
 for(const row of saved??[])expect((await service.from('ig_vip_wheel_settings').update({segments:row.segments}).eq('stage',row.stage)).error).toBeNull();
 expect((await service.from('ig_vip_wheel_releases').update({active:false,segments:[],config_revision:null}).in('stage',[1,2,3])).error).toBeNull();
 for(const user of users){await user.client.auth.signOut();expect((await service.from('ig_vip_wheel_receipts').delete().eq('user_id',user.id)).error).toBeNull();expect((await service.from('transactions').delete().eq('user_id',user.id)).error).toBeNull();expect((await service.auth.admin.deleteUser(user.id)).error).toBeNull();}
}
test('different spins collect the same prize again; concurrent retries credit once; stage rewards use explicit wallets',async({page})=>{
 const owner=await account('superadmin'),player=await account(),other=await account(),tester=await account('tester');let saved;
 try{
  saved=await prepare(owner);
  expect((await service.from('wallets').update({experience_points:10000000000}).eq('user_id',player.id)).error).toBeNull();
  const balanceBefore=await service.from('wallets').select('igt_balance,igd_balance,cent_balance').eq('user_id',player.id).single();
  await login(page,player);await page.goto('/VIP');const wheel=page.getByRole('region',{name:'VIP Reward Wheel',exact:true});
  await expect(wheel.getByRole('status')).toHaveText('34 saved spins');
  await wheel.getByRole('button',{name:'Spin stage 1',exact:true}).click();await expect(wheel.getByLabel('Latest wheel reward')).toContainText('Level 1');await expect(wheel.getByRole('status')).toHaveText('33 saved spins');
  await wheel.getByRole('button',{name:'Spin stage 1',exact:true}).click();await expect(wheel.getByLabel('Latest wheel reward')).toContainText('Level 2');await expect(wheel.getByRole('status')).toHaveText('32 saved spins');
  const release=(await service.from('ig_vip_wheel_releases').select('stage,revision').order('stage')).data;
  const retries=await Promise.all(Array.from({length:12},()=>player.client.rpc('spin_vip_wheel',{p_level:3,p_release_revision:release[0].revision})));
  expect(retries.every(r=>!r.error)).toBe(true);expect(new Set(retries.map(r=>r.data.id)).size).toBe(1);
  for(const [level,stage,unit] of [[12,2,'IGD'],[25,3,'IGN']]){const result=await player.client.rpc('spin_vip_wheel',{p_level:level,p_release_revision:release[stage-1].revision});expect(result.error).toBeNull();expect(result.data.reward.unit).toBe(unit);}
  const balances=(await service.from('wallets').select('igt_balance,igd_balance,cent_balance').eq('user_id',player.id).single()).data;
  expect(balances.igt_balance-balanceBefore.data.igt_balance).toBeCloseTo(3.37037034,8);expect(balances.igd_balance-balanceBefore.data.igd_balance).toBeCloseTo(1.12345678,8);expect(balances.cent_balance-balanceBefore.data.cent_balance).toBeCloseTo(1.12345678,8);
  expect((await service.from('transactions').select('id').eq('user_id',player.id)).data).toHaveLength(5);
  const owned=(await player.client.from('ig_vip_wheel_receipts').select('*')).data;expect(owned).toHaveLength(5);expect(owned.filter(r=>r.stage===1).every(r=>r.reward.slot===1)).toBe(true);
  expect((await other.client.from('ig_vip_wheel_receipts').select('*').eq('user_id',player.id)).data).toHaveLength(0);
  expect((await tester.client.rpc('spin_vip_wheel',{p_level:1,p_release_revision:release[0].revision})).error.code).toBe('42501');
  expect((await player.client.rpc('spin_vip_wheel',{p_level:4,p_release_revision:release[0].revision-1})).error.code).toBe('40001');
  await page.reload();await expect(wheel.getByRole('status')).toHaveText('29 saved spins');
  await wheel.getByText('Collected rewards (5)',{exact:true}).click();await expect(wheel.getByText('Level 1: 1.12345678 IGT',{exact:true})).toBeVisible();await expect(wheel.getByText('Level 2: 1.12345678 IGT',{exact:true})).toBeVisible();
  // Recover a committed result after the original browser lost its response/reloaded.
  const recovered=await player.client.rpc('spin_vip_wheel',{p_level:4,p_release_revision:release[0].revision});expect(recovered.error).toBeNull();
  await page.evaluate(({userId,revision})=>localStorage.setItem('ig:pending-vip-wheel:'+userId,JSON.stringify({level:4,revision})),{userId:player.id,revision:release[0].revision});
  await page.reload();await expect(wheel.getByLabel('Latest wheel reward')).toContainText('Level 4');await expect(wheel.getByRole('status')).toHaveText('28 saved spins');expect((await service.from('transactions').select('id').eq('user_id',player.id)).data).toHaveLength(6);
 }finally{await cleanup([owner,player,other,tester],saved);}
});
test('admin publishes saved prizes and pauses the wheel; draft edits leave the published payout unchanged',async({page})=>{
 const owner=await account('superadmin'),player=await account();let saved;
 try{
  saved=(await service.from('ig_vip_wheel_settings').select('stage,segments').order('stage')).data;
  await login(page,owner);await page.goto('/AdminRewardWheels');await expect(page.getByRole('heading',{name:'Reward Wheel Settings'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish stage 1 rewards'})).toBeDisabled();
  expect((await service.from('ig_vip_wheel_settings').update({segments:prizes('IGT')}).eq('stage',1)).error).toBeNull();
  await page.getByRole('button',{name:'Reload wheel settings'}).click();await expect(page.getByRole('button',{name:'Publish stage 1 rewards'})).toBeEnabled();
  await page.getByRole('button',{name:'Publish stage 1 rewards'}).click();await expect(page.getByRole('status')).toContainText('Players can now spin');await expect(page.getByRole('heading',{name:'Published and accepting spins'})).toBeVisible();
  const release=(await service.from('ig_vip_wheel_releases').select('*').eq('stage',1).single()).data;
  await page.getByRole('button',{name:'Edit stage 1 rewards'}).click();await page.getByLabel('Section 1 amount',{exact:true}).fill('9.25');await page.getByRole('button',{name:'Save stage 1 rewards'}).click();await expect(page.getByRole('status')).toHaveText('Stage 1 settings saved.');
  const spin=await player.client.rpc('spin_vip_wheel',{p_level:1,p_release_revision:release.revision});expect(spin.error).toBeNull();expect(spin.data.reward.amount).toBe('1.12345678');
  await page.getByRole('button',{name:'Pause stage 1',exact:true}).click();await expect(page.getByRole('status')).toContainText('paused');
  const replay=await player.client.rpc('spin_vip_wheel',{p_level:1,p_release_revision:release.revision});expect(replay.data.id).toBe(spin.data.id);
  await page.getByRole('button',{name:'Publish stage 1 rewards'}).click();await expect(page.getByRole('status')).toContainText('published');
  expect((await service.from('ig_vip_wheel_releases').select('segments').eq('stage',1).single()).data.segments[0].amount).toBe('9.25');
 }finally{await cleanup([owner,player],saved);}
});
