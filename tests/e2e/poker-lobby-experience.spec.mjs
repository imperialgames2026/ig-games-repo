// Frontend contracts only: every remote request is intercepted. No real signup,
// registration, room, chip action or hosted account is created by this suite.
import { test, expect } from '@playwright/test';

const actor = '11111111-1111-4111-8111-111111111111';
const tableId = '22222222-2222-4222-8222-222222222222';
const eventId = '33333333-3333-4333-8333-333333333333';
const user = { id: actor, email: 'poker-ui@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-20T12:00:00Z' };
const practiceEvent = { id: eventId, name: 'Friday practice group', format: 'sng', status: 'registration', registered: 1, maxPlayers: 6, startingStack: 1000, smallBlind: 5, bigBlind: 10, myEntry: null };

async function setup(page, { signedIn = false, role = 'player', events } = {}) {
  const calls = [];
  if (signedIn) await page.addInitScript(user => {
    const payload = btoa(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }));
    const session = JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    for (const project of ['qonqemhljgxlwpghkxhn', 'jvyzpxjqmymafjapprpp', '127', 'localhost']) localStorage.setItem(`sb-${project}-auth-token`, session);
  }, user);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, body: status === 204 ? undefined : JSON.stringify(data) });
    if (!/\/(auth|rest|functions|storage)\/v1\//.test(url.pathname)) {
      return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    }
    if (request.method() === 'OPTIONS') return reply(null, 204);
    const body = request.postData() ? request.postDataJSON() : null;
    calls.push({ path: url.pathname, method: request.method(), body });
    if (url.pathname === '/auth/v1/user') return signedIn ? reply(user) : reply({ message: 'No session' }, 401);
    if (url.pathname === '/rest/v1/profiles') return reply([{ id: actor, full_name: 'Poker UI', is_excluded: false, email: user.email }]);
    if (url.pathname === '/rest/v1/user_roles') return reply([{ role }]);
    if (url.pathname === '/functions/v1/poker-events-v1') return events ? events(body, reply) : reply({ events: [] });
    if (url.pathname === '/functions/v1/legacy-leaderboard-v1') return reply({ success: true, practiceOnly: true, leaderboard: [] });
    if (url.pathname.startsWith('/rest/v1/')) return reply([]);
    return reply({ error: 'Unexpected fixture operation' }, 400);
  });
  return calls;
}

test('visitors can browse both poker variants without requesting private events', async ({ page }) => {
  const calls = await setup(page);
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Multiplayer Poker', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create or join a Hold’em table', exact: true })).toHaveAttribute('href', '/PlayPoker');
  await expect(page.getByRole('link', { name: 'Create or join an Omaha table', exact: true })).toHaveAttribute('href', '/PlayOmaha');
  await expect(page.getByRole('link', { name: 'Sign in to view practice events', exact: true })).toBeVisible();
  expect(calls.filter(call => call.path === '/functions/v1/poker-events-v1')).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('invalid invites explain the correction and valid Omaha links retain the room through sign-in', async ({ page }) => {
  await setup(page);
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  const input = page.getByRole('textbox', { name: 'Poker invite or table ID', exact: true });
  await input.fill('this-is-not-a-table');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Enter a valid poker invite');
  await expect(input).toBeFocused();
  await input.fill(`https://imperialgaming.llc/PlayOmaha?tableId=${tableId}`);
  await expect(page.getByRole('combobox', { name: 'Room game', exact: true })).toHaveValue('omaha');
  await expect(page.getByRole('combobox', { name: 'Room game', exact: true })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Omaha invite recognized' })).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  expect(await page.evaluate(() => history.state.usr.from.pathname)).toBe('/PlayOmaha');
  expect(await page.evaluate(() => history.state.usr.from.search)).toBe('?tableId=' + tableId);
});

test('a room ID uses the chosen variant when submitted with the keyboard', async ({ page }) => {
  await setup(page);
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox', { name: 'Room game', exact: true }).selectOption('omaha');
  const input = page.getByRole('textbox', { name: 'Poker invite or table ID', exact: true });
  await input.fill(tableId); await input.press('Enter');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  expect(await page.evaluate(() => history.state.usr.from.pathname)).toBe('/PlayOmaha');
});

test('an unavailable event service does not claim the event list is empty and can be retried', async ({ page }) => {
  let unavailable = true;
  await setup(page, { signedIn: true, events: (_body, reply) => unavailable ? reply({ error: 'Events are temporarily unavailable' }, 503) : reply({ events: [] }) });
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('Events are temporarily unavailable');
  await expect(page.getByRole('heading', { name: 'No practice events are currently open', exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole('button', { name: 'Try loading events again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No practice events are currently open', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('confirmed registration survives a failed list refresh and unassigned seating is explained', async ({ page }) => {
  let registered = false;
  const calls = await setup(page, { signedIn: true, events: (body, reply) => {
    if (body.action === 'register') { registered = true; return reply({ registered: true, eventId }); }
    if (body.action === 'tables') return reply({ myTableId: null, myStatus: 'registered', tables: [] });
    return registered ? reply({ error: 'Event refresh is temporarily unavailable' }, 503) : reply({ events: [practiceEvent] });
  } });
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Register free', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'You are registered for Friday practice group' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Event refresh is temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Register free', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open my table', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your host has not assigned a table yet' })).toBeVisible();
  expect(calls.filter(call => call.body?.action === 'register')).toHaveLength(1);
});

test('read-only testers see their access boundary and cannot register from the lobby', async ({ page }) => {
  const calls = await setup(page, { signedIn: true, role: 'tester', events: (_body, reply) => reply({ events: [practiceEvent] }) });
  await page.goto('/PokerLobby', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').filter({ hasText: 'Your account has read-only tester access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register free', exact: true })).toBeDisabled();
  expect(calls.filter(call => call.body?.action === 'register')).toHaveLength(0);
});

test('the tester-chip guide explains reconnection and hand controls in keyboard-accessible answers', async ({ page }) => {
  await setup(page);
  await page.goto('/TesterChips', { waitUntil: 'domcontentloaded' });
  const question = page.locator('summary').filter({ hasText: 'What happens if I refresh or lose my connection?' });
  await question.focus(); await question.press('Enter');
  await expect(page.getByText('Rejoining does not add another starting stack.', { exact: false })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'How does the next hand start?' }).click();
  await expect(page.getByText('When the hand ends, the host deals the next hand.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
