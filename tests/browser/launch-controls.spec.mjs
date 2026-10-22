import { test, expect } from '@playwright/test';

// Exercise the real UI/client without hosted users, mail, payments or rewards.
const api = 'https://qonqemhljgxlwpghkxhn.supabase.co';
const user = { id: '33333333-3333-4333-8333-333333333333', email: 'launch@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {} };
async function setup(page, role = 'player') {
  const calls = [];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp })).toString('base64url');
  await page.addInitScript(value => localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token', JSON.stringify(value)), {
    access_token: `e30.${payload}.fixture`, refresh_token: 'launch-fixture', token_type: 'bearer', expires_in: 3600, expires_at: exp, user,
  });
  await page.route(api + '/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }, body: status === 204 ? undefined : JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return reply(null, 204);
    calls.push({ path, method: request.method(), search: url.search });
    if (path === '/auth/v1/user') return reply(user);
    if (path === '/rest/v1/profiles') return reply([{ id: user.id, email: user.email, full_name: 'Launch fixture', is_excluded: false, kyc_status: 'pending' }]);
    if (path === '/rest/v1/user_roles') return reply([{ role }]);
    // Old bonus flags must never turn into an actionable promotion.
    if (path === '/rest/v1/wallets') return reply([{ id: 'wallet-fixture', user_id: user.id, cent_balance: 0, igd_balance: 0, igt_balance: 0, bonus_50_available: true, purchase_count: 0, active_bonus: 50, referral_code: '123456', daily_bonus_amount: 100 }]);
    if (path === '/rest/v1/ig_vip_level_spins') return reply([{ user_id: user.id, level: 1, stage: 1, level_name: 'First level', earned_at: '2026-10-22T00:00:00Z' }]);
    if (path === '/rest/v1/ig_vip_wheel_releases') return reply([1, 2, 3].map(stage => ({ stage, revision: 1, config_revision: null, active: false, segments: [] })));
    if (path.startsWith('/rest/v1/')) return reply([]);
    if (path.startsWith('/functions/v1/')) return reply({});
    return reply({ error: 'Unexpected test request' }, 400);
  });
  return calls;
}
function assertNoLegacyPromotions(calls) {
  expect(calls.filter(call => call.path === '/rest/v1/app_records' || call.path === '/rest/v1/token_packs')).toEqual([]);
  expect(calls.filter(call => call.path.startsWith('/rest/v1/') && call.method !== 'GET')).toEqual([]);
  expect(calls.filter(call => call.path === '/functions/v1/api')).toEqual([]);
}

test('referrals offer clear status and support without sharing unbound codes or commission promises', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/Referrals?ref=123456');
  await expect(page.getByRole('heading', { name: 'Referrals', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Referral program' })).toContainText('are not active');
  await expect(page.getByRole('button', { name: /copy|share|apply code/i })).toHaveCount(0);
  await expect(page.getByText(/500 IC|2%|Earn Forever/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact support', exact: true })).toHaveAttribute('href', '/Support');
  assertNoLegacyPromotions(calls);
});

test('store does not advertise checkout or activate stale wallet bonus flags on a phone', async ({ page }) => {
  const calls = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/Store');
  await expect(page.getByRole('heading', { name: 'Imperial Gaming Store', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Token purchases' })).toContainText('No payment is collected here');
  await expect(page.getByRole('region', { name: 'Purchase bonuses' })).toContainText('cannot be activated');
  await expect(page.getByRole('button', { name: /activate|deactivate|buy|checkout|purchase/i })).toHaveCount(0);
  await expect(page.getByText(/Base44 Payments|\$21\.78|PO Box \[ADDRESS\]|50% Bonus/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View VIP levels and saved spins', exact: true })).toHaveAttribute('href', '/VIP');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  assertNoLegacyPromotions(calls);
});

test('bonus hub preserves earned VIP spins and paused wheels without invented quest progress or claims', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/Bonuses');
  await expect(page.getByRole('region', { name: 'Daily Quests', exact: true })).toContainText('not active');
  await expect(page.getByRole('region', { name: 'Weekly Quests', exact: true })).toContainText('not active');
  const wheel = page.getByRole('region', { name: 'VIP Reward Wheel', exact: true });
  await expect(wheel.getByRole('status')).toHaveText('1 saved spin');
  for (const stage of [1, 2, 3]) await expect(wheel.getByRole('button', { name: `Stage ${stage} paused`, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Ready to claim|8,000 ID|Locked Deposit Bonus|15 free rolls/)).toHaveCount(0);
  assertNoLegacyPromotions(calls);
});

for (const role of ['admin', 'superadmin']) {
  test(`${role} sees current operator replacements without loading retired mutation forms`, async ({ page }) => {
    const calls = await setup(page, role);
    await page.goto('/AdminLegacyTools');
    await expect(page.getByRole('heading', { name: 'Operator tool directory', exact: true })).toBeVisible();
    const modules = page.getByRole('region', { name: 'Current modules' });
    await expect(modules.getByRole('link', { name: /^VIP levels/ })).toHaveAttribute('href', '/AdminVIP');
    await expect(modules.getByRole('link', { name: /^Reward wheels/ })).toHaveAttribute('href', '/AdminRewardWheels');
    await expect(modules.getByRole('link', { name: /^Poker events/ })).toHaveCount(role === 'superadmin' ? 1 : 0);
    await expect(page.getByRole('region', { name: 'Unavailable legacy tools' })).toContainText('Voucher issuance');
    await expect(page.getByRole('button', { name: /save|create|approve|generate|delete/i })).toHaveCount(0);
    assertNoLegacyPromotions(calls);
  });
}

for (const role of ['player', 'tester']) {
  test(`${role} cannot open the operator directory directly`, async ({ page }) => {
    await setup(page, role);
    await page.goto('/AdminLegacyTools');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Operator tool directory', exact: true })).toHaveCount(0);
  });
}
