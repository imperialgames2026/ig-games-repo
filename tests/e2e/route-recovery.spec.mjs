import { test, expect } from '@playwright/test';

test('an interrupted page download offers recovery and reload restores the lobby', async ({ page }) => {
  const route = '**/assets/Home-*.js';
  await page.route(route, request => request.abort('connectionfailed'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'This page could not load' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to game library' })).toHaveAttribute('href', '/Games');
  await page.unroute(route);
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByRole('heading', { name: 'Join the table. Play together.' })).toBeVisible();
});
