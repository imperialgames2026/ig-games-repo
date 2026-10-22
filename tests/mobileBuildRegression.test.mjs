import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { isNativePracticeApp, assertNativeWalletCreditsDisabled } from '../lib/mobileReleasePolicy.js';

const source = readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('Login.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const workflow = readFileSync(new URL('../.github/workflows/android-practice.yml', import.meta.url), 'utf8');
function findFunction(node, name) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node;
  return ts.forEachChild(node, child => findFunction(child, name));
}

// Execute the actual reconciled handler, never a hosted Auth client.
async function submit(mode, options = {}) {
  const { native = false, authError = null, session = null, confirm = 'test-only-password',
    alreadySubmitting = false, isLoadingAuth = false, cooldown = 0, duplicate = false } = options;
  const calls = [], busy = [], errors = [], messages = [], destinations = [], modes = [], cooldowns = [], passwords = [];
  const submitting = { current: alreadySubmitting };
  let prevented = 0, cleared = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const auth = Object.fromEntries(['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'resend'].map(name => [name, async (...args) => {
    calls.push({ name, args: copy(args) });
    return { data: { session }, error: authError };
  }]));
  const handler = findFunction(parsed, 'handleSubmit');
  assert.ok(handler);
  const fn = runInNewContext(`(${handler.getText(parsed)})`, {
    mode, submitting, isLoadingAuth, cooldown, confirm,
    emailOnly: ['recovery', 'confirmation'].includes(mode),
    window: { location: { origin: 'https://practice.example.test' }, ...(native ? { Capacitor: { isNativePlatform: () => true } } : {}) },
    supabase: { auth }, email: ' tester@example.test ', password: 'test-only-password',
    fullName: ' Practice Tester ', returnTo: '/Lobby',
    setBusy: value => busy.push(value), setError: value => errors.push(value), setMessage: value => messages.push(value),
    setMode: value => modes.push(value), setCooldown: value => cooldowns.push(value),
    setPassword: value => passwords.push(value), setConfirm: () => {}, clearAuthLinkError: () => { cleared++; },
    navigate: (...args) => destinations.push(copy(args)),
  });
  const event = { preventDefault() { prevented++; } };
  const first = fn(event);
  if (duplicate) await fn(event);
  await first;
  assert.equal(prevented, duplicate ? 2 : 1);
  const earlyReturn = alreadySubmitting || isLoadingAuth || (['recovery', 'confirmation'].includes(mode) && cooldown) || (mode === 'signup' && confirm !== 'test-only-password');
  assert.deepEqual(busy, earlyReturn ? [] : [true, false]);
  if (!alreadySubmitting) assert.equal(submitting.current, false);
  return { calls, errors, messages, destinations, modes, cooldowns, passwords, cleared };
}

test('Login JSX parses without syntax errors', () => {
  assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});
test('generated native guard contains real line breaks, not escaped newline text', () => {
  const guard = source.split('\n').find(line => line.includes('// Native email callbacks'));
  assert.ok(guard && !guard.includes('\\n'));
});
for (const mode of ['signup', 'recovery', 'confirmation']) {
  test(`native ${mode} is blocked before calling Supabase`, async () => {
    const result = await submit(mode, { native: true });
    assert.deepEqual(result.calls, []);
    assert.deepEqual(result.destinations, []);
    assert.match(result.errors.at(-1), /Mobile email confirmation and password recovery are not enabled/);
  });
}
for (const native of [false, true]) {
  test(`${native ? 'native' : 'browser'} password sign-in still calls canonical Auth`, async () => {
    const result = await submit('signin', { native });
    assert.deepEqual(result.calls, [{ name: 'signInWithPassword', args: [{ email: 'tester@example.test', password: 'test-only-password' }] }]);
    assert.deepEqual(result.destinations, [['/Lobby', { replace: true }]]);
    assert.deepEqual(result.errors, ['']);
    assert.deepEqual(result.passwords, ['']);
  });
}
test('browser recovery preserves its existing explicit reset route', async () => {
  const result = await submit('recovery');
  assert.deepEqual(result.calls, [{ name: 'resetPasswordForEmail', args: ['tester@example.test', { redirectTo: 'https://practice.example.test/ResetPassword' }] }]);
  assert.match(result.messages.at(-1), /If an account exists/);
  assert.deepEqual(result.destinations, []);
});
test('browser signup preserves confirmation redirect and metadata', async () => {
  const result = await submit('signup');
  assert.deepEqual(result.calls, [{ name: 'signUp', args: [{ email: 'tester@example.test', password: 'test-only-password', options: { data: { full_name: 'Practice Tester' }, emailRedirectTo: 'https://practice.example.test' } }] }]);
  assert.match(result.messages.at(-1), /Check your email/);
  assert.deepEqual(result.destinations, []);
  assert.deepEqual(result.modes, ['confirmation']);
});
test('browser signup with an immediate session keeps its return route', async () => {
  const result = await submit('signup', { session: { user: { id: 'test-only' } } });
  assert.deepEqual(result.destinations, [['/Lobby', { replace: true }]]);
});
for (const mode of ['signin', 'signup', 'recovery', 'confirmation']) {
  test(`${mode} failure shows an error and does not navigate`, async () => {
    const result = await submit(mode, { authError: new Error('Test-only auth failure') });
    assert.equal(result.errors.at(-1), 'Test-only auth failure');
    assert.deepEqual(result.destinations, []);
  });
}
test('browser confirmation resend preserves the reviewed web redirect and cooldown', async () => {
  const result = await submit('confirmation');
  assert.deepEqual(result.calls, [{ name: 'resend', args: [{ type: 'signup', email: 'tester@example.test', options: { emailRedirectTo: 'https://practice.example.test' } }] }]);
  assert.deepEqual(result.cooldowns, [60]);
  assert.match(result.messages.at(-1), /awaiting confirmation/);
});
test('mismatched passwords never call the signup service', async () => {
  const result = await submit('signup', { confirm: 'wrong' });
  assert.equal(result.calls.length, 0);
  assert.equal(result.errors.at(-1), 'Passwords must match.');
});
test('duplicate submit, auth loading and email cooldown guards survive reconciliation', async () => {
  for (const opts of [{ alreadySubmitting: true }, { isLoadingAuth: true }, { cooldown: 30 }]) {
    assert.equal((await submit('confirmation', opts)).calls.length, 0);
  }
  assert.equal((await submit('signin', { duplicate: true })).calls.length, 1);
});
test('unconfirmed account and rate-limit handling survive reconciliation', async () => {
  const first = await submit('signin', { authError: { code: 'email_not_confirmed', message: 'Confirm email' } });
  assert.deepEqual(first.modes, ['confirmation']);
  const limited = await submit('recovery', { authError: { status: 429, message: 'Rate limited' } });
  assert.deepEqual(limited.cooldowns, [60]);
});
test('Android workflow configuration guard uses actual YAML lines', () => {
  assert.match(workflow, /^      - name: Require public practice client configuration\n        shell: bash\n        run: \|\n/m);
  assert.doesNotMatch(workflow, /\\n[ \t]+(?:shell:|run:|if |echo |exit |fi|- name:)/);
});
test('mobile CI runs web regression tests before the APK build', () => {
  assert.match(workflow, /node --test tests\/mobileBuildRegression\.test\.mjs/);
  assert.match(workflow, /debug-apk:\n    needs: web-regression/);
  assert.match(workflow, /'pages\/Login\.jsx'/);
});

