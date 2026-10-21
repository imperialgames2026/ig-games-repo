import { _android as android } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isolateEmulator, TEST_PACKAGE } from './android-isolation.mjs';

mkdirSync('android-evidence', { recursive: true });
const report = {
  passed: false, source_commit: process.env.SOURCE_SHA, results: [],
  hosted_auth_acceptance: false, publication_approved: false,
  external_requests: [], simulated_invalid_signins: 0,
};
let device;
let page;
const pageErrors = [];
const pageErrorDetails = [];
let phase = 'prelaunch_isolation';
try {
  assert.match(process.env.SOURCE_SHA || '', /^[a-f0-9]{40}$/);
  // The OS firewall is enforced and probed BEFORE the app can start.
  report.isolation = await isolateEmulator();
  writeFileSync('android-evidence/isolation.json', JSON.stringify(report.isolation, null, 2));
  const devices = await android.devices();
  assert.equal(devices.length, 1, 'Exactly one isolated emulator is required.');
  device = devices[0];
  assert.equal(device.serial(), report.isolation.serial);
  report.model = device.model();
  device.setDefaultTimeout(60000);

  async function attach() {
    const view = await device.webView({ pkg: TEST_PACKAGE });
    page = await view.page();
    page.setDefaultTimeout(45000);
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      pageErrorDetails.push({ phase, message: error.message, stack: error.stack });
    });
    // Defense in depth: no external request is forwarded. Only local APK assets
    // continue; one deliberately rejected sign-in uses a deterministic fixture.
    await page.context().route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === 'https://localhost') return route.continue();
      report.external_requests.push({ origin: url.origin, path: url.pathname, method: request.method() });
      if (url.origin === 'https://qonqemhljgxlwpghkxhn.supabase.co' && url.pathname === '/auth/v1/token' && request.method() === 'POST') {
        report.simulated_invalid_signins++;
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }) });
      }
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'isolated_native_test', message: 'External requests are blocked.' }) });
    });
  }

  phase = 'cold_launch';
  await device.shell(`am start -n ${TEST_PACKAGE}/.MainActivity`);
  await attach();
  await page.getByRole('heading', { name: /Join the table/ }).waitFor();
  assert.equal(await page.evaluate(() => window.Capacitor?.isNativePlatform?.()), true);
  report.results.push('cold launch renders bundled practice home in a real Capacitor WebView');
  await page.screenshot({ path: 'android-evidence/home.png', fullPage: true });
  const metadata = await page.evaluate(async () => {
    const response = await fetch('/mobile-release.json');
    if (!response.ok) throw new Error('Missing bundled source metadata');
    return response.json();
  });
  assert.equal(metadata.source_commit, process.env.SOURCE_SHA);
  assert.equal(metadata.app_id, TEST_PACKAGE);
  assert.equal(metadata.release_scope, 'practice');
  assert.equal(metadata.publish_approved, false);
  report.results.push('installed APK reports the exact build source and practice-only scope');

  phase = 'home_to_login';
  await page.getByRole('link', { name: 'sign in to open your game library', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  report.results.push('home sign-in link opens bundled React login');
  await page.screenshot({ path: 'android-evidence/login.png', fullPage: true });

  const mutations = () => report.external_requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)).length;
  const baseline = mutations();
  phase = 'blocked_recovery';
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(mutations(), baseline);
  report.results.push('unapproved native recovery blocked before any Auth request');

  phase = 'blocked_signup';
  await page.goto('https://localhost/login');
  await page.getByRole('button', { name: 'Create one', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Isolated Test');
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('isolated-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(mutations(), baseline);
  report.results.push('unapproved native signup blocked before any Auth request');

  phase = 'invalid_signin';
  await page.goto('https://localhost/login');
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('isolated-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Invalid login credentials' }).waitFor();
  assert.equal(report.simulated_invalid_signins, 1);
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true);
  assert.equal(new URL(page.url()).pathname, '/login');
  report.results.push('rejected sign-in fixture shows an error and releases the busy state without a hosted call');

  for (const path of ['/Profile', '/PlayDice', '/Admin', '/OwnerKeyring']) {
    phase = 'protected_route:' + path;
    await page.goto('https://localhost' + path);
    await page.waitForURL('https://localhost/login');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  }
  report.results.push('signed-out profile, practice-game, admin and owner routes redirect to login');

  phase = 'background_resume';
  // An already-rendered heading cannot prove Android has completed onResume.
  // Wait for real bridge pause/resume events before unloading this document.
  await page.evaluate(() => {
    window.__igNativeLifecycle = { pauses: 0, resumes: 0 };
    document.addEventListener('pause', () => { window.__igNativeLifecycle.pauses++; });
    document.addEventListener('resume', () => { window.__igNativeLifecycle.resumes++; });
  });
  report.lifecycle_cycles = [];
  for (let cycle = 1; cycle <= 3; cycle++) {
    await device.shell('input keyevent KEYCODE_HOME');
    await device.shell(`am start -n ${TEST_PACKAGE}/.MainActivity`);
    await page.waitForFunction(count =>
      window.__igNativeLifecycle.pauses >= count && window.__igNativeLifecycle.resumes >= count,
    cycle);
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    report.lifecycle_cycles.push(await page.evaluate(() => ({ ...window.__igNativeLifecycle })));
  }
  report.results.push('three background/resume cycles deliver real native pause/resume events and restore login');
  phase = 'offline_reload';
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  report.results.push('bundled login reloads offline');
  await page.screenshot({ path: 'android-evidence/offline-login.png', fullPage: true });
  assert.equal(report.simulated_invalid_signins, 1, 'No sign-in was queued for replay.');
  assert.deepEqual(pageErrors, [], 'Native WebView emitted uncaught JavaScript exceptions.');
  report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message };
  if (page) await page.screenshot({ path: 'android-evidence/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.page_errors = pageErrors;
  report.page_error_details = pageErrorDetails;
  writeFileSync('android-evidence/result.json', JSON.stringify(report, null, 2));
  if (device) {
    await device.shell(`am force-stop ${TEST_PACKAGE}`).catch(() => {});
    await device.close();
  }
}
