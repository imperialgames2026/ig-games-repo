import { _android as android } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isolateEmulator, TEST_PACKAGE } from './android-isolation.mjs';
import { createNativeWebViewDevice, withDeadline } from './android-webview-transport.mjs';

mkdirSync('android-evidence', { recursive: true });
const report = {
  passed: false, source_commit: process.env.SOURCE_SHA, results: [],
  hosted_auth_acceptance: false, publication_approved: false,
  external_requests: [], simulated_invalid_signins: 0, checkpoints: [],
};
let device;
let page;
const pageErrors = [];
const pageErrorDetails = [];
let phase = 'prelaunch_isolation';
function checkpoint(next) {
  phase = next;
  report.checkpoints.push({ phase, at: new Date().toISOString() });
  writeFileSync('android-evidence/progress.json', JSON.stringify({
    source_commit: report.source_commit, passed: false, phase, checkpoints: report.checkpoints,
  }, null, 2));
  console.log('[native-smoke]', phase);
}
function abortEvidence(reason) {
  report.passed = false;
  report.failure = { name: 'NativeTestDeadline', message: reason, phase };
  report.page_errors = pageErrors;
  report.page_error_details = pageErrorDetails;
  writeFileSync('android-evidence/result.json', JSON.stringify(report, null, 2));
  console.error('[native-smoke]', reason, 'at', phase);
  process.exit(1);
}
// A transport hang must produce a failed, phase-specific report, not consume
// the entire runner timeout or leave only an isolation proof in the artifact.
const watchdog = setTimeout(() => abortEvidence('Native smoke exceeded eight minutes.'), 8 * 60 * 1000);
process.once('SIGTERM', () => abortEvidence('Native smoke terminated by runner.'));
try {
  assert.match(process.env.SOURCE_SHA || '', /^[a-f0-9]{40}$/);
  checkpoint('prelaunch_isolation');
  // The OS firewall is enforced and probed BEFORE the app can start.
  report.isolation = await isolateEmulator();
  writeFileSync('android-evidence/isolation.json', JSON.stringify(report.isolation, null, 2));
  device = await createNativeWebViewDevice({ android, isolation: report.isolation, checkpoint });
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

  checkpoint('cold_launch');
  await device.shell(`am start -n ${TEST_PACKAGE}/.MainActivity`);
  await attach();
  checkpoint('bundled_home');
  await page.getByRole('heading', { name: 'IMPERIAL GAMES', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.Capacitor?.isNativePlatform?.()), true);
  report.results.push('cold launch renders bundled Imperial Games home in a real Capacitor WebView');
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
  assert.equal(metadata.native_wallet_credit_redemption_enabled, false);
  report.results.push('installed APK reports the exact build source and practice-only scope');

  checkpoint('home_to_login');
  await page.getByRole('link', { name: 'Sign In', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  report.results.push('home sign-in link opens bundled React login');
  await page.screenshot({ path: 'android-evidence/login.png', fullPage: true });

  const mutations = () => report.external_requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)).length;
  const baseline = mutations();
  checkpoint('blocked_recovery');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(mutations(), baseline);
  report.results.push('unapproved native recovery blocked before any Auth request');

  checkpoint('blocked_signup');
  await page.goto('https://localhost/login');
  await page.getByRole('button', { name: 'Create one', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Isolated Test');
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('isolated-test-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('isolated-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(mutations(), baseline);
  report.results.push('unapproved native signup blocked before any Auth request');

  checkpoint('blocked_confirmation');
  await page.goto('https://localhost/login');
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('isolated-smoke@example.invalid');
  await page.getByRole('button', { name: 'Resend confirmation email', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Mobile email confirmation and password recovery are not enabled' }).waitFor();
  assert.equal(mutations(), baseline);
  report.native_confirmation_resend_blocked = true;

  checkpoint('invalid_signin');
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
    checkpoint('protected_route:' + path);
    await page.goto('https://localhost' + path);
    await page.waitForURL('https://localhost/login');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  }
  report.results.push('signed-out profile, practice-game, admin and owner routes redirect to login');

  checkpoint('background_resume');
  // An already-rendered heading cannot prove Android has completed onResume.
  // Wait for real bridge pause/resume events before unloading this document.
  await page.evaluate(() => {
    window.__igNativeLifecycle = { pauses: 0, resumes: 0 };
    document.addEventListener('pause', () => { window.__igNativeLifecycle.pauses++; });
    document.addEventListener('resume', () => { window.__igNativeLifecycle.resumes++; });
  });
  report.lifecycle_cycles = [];
  for (let cycle = 1; cycle <= 3; cycle++) {
    const before = await page.evaluate(() => ({ ...window.__igNativeLifecycle }));
    // HOME key injection is asynchronous: a rapid am start can race the launcher
    // and leave the app in the background. Wait for each transition separately.
    await device.shell('am start -W -a android.intent.action.MAIN -c android.intent.category.HOME');
    await page.waitForFunction(previous => window.__igNativeLifecycle.pauses > previous.pauses,
      before, { polling: 100 });
    const background = await page.evaluate(() => ({ ...window.__igNativeLifecycle }));
    await device.shell(`am start -W -n ${TEST_PACKAGE}/.MainActivity`);
    await page.waitForFunction(previous =>
      window.__igNativeLifecycle.resumes > previous.resumes && document.visibilityState === 'visible',
      background, { polling: 100 });
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    const after = await page.evaluate(() => ({ ...window.__igNativeLifecycle }));
    assert.ok(background.pauses > before.pauses, 'Every cycle must actually pause.');
    assert.ok(after.resumes > background.resumes, 'Every cycle must actually resume after that pause.');
    report.lifecycle_cycles.push({ cycle, before, background, after });
  }
  report.results.push('three background/resume cycles deliver real native pause/resume events and restore login');
  checkpoint('offline_reload');
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  report.results.push('bundled login reloads offline');
  await page.screenshot({ path: 'android-evidence/offline-login.png', fullPage: true });
  assert.equal(report.simulated_invalid_signins, 1, 'No sign-in was queued for replay.');
  assert.deepEqual(pageErrors, [], 'Native WebView emitted uncaught JavaScript exceptions.');
  assert.equal(report.native_confirmation_resend_blocked, true, 'The new confirmation-resend guard must pass.');
  assert.equal(report.results.length, 9, 'Every original native scenario must pass.');
  report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message, phase };
  if (page) report.failure_lifecycle = await withDeadline(() => page.evaluate(() => window.__igNativeLifecycle || null), 3000, 'Read failure lifecycle').catch(() => null);
  if (page) await withDeadline(() => page.screenshot({ path: 'android-evidence/failure.png', fullPage: true, timeout: 3000 }), 4000, 'Capture failure screen').catch(() => {});
  console.error('[native-smoke] failed:', error.message);
} finally {
  if (device) {
    try {
      await device.shell(`am force-stop ${TEST_PACKAGE}`);
      await device.close();
    } catch (error) {
      report.passed = false;
      report.cleanup_error = error.message;
    }
  }
  report.page_errors = pageErrors;
  report.page_error_details = pageErrorDetails;
  writeFileSync('android-evidence/result.json', JSON.stringify(report, null, 2));
  clearTimeout(watchdog);
  // The runner owns the disposable emulator. Do not let stale automation
  // handles hide a completed failure until the 30-minute job timeout.
  process.exit(report.passed ? 0 : 1);
}
