import { test, expect } from '@playwright/test';

test('tester site gives mobile and desktop visitors a clear account and poker entry', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('complementary', { name: 'Tester chip mode' })).toContainText('Tester-chip preview');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find your poker table' })).toBeVisible();
  await expect(page.locator('a[href="/Payments"],a[href="/IGNToken"],a[href="/DepositNetworks"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  if (page.viewportSize().width < 1024) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Tester chips', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  } else {
    await page.getByRole('link', { name: 'How chips work', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your seat. Your tester chips.' })).toBeVisible();
  await expect(page.getByText('When you create or join a poker practice room,', { exact: false })).toContainText('1,000 tester chips');
  await expect(page.getByRole('link', { name: 'Open poker lobby', exact: true })).toBeVisible();
});

test('historical finance URLs show tester-chip information without requesting money', async ({ page }) => {
  const financialRequests = [];
  page.on('request', request => {
    if (/\/functions\/v1\//.test(request.url())) financialRequests.push(request.url());
  });
  for (const route of ['/Payments', '/Withdraw', '/CryptoWallet', '/DepositNetworks', '/IGNToken', '/ImperialMembership', '/Bonuses', '/AMOE', '/Store', '/Staking', '/VIP', '/Progression', '/Referrals', '/PrizeClaims', '/ThankYou', '/IGTTransfer']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your seat. Your tester chips.' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Amount|Destination address/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save preparation request|Deposit|Withdraw|Stake|Buy|Purchase|Claim|Transfer/i })).toHaveCount(0);
  }
  expect(financialRequests).toEqual([]);
});

test('a 320px phone can use sign-in and navigation without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Join the table. Play together.' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  const menuBounds = await menu.boundingBox();
  expect(menuBounds.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await menu.click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Tester chips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your seat. Your tester chips.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
