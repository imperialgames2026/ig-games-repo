// Frontend contract checks only. Every Supabase request is intercepted; no hosted accounts or messages are created.
import { test, expect } from '@playwright/test';
const actor = '11111111-1111-4111-8111-111111111111';
const ticketId = '22222222-2222-4222-8222-222222222222';
const user = { id: actor, email: 'account-ui@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-20T12:00:00Z' };
async function setup(page, { signedIn = false, support } = {}) {
  const requests = [];
  if (signedIn) await page.addInitScript(user => {
    const payload = btoa(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }));
    const session = JSON.stringify({ access_token: `e30.${payload}.fixture`, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    for (const project of ['qonqemhljgxlwpghkxhn', 'jvyzpxjqmymafjapprpp', '127', 'localhost']) localStorage.setItem(`sb-${project}-auth-token`, session);
  }, user);
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' }, body: status === 204 ? undefined : JSON.stringify(data) });
    if (!/\/(auth|rest|functions|storage)\/v1\//.test(url.pathname)) {
      if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
      return route.abort();
    }
    if (request.method() === 'OPTIONS') return reply(null, 204);
    requests.push({ path: url.pathname, method: request.method(), body: request.postData() ? request.postDataJSON() : null });
    if (url.pathname === '/auth/v1/user') return signedIn ? reply(user) : reply({ message: 'No session' }, 401);
    if (url.pathname === '/auth/v1/signup') return reply({ user, session: null });
    if (url.pathname === '/auth/v1/recover') return reply({});
    if (url.pathname === '/rest/v1/profiles') return reply([{ id: actor, email: user.email, full_name: 'Account UI', display_name: null, profile_picture: null, is_excluded: false, kyc_status: 'pending' }]);
    if (url.pathname === '/rest/v1/user_roles') return reply([{ role: 'player' }]);
    if (url.pathname === '/functions/v1/ig-support-v1') return support ? support(request.postDataJSON(), reply) : reply({ tickets: [] });
    if (url.pathname === '/functions/v1/legacy-leaderboard-v1') return reply({ success: true, practiceOnly: true, leaderboard: [] });
    if (url.pathname.startsWith('/rest/v1/')) return reply([]);
    return reply({ error: 'Unexpected frontend fixture request' }, 400);
  });
  return requests;
}

test('registration validates confirmation before a request and supports password visibility', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Create one', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Practice Player');
  await page.getByLabel('Email', { exact: true }).fill('account-ui@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Practice-Password-9');
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-Password-9');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Passwords must match');
  expect(requests.filter(item => item.path === '/auth/v1/signup')).toHaveLength(0);
  await page.getByLabel('Confirm password', { exact: true }).fill('Practice-Password-9');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  expect(requests.filter(item => item.path === '/auth/v1/signup')).toHaveLength(1);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an expired reset link opens password recovery directly', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/ResetPassword', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Request a new link', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password', exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  await page.getByLabel('Email', { exact: true }).fill('account-ui@example.invalid');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  expect(requests.filter(item => item.path === '/auth/v1/recover')).toHaveLength(1);
});

test('support retries an uncertain ticket using the same request and retains the saved-success state if list refresh fails', async ({ page }) => {
  const attempts = [];
  let created = false;
  await setup(page, { signedIn: true, support: async (body, reply) => {
    if (body.action === 'mine') return created ? reply({ error: 'Ticket list temporarily unavailable' }, 503) : reply({ tickets: [] });
    if (body.action === 'open') {
      attempts.push(body);
      if (attempts.length === 1) return reply({ error: 'Response unavailable' }, 503);
      created = true; return reply({ id: ticketId, status: 'open' });
    }
    if (body.action === 'messages') return reply({ ticket: { id: ticketId, subject: 'Poker connection issue', status: 'open' }, messages: [{ id: 'message', sender_kind: 'player', body: 'I lost the connection during practice.', created_at: '2026-10-20T12:00:00Z' }] });
    return reply({ error: 'Unexpected fixture operation' }, 400);
  } });
  await page.goto('/Support', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New ticket', exact: true }).click();
  await page.getByLabel('Ticket subject', { exact: true }).fill('Poker connection issue');
  await page.getByLabel('Ticket message', { exact: true }).fill('I lost the connection during practice.');
  await page.getByRole('button', { name: 'Submit ticket', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('retrying unchanged details uses the same request');
  await expect(page.getByLabel('Ticket message', { exact: true })).toHaveValue('I lost the connection during practice.');
  await page.getByRole('button', { name: 'Submit ticket', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Support ticket created.' })).toContainText('Support ticket created.');
  await expect(page.getByRole('button', { name: 'Retry ticket list', exact: true })).toBeVisible();
  await expect(page.getByLabel('Support conversation')).toContainText('I lost the connection during practice.');
  expect(attempts).toHaveLength(2);
  expect(attempts[0].requestId).toBe(attempts[1].requestId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed support conversation has a retry instead of an endless loading state', async ({ page }) => {
  let reads = 0;
  await setup(page, { signedIn: true, support: (body, reply) => {
    if (body.action === 'mine') return reply({ tickets: [{ id: ticketId, subject: 'Existing practice question', status: 'closed', updated_at: '2026-10-20T12:00:00Z' }] });
    if (body.action === 'messages' && ++reads === 1) return reply({ error: 'Conversation temporarily unavailable' }, 503);
    if (body.action === 'messages') return reply({ ticket: { id: ticketId, subject: 'Existing practice question', status: 'closed' }, messages: [] });
    return reply({ error: 'Unexpected operation' }, 400);
  } });
  await page.goto('/Support?ticket=' + ticketId, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Conversation unavailable', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Existing practice question', exact: true })).toBeVisible();
  await expect(page.getByText('There are no messages in this conversation yet.')).toBeVisible();
  await expect(page.getByLabel('Reply to support', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open a new ticket', exact: true })).toBeVisible();
});
