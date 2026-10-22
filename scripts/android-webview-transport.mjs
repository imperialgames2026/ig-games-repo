import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as pause } from 'node:timers/promises';

const exec = promisify(execFile);
const PACKAGE = 'com.imperialgaming.practice.dev';

export async function withDeadline(operation, milliseconds, label) {
  assert.ok(Number.isInteger(milliseconds) && milliseconds > 0 && milliseconds <= 120000);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function requireIsolatedTransport(isolation, ci, packageId) {
  assert.equal(ci, 'true', 'Native transport runs only in disposable CI.');
  assert.equal(packageId, PACKAGE, 'Only the provisional practice APK is permitted.');
  assert.match(isolation?.serial || '', /^emulator-\d+$/, 'Refusing a physical device.');
  assert.equal(isolation.enforced_before_app_launch, true, 'Require pre-launch isolation.');
  assert.equal(isolation.runner_socket_control_passed, true, 'Require a reachable control probe.');
  assert.equal(isolation.app_uid_egress_probe_blocked, true, 'Require demonstrated app egress denial.');
  assert.equal(isolation.loopback_only, true);
  assert.equal(isolation.blocked_uid_range, '10000-199999');
}

export function findAppWebViewSocket(pidOutput, unixSockets) {
  const pids = String(pidOutput).trim().split(/\s+/).filter(Boolean);
  assert.ok(pids.length > 0 && pids.every(pid => /^[1-9]\d*$/.test(pid)), 'Invalid app process ID.');
  const candidates = new Set();
  for (const line of String(unixSockets).split('\n')) {
    const match = line.match(/\s@?(webview_devtools_remote_(\d+))\s*$/);
    if (match && pids.includes(match[2])) candidates.add(match[1]);
  }
  assert.equal(candidates.size, 1, 'Expected exactly one WebView socket belonging to this APK.');
  return [...candidates][0];
}

export function parseForwardPort(output) {
  const text = String(output).trim();
  assert.match(text, /^\d{1,5}$/, 'ADB did not return a loopback forwarding port.');
  const port = Number(text);
  assert.ok(port > 0 && port <= 65535, 'Invalid ADB forwarding port.');
  return port;
}

// Use the installed APK's real debug WebView, not a desktop browser or hosted site.
// Avoid the experimental Android backend's implicit, unbounded WebView scan.
// No ADB reverse, public bind, firewall change, or Android-driver installation.
export async function createNativeWebViewDevice({
  chromium, isolation, ci = process.env.CI, packageId = PACKAGE,
  execute = exec, sleep = pause, checkpoint = () => {},
}) {
  requireIsolatedTransport(isolation, ci, packageId);
  const serial = isolation.serial;
  const adb = async (...args) => {
    const result = await execute('adb', ['-s', serial, ...args], {
      encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
    });
    return String(result.stdout).trim();
  };
  checkpoint('native_transport_model');
  const model = await adb('shell', 'getprop', 'ro.product.model');
  let browser;
  let port;
  let timeout = 45000;
  return {
    model: () => model,
    serial: () => serial,
    setDefaultTimeout(value) {
      assert.ok(Number.isInteger(value) && value > 0 && value <= 60000);
      timeout = value;
    },
    shell: command => adb('shell', command),
    async webView({ pkg }) {
      assert.equal(pkg, packageId);
      assert.equal(browser, undefined, 'Only one native WebView connection is permitted.');
      checkpoint('native_webview_socket');
      let socket;
      let lastError;
      // Bounded readiness polling. Every individual ADB operation also has a deadline.
      const stopAt = Date.now() + timeout;
      do {
        try {
          socket = findAppWebViewSocket(
            await adb('shell', 'pidof', packageId),
            await adb('shell', 'cat', '/proc/net/unix'),
          );
          break;
        } catch (error) {
          lastError = error;
          if (error.killed || error.code === 'ETIMEDOUT') throw error;
          if (Date.now() >= stopAt) break;
          await sleep(500);
        }
      } while (Date.now() < stopAt);
      if (!socket) throw new Error(`Native WebView socket not ready: ${lastError?.message || 'not found'}`);
      checkpoint('native_webview_forward');
      port = parseForwardPort(await adb('forward', 'tcp:0', `localabstract:${socket}`));
      checkpoint('native_webview_cdp');
      // The /devtools/browser endpoint is also used by Playwright's Android adapter.
      browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}/devtools/browser`, { timeout });
      const contexts = browser.contexts();
      assert.equal(contexts.length, 1, 'Expected only the installed APK WebView context.');
      const context = contexts[0];
      const pages = context.pages();
      assert.ok(pages.length <= 1, 'Unexpected extra native WebView targets.');
      const page = pages[0] || await context.waitForEvent('page', { timeout });
      return { page: async () => page };
    },
    async close() {
      try {
        if (browser) await withDeadline(() => browser.close(), 10000, 'Close native CDP connection');
      } finally {
        if (port) await adb('forward', '--remove', `tcp:${port}`);
      }
    },
  };
}