test('native product guard blocks native and broken bridges without changing browser scope', () => {
  assert.equal(isNativePracticeApp(undefined), false);
  assert.equal(isNativePracticeApp({ isNativePlatform: () => false, getPlatform: () => 'web' }), false);
  assert.doesNotThrow(() => assertNativeWalletCreditsDisabled({ getPlatform: () => 'web' }));
  for (const runtime of [{ isNativePlatform: () => true }, { getPlatform: () => 'android' }, { getPlatform: () => 'ios' }, { isNativePlatform() { throw Error('Broken bridge'); } }]) {
    assert.equal(isNativePracticeApp(runtime), true);
    assert.throws(() => assertNativeWalletCreditsDisabled(runtime), error => error.code === 'NATIVE_REDEMPTION_DISABLED');
  }
});
test('actual native reward-service wrapper rejects spin and publish before any delegate call', async () => {
  const serviceSource = readFileSync(new URL('../lib/vipWheelDraw.js', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('vipWheelDraw.js', serviceSource, ts.ScriptTarget.Latest, true);
  const declaration = findFunction(ast, 'createVipWheelDraw');
  const calls = [];
  const service = { spin: async () => calls.push('spin'), publish: async () => calls.push('publish'), receipts: async () => 'read-only' };
  const make = native => runInNewContext(`(${declaration.getText(ast).replace(/^export\s+/, '')})`, {
    createWebVipWheelDraw: () => service,
    assertNativeWalletCreditsDisabled: () => assertNativeWalletCreditsDisabled({ isNativePlatform: () => native }),
  })({});
  const native = make(true);
  await assert.rejects(native.spin('owner', 1, 1), error => error.code === 'NATIVE_REDEMPTION_DISABLED');
  await assert.rejects(native.publish(1, 1, 1, true), error => error.code === 'NATIVE_REDEMPTION_DISABLED');
  assert.deepEqual(calls, []);
  assert.equal(await native.receipts(), 'read-only');
  const web = make(false);
  await web.spin('owner', 1, 1); await web.publish(1, 1, 1, true);
  assert.deepEqual(calls, ['spin', 'publish']);
});
test('native player and admin wrappers do not mount interactive reward components', () => {
  for (const [path, exported, webComponent] of [
    ['../components/casino/VIPRewardWheel.jsx', 'VIPRewardWheel', 'WebVIPRewardWheel'],
    ['../pages/AdminRewardWheels.jsx', 'AdminRewardWheels', 'WebRewardWheelSettings'],
  ]) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    assert.deepEqual(ast.parseDiagnostics, []);
    const declaration = findFunction(ast, exported).getText(ast).replace(/^export default\s+/, '');
    const js = ts.transpileModule('const component = ' + declaration + '; component();', { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText;
    for (const native of [true, false]) {
      const result = runInNewContext(js, {
        React: { createElement: type => type }, isNativePracticeApp: () => native,
        NativeRewardWheelNotice: 'notice', [webComponent]: 'web',
      });
      assert.equal(result, native ? 'notice' : 'web');
    }
  }
});
