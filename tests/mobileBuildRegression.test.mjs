import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('Login.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const workflow = readFileSync(new URL('../.github/workflows/android-practice.yml', import.meta.url), 'utf8');

function findSubmit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleSubmit') return node;
  return ts.forEachChild(node, findSubmit);
}

// Execute the real handler with mocked dependencies, never a hosted Auth client.
async function submit(mode, { native = false, authError = null, session = null } = {}) {
  const calls = [];
  const busy = [];
  const errors = [];
  const messages = [];
  const destinations = [];
  let prevented = false;
  const copy = value => JSON.parse(JSON.stringify(value));
  const auth = Object.fromEntries(['signInWithPassword', 'signUp', 'resetPasswordForEmail'].map(name => [name, async (...args) => {
    calls.push({ name, args: copy(args) });
    return { data: { session }, error: authError };
  }]));
  const handler = findSubmit(parsed);
  assert.ok(handler, 'Login must retain its submit handler');
  const fn = runInNewContext(`(${handler.getText(parsed)})`, {
    mode,
    window: { location: { origin: 'https://practice.example.test' }, ...(native ? { Capacitor: { isNativePlatform: () => true } } : {}) },
    supabase: { auth },
    email: ' tester@example.test ',
    password: 'test-only-password',
    fullName: ' Practice Tester ',
    returnTo: '/Lobby',
    setBusy: value => busy.push(value),
    setError: value => errors.push(value),
    setMessage: value => messages.push(value),
    navigate: (...args) => destinations.push(copy(args)),
  });
  await fn({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(busy, [true, false], 'busy state must be cleared on every path');
  return { calls, errors, messages, destinations };
}

test('Login JSX parses without syntax errors', () => {
  assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), []);
});

test('generated native guard contains real line breaks, not escaped newline text', () => {
  const guard = source.split('\n').find(line => line.includes('// Native email callbacks'));
  assert.ok(guard);
  assert.ok(!guard.includes('\\n'), 'escaped newlines can comment out the recovery condition');
});

for (const mode of ['signup', 'recovery']) {
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
});

test('browser signup with an immediate session keeps its return route', async () => {
  const result = await submit('signup', { session: { user: { id: 'test-only' } } });
  assert.deepEqual(result.destinations, [['/Lobby', { replace: true }]]);
});

for (const mode of ['signin', 'signup', 'recovery']) {
  test(`${mode} failure shows an error and does not navigate`, async () => {
    const result = await submit(mode, { authError: new Error('Test-only auth failure') });
    assert.equal(result.errors.at(-1), 'Test-only auth failure');
    assert.deepEqual(result.destinations, []);
  });
}

test('Android workflow configuration guard uses actual YAML lines', () => {
  assert.match(workflow, /^      - name: Require public practice client configuration\n        shell: bash\n        run: \|\n/m);
  assert.doesNotMatch(workflow, /\\n[ \t]+(?:shell:|run:|if |echo |exit |fi|- name:)/);
});

test('mobile CI runs web regression tests before the secret-gated APK build', () => {
  assert.match(workflow, /node --test tests\/mobileBuildRegression\.test\.mjs/);
  assert.match(workflow, /debug-apk:\n    needs: web-regression/);
  assert.match(workflow, /'pages\/Login\.jsx'/);
});
