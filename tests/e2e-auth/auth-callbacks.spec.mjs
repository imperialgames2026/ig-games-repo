import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const config = JSON.parse(readFileSync('/tmp/ig-local-runtime.json', 'utf8'));
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(config.API_URL)) throw Error('Callback acceptance requires isolated local Supabase');
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const appOrigin = 'http://127.0.0.1:4173';

async function signupLink() {
  const email = `callback-${crypto.randomUUID()}@example.invalid`;
  const password = `Local-${crypto.randomUUID()}-aA7!`;
  const result = await admin.auth.admin.generateLink({ type: 'signup', email, password, options: { redirectTo: appOrigin } });
  expect(result.error).toBeNull();
  const action = new URL(result.data.properties.action_link);
  expect(action.origin).toBe(config.API_URL);
  expect(action.searchParams.get('redirect_to')).toBe(appOrigin);
  return { id: result.data.user.id, email, password, action: action.toString() };
}

function expireLocalConfirmation(userId) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw Error('Invalid local fixture identity');
  const container = 'supabase_db_qonqemhljgxlwpghkxhn';
  const details = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
  if (details.Name !== '/' + container || !details.State.Running) throw Error('Isolated local database required');
  // Only the synthetic account in the disposable Docker database is changed.
  execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: `UPDATE auth.users SET confirmation_sent_at = now() - interval '30 days' WHERE id = '${userId}';`, encoding: 'utf8',
  });
}

test('real signup confirmation establishes a session and the consumed link cannot be reused', async ({ page, browser }) => {
  const fixture = await signupLink();
  try {
    const before = await admin.auth.admin.getUserById(fixture.id);
    expect(before.error).toBeNull();
    expect(before.data.user.email_confirmed_at).toBeFalsy();
    await page.goto(fixture.action, { waitUntil: 'domcontentloaded' });
    // The SDK can leave a bare trailing # after clearing the auth fragment.
    // Require the exact origin/root and no remaining query or fragment data.
    await expect(page).toHaveURL(url => url.origin === appOrigin && url.pathname === '/' && url.search === '' && url.hash === '');
    await page.goto('/Profile');
    await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible();
    const confirmed = await admin.auth.admin.getUserById(fixture.id);
    expect(confirmed.error).toBeNull();
    expect(confirmed.data.user.email_confirmed_at).toBeTruthy();
    const role = await admin.from('user_roles').select('role').eq('user_id', fixture.id).single();
    expect(role.error).toBeNull(); expect(role.data.role).toBe('player');

    const second = await browser.newContext();
    try {
      const replay = await second.newPage();
      await replay.goto(fixture.action, { waitUntil: 'domcontentloaded' });
      await expect(replay.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
      await expect(replay.getByRole('alert')).toContainText('invalid, expired or already used');
      await expect(replay.getByRole('button', { name: 'Resend confirmation email', exact: true })).toBeVisible();
    } finally { await second.close(); }
  } finally { expect((await admin.auth.admin.deleteUser(fixture.id)).error).toBeNull(); }
});

test('a genuinely expired local confirmation link cannot confirm the account or grant a session', async ({ page }) => {
  const fixture = await signupLink();
  try {
    expireLocalConfirmation(fixture.id);
    await page.goto(fixture.action, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Confirm your email', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
    const result = await admin.auth.admin.getUserById(fixture.id);
    expect(result.error).toBeNull(); expect(result.data.user.email_confirmed_at).toBeFalsy();
    const client = createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
    expect(login.error?.code).toBe('email_not_confirmed');
    expect(login.data.session).toBeNull();
  } finally { expect((await admin.auth.admin.deleteUser(fixture.id)).error).toBeNull(); }
});
