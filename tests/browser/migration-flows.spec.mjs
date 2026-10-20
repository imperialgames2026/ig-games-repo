// Browser behavior with controlled API responses. Live staging contracts are tested separately by the HTTP scripts.
import { test, expect } from '@playwright/test';
import { calculateOriginalsOutcome } from '../../lib/originalsFairness.js';
import { sha256Hex } from '../../lib/practiceFairDice.js';
import { calculateMinesBoard } from '../../lib/minesFairness.js';
const actor = '11111111-1111-4111-8111-111111111111';
const seed = 'ab'.repeat(32);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8V0AAAAASUVORK5CYII=', 'base64');
async function setup(page, { role = 'player', failReveal = false, minesLostStart = false, minesSubstituteSeed = false } = {}) {
  const user = { id: actor, email: 'ui-fixture@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const profile = { id: actor, email: user.email, full_name: 'UI Player', display_name: null, profile_picture: null, is_excluded: false, kyc_status: 'pending' };
  const rounds = new Map(), commits = [], writes = [];
  let minesRound = null, mines = [];
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
    if (path === '/functions/v1/ig-mines-practice') {
      const body = request.postDataJSON();
      if (body.action === 'current' || body.action === 'state') return reply({ state: minesRound });
      if (body.action === 'commit') {
        minesRound = { roundId: body.roundId,mineCount: body.mineCount,phase: 'committed',version: 0,
          picks: [],endReason: null,clientSeed: null,serverSeedHash: await sha256Hex(seed),algorithm: 'hmac-sha256-mines-v1',practiceOnly: true };
      } else if (body.action === 'start') {
        if (minesSubstituteSeed) body.clientSeed = 'substituted';
        mines = await calculateMinesBoard(seed,body.clientSeed,minesRound.mineCount);
        minesRound = { ...minesRound,clientSeed: body.clientSeed,phase: 'active',version: 1 };
        if (minesLostStart) { minesLostStart = false; return reply({error:'Response lost; retry'},503); }
      } else if (body.action === 'pick') {
        minesRound = { ...minesRound,picks: [...minesRound.picks,body.cell],version: minesRound.version+1 };
        if (mines.includes(body.cell)) minesRound = { ...minesRound,phase: 'ended',endReason: 'mine',mines,serverSeed: seed };
      } else if (body.action === 'finish') {
        minesRound = { ...minesRound,phase: 'ended',endReason: 'stopped',mines,serverSeed: seed,version: minesRound.version+1 };
      }
      return reply({ state: minesRound });
    }
    if (path === '/functions/v1/ig-originals-practice') {
      const body = request.postDataJSON();
      if (body.action === 'commit') {
        commits.push(body.requestId);
        if (!rounds.has(body.requestId)) rounds.set(body.requestId, { game: body.game });
        return reply({ phase: 'committed', id: body.requestId, game: body.game, server_seed_hash: await sha256Hex(seed), nonce: 0, algorithm: 'hmac-sha256-v3', practiceOnly: true });
      }
      if (failReveal) { failReveal = false; return reply({ error: 'Temporary round error. Retry the same round.' }, 503); }
      return reply({ phase: 'revealed', roundId: body.roundId, game: body.game, serverSeed: seed, serverSeedHash: await sha256Hex(seed), clientSeed: body.clientSeed,
        nonce: 0, algorithm: 'hmac-sha256-v3', practiceOnly: true, outcome: await calculateOriginalsOutcome(seed, body.clientSeed, body.game) });
    }
    return reply({ error: 'Unexpected browser test API request' }, 400);
  });
  return { rounds, commits, writes, profile, replaceMines: patch => { minesRound = { ...minesRound,...patch }; } };
}
for (const route of ['PlayCoinFlip','PlayHashDice','PlayLimbo','PlayPlinko','PlayWheel']) {
  test(`${route} displays a locally verified server outcome`, async ({ page }) => {
    await setup(page);
    await page.goto('/' + route);
    await page.getByLabel('Client seed', { exact: true }).fill('client:unicode-🎲');
    await page.getByRole('button', { name: /^(Flip coin|Roll hash dice|Launch|Drop ball|Spin wheel)$/ }).click();
    await expect(page.getByText('Fairness proof verified on your device', { exact: false })).toBeVisible();
    await expect(page.getByText('Round fairness proof', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
test('a failed reveal resumes the same saved round after page reload', async ({ page }) => {
  const state = await setup(page, { failReveal: true });
  await page.goto('/PlayCoinFlip');
  await page.getByLabel('Client seed', { exact: true }).fill('saved-round-seed');
  await page.getByRole('button', { name: 'tails', exact: true }).click();
  await page.getByRole('button', { name: 'Flip coin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry pending round' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Client seed', { exact: true })).toHaveValue('saved-round-seed');
  await expect(page.getByRole('button', { name: 'tails', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Retry pending round' }).click();
  await expect(page.getByText('Fairness proof verified on your device', { exact: false })).toBeVisible();
  expect(state.rounds.size).toBe(1);
  expect(new Set(state.commits).size).toBe(1);
});
test('profile saves a name, locks the chosen display name and uploads an avatar', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/Profile');
  await page.getByPlaceholder('Enter your name').fill('Saved UI Name');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByText('Name updated!', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Choose a username').fill('Chosen UI Name');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();
  await expect(page.getByPlaceholder('Choose a username')).toBeDisabled();
  await page.locator('#profile-upload').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Profile picture updated!', { exact: true })).toBeVisible();
  expect(state.profile.full_name).toBe('Saved UI Name');
  expect(state.profile.display_name).toBe('Chosen UI Name');
  expect(state.profile.profile_picture).toContain(`/profile-avatars/${actor}/`);
  expect(state.writes.every(p => !Object.hasOwn(p, 'role'))).toBe(true);
});
test('tester cannot start a round or change protected profile fields', async ({ page }) => {
  const state = await setup(page, { role: 'tester' });
  await page.goto('/PlayCoinFlip');
  await expect(page.getByRole('button', { name: 'Flip coin', exact: true })).toBeDisabled();
  await page.goto('/Profile');
  await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
  await expect(page.locator('#profile-upload')).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test('Mines keeps tiles hidden, resumes a server-owned round and verifies the final board', async ({ page }) => {
  await setup(page);
  await page.goto('/PlayMines');
  await page.getByRole('button',{ name: 'Commit round',exact: true }).click();
  await expect(page.getByRole('button',{ name: 'Start committed round',exact: true })).toBeVisible();
  await page.getByLabel('Client seed',{ exact: true }).fill('client:unicode-🎲');
  await page.getByRole('button',{ name: 'Start committed round',exact: true }).click();
  await expect(page.getByRole('button',{ name: 'Tile 2',exact: true })).toBeEnabled();
  await expect(page.getByText('Board proof verified on your device',{ exact: false })).toHaveCount(0);
  await page.getByRole('button',{ name: 'Tile 2',exact: true }).click();
  await expect(page.getByText('Gems found: 1',{ exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Gems found: 1',{ exact: true })).toBeVisible();
  await page.getByRole('button',{ name: 'Stop and reveal board',exact: true }).click();
  await expect(page.getByText('Board proof verified on your device',{ exact: false })).toBeVisible();
  await expect(page.getByRole('button',{ name: 'Tile 1 mine',exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

async function startMines(page) {
 await page.goto('/PlayMines');
 await page.getByRole('button',{name:'Commit round',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start committed round',exact:true})).toBeVisible();
 await page.getByLabel('Client seed',{exact:true}).fill('client:unicode-🎲');
 await page.getByRole('button',{name:'Start committed round',exact:true}).click();
}
for (const changed of ['server commitment','client seed','missing local commitment']) {
 test('Mines rejects reloaded ' + changed + ' even with a valid replacement board', async ({page}) => {
  const fixture = await setup(page);
  await startMines(page);
  await expect(page.getByRole('button',{name:'Stop and reveal board',exact:true})).toBeVisible();
  const replacementSeed = changed === 'server commitment' ? 'cd'.repeat(32) : seed;
  const replacementClient = changed === 'client seed' ? 'substituted' : 'client:unicode-🎲';
  fixture.replaceMines({phase:'ended',endReason:'stopped',picks:[],serverSeed:replacementSeed,
   serverSeedHash:await sha256Hex(replacementSeed),clientSeed:replacementClient,
   mines:await calculateMinesBoard(replacementSeed,replacementClient,3)});
  if (changed === 'missing local commitment') await page.evaluate(() => {
   for (const key of Object.keys(localStorage)) if (key.startsWith('imperial-mines-proof:')) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Board proof verified on your device',{exact:false})).toHaveCount(0);
 });
}
test('Mines rejects a substituted client seed immediately after start', async ({page}) => {
 await setup(page,{minesSubstituteSeed:true});
 await startMines(page);
 await expect(page.getByRole('alert')).toContainText('submitted client seed changed');
 await expect(page.getByRole('button',{name:'Stop and reveal board',exact:true})).toHaveCount(0);
});
test('Mines retains the original commitment and seed across a lost start response and reload', async ({page}) => {
 await setup(page,{minesLostStart:true});
 await startMines(page);
 await expect(page.getByRole('button',{name:'Retry pending request',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('button',{name:'Retry pending request',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Retry pending request',exact:true}).click();
 await page.getByRole('button',{name:'Stop and reveal board',exact:true}).click();
 await expect(page.getByText('Board proof verified on your device',{exact:false})).toBeVisible();
});
