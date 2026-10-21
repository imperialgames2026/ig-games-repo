import { test, expect } from '@playwright/test';
import { loadEnv } from 'vite';

const collection = page => page.getByRole('region', { name: 'Game collection' });
const cards = page => collection(page).locator('a[href^="/Play"]');
const categories = page => page.getByRole('group', { name: 'Filter game category' });

test('public discovery shows the approved collection without requesting an account catalog', async ({ page }) => {
  const catalogRequests = [];
  page.on('request', request => {
    if (request.url().includes('/rest/v1/ig_practice_game_catalog')) catalogRequests.push(request.url());
  });
  await page.goto('/Games');
  await expect(cards(page)).toHaveCount(20);
  await expect(collection(page).getByRole('link', { name: 'Sign in to play' })).toBeVisible();
  await expect(collection(page).locator('a[href="/PlayPoker"]')).toHaveCount(1);
  await expect(collection(page).locator('a[href="/PlayRocket"]')).toHaveCount(1);
  await expect(collection(page).locator('a[href="/PlayHotPot"],a[href="/PlayExternal"]')).toHaveCount(0);
  await expect(collection(page).getByText(/\d+ plays|players online|live now/i)).toHaveCount(0);
  expect(catalogRequests).toEqual([]);
});

test('search and category filters work together and survive a reload', async ({ page }) => {
  await page.goto('/Games');
  await categories(page).getByRole('button', { name: 'Poker', exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search practice games' }).fill('omaha');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('Omaha Poker');
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search practice games' })).toHaveValue('omaha');
  await expect(categories(page).getByRole('button', { name: 'Poker', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear game search' }).click();
  await expect(cards(page)).toHaveCount(2);
  await categories(page).getByRole('button', { name: 'All games', exact: true }).click();
  await expect(cards(page)).toHaveCount(20);
});

test('a search with no matches offers one action that restores the collection', async ({ page }) => {
  await page.goto('/Games?category=poker&q=unavailable-test-game');
  await expect(page.getByRole('heading', { name: 'No matching games' })).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(cards(page)).toHaveCount(20);
  await expect(page.getByRole('searchbox', { name: 'Search practice games' })).toHaveValue('');
});

test('the collection fits a 320px phone with usable search and category buttons', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/Games');
  await page.getByRole('searchbox', { name: 'Search practice games' }).fill('mines');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText('Mines');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

async function catalogFixture(page) {
  // Browser-only contract fixture: every Supabase request is fulfilled locally.
  // Default production, local integration and explicit lab builds use different
  // connections. Seed only fixture sessions for the configured build modes.
  const projects = [...new Set(['production', 'test', 'development', 'lab']
    .map(mode => loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL)
    .filter(Boolean).map(url => new URL(url).hostname.split('.')[0]))];
  const id = '11111111-1111-4111-8111-111111111111';
  const user = { id, email: 'discovery-fixture@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const profile = { id, email: user.email, full_name: 'Discovery Player', display_name: null, profile_picture: null, is_excluded: false, kyc_status: 'pending' };
  const payload = Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  await page.addInitScript(({ user, payload, projects }) => {
    for (const project of projects) localStorage.setItem(`sb-${project}-auth-token`, JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { user, payload, projects });
  const state = { phase: 'error', reads: 0, rows: [] };
  await page.route('**/*', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!/^\/(?:auth|rest|functions|storage)\/v1\//.test(path)) return route.continue();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: status === 204 ? undefined : JSON.stringify(body) });
    if (request.method() === 'OPTIONS') return reply(null, 204);
    if (path === '/auth/v1/user') return reply(user);
    if (path === '/rest/v1/profiles') return reply([profile]);
    if (path === '/rest/v1/user_roles') return reply([{ role: 'player' }]);
    if (path === '/rest/v1/ig_practice_game_catalog') {
      state.reads++;
      return state.phase === 'error' ? reply({ code: 'PGRST205', message: 'Controlled catalog failure' }, 404) : reply(state.rows);
    }
    return reply([]);
  });
  return state;
}

test('a failed signed-in catalog hides unconfirmed games and can recover to an empty library', async ({ page }) => {
  const fixture = await catalogFixture(page);
  await page.goto('/Games');
  await expect(collection(page).getByRole('alert')).toContainText('Your game catalog could not load.');
  await expect(cards(page)).toHaveCount(0);
  fixture.phase = 'ready';
  await collection(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(collection(page).getByText('No practice games are currently available.')).toBeVisible();
  await expect(collection(page).getByRole('alert')).toHaveCount(0);
  expect(fixture.reads).toBeGreaterThanOrEqual(2);
});

test('signed-in discovery excludes disabled, foreign and nonpractice catalog records', async ({ page }) => {
  const fixture = await catalogFixture(page);
  const game = { slug: 'poker', name: 'Texas Hold’em Poker', route: '/PlayPoker', game_type: 'internal', practice_only: true, real_wagers_enabled: false, is_active: true };
  fixture.phase = 'ready';
  fixture.rows = [game, { ...game, slug: 'hotpot', route: '/PlayHotPot' }, { ...game, slug: 'omaha', route: 'https://example.invalid/game' }, { ...game, slug: 'mines', route: '/PlayMines', is_active: false }, { ...game, slug: 'dice', route: '/PlayDice', real_wagers_enabled: true }];
  await page.goto('/Games');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toHaveAttribute('href', '/PlayPoker');
  await expect(cards(page).first()).toContainText('Texas Hold’em Poker');
});
