import { _android as android } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const packageId = 'com.imperialgaming.practice.dev';
mkdirSync('android-evidence', { recursive: true });
const devices = await android.devices();
assert.equal(devices.length, 1, 'Exactly one isolated emulator is required.');
const device = devices[0];
device.setDefaultTimeout(60000);
const results = [];
try {
  await device.shell(`am force-stop ${packageId}`);
  await device.shell(`am start -n ${packageId}/.MainActivity`);
  const view = await device.webView({ pkg: packageId });
  const page = await view.page();
  page.setDefaultTimeout(45000);
  // No public account authentication, provider calls or game mutations in smoke.
  const hostedMutations = [];
  await page.context().route('https://qonqemhljgxlwpghkxhn.supabase.co/**', async route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) hostedMutations.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'isolated_native_smoke', message: 'Hosted requests are blocked in native smoke.' }) });
  });
  await page.goto('https://localhost/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.equal(await page.evaluate(() => window.Capacitor?.isNativePlatform?.()), true);
  results.push('bundled React login renders inside native Capacitor WebView');
  await page.screenshot({ path: 'android-evidence/login.png', fullPage: true });
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(hostedMutations.length, 0, 'Disabled native recovery must not contact hosted Auth.');
  results.push('unapproved recovery rejected without hosted Auth mutation');
  await page.goto('https://localhost/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await device.shell('input keyevent KEYCODE_HOME');
  await device.shell(`am start -n ${packageId}/.MainActivity`);
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  results.push('background/resume returns to bundled login');
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  results.push('bundled login reloads without connectivity');
  await page.screenshot({ path: 'android-evidence/offline-login.png', fullPage: true });
  writeFileSync('android-evidence/result.json', JSON.stringify({ passed: true, model: device.model(), source_commit: process.env.SOURCE_SHA, results, hosted_auth_acceptance: false, publication_approved: false }, null, 2));
} finally {
  await device.close();
}
