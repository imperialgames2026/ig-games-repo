import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Anonymous UI behavior only: no calls to a hosted lab or account service.
  await page.route('https://*.supabase.co/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
    headers: { 'access-control-allow-origin': '*' },
  }));
});

test('navigation resets scroll, updates the title and moves keyboard focus to the new page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.getByRole('link', { name: 'Explore the game library', exact: true }).click();
  await expect(page).toHaveTitle('Game library | Imperial Games');
  await expect(page.locator('h1')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('a missing page keeps site navigation and provides a working recovery path', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/a-link-that-no-longer-exists');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Page not found | Imperial Games');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('link', { name: 'Imperial Games home', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Explore games', exact: true }).click();
  await expect(page).toHaveURL(/\/Games$/);
  await expect(page.locator('h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('phone navigation dismisses with Escape and outside interaction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Games', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('h1').click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0);
  const bottom = page.getByRole('navigation', { name: 'Bottom navigation' });
  await bottom.getByRole('link', { name: 'Poker', exact: true }).click();
  await expect(page).toHaveURL(/\/PokerLobby$/);
  await expect(page.getByRole('heading', { name: 'Multiplayer Poker', exact: true })).toBeVisible();
  await expect(bottom.getByRole('link', { name: 'Poker', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute('aria-expanded', 'false');
});
