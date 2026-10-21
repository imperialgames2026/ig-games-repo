import test from 'node:test';
import assert from 'node:assert/strict';
import configuration from '../vite.config.js';

const names = ['CF_PAGES_BRANCH', 'VERCEL_GIT_COMMIT_REF', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];
function withEnvironment(values, action) {
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, values);
    return action();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}
const localFixture = {
  VITE_SUPABASE_URL: 'https://jvyzpxjqmymafjapprpp.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_hosting_test_fixture',
};
const build = () => configuration({ command: 'build', mode: 'production' });

test('Cloudflare and Vercel test branches reject the older production backend', () => {
  for (const branchName of ['CF_PAGES_BRANCH', 'VERCEL_GIT_COMMIT_REF']) {
    withEnvironment({ ...localFixture, [branchName]: 'test', VITE_SUPABASE_URL: 'https://qonqemhljgxlwpghkxhn.supabase.co' }, () => assert.throws(build));
  }
});
test('hosted test builds require a public key and accept explicit lab configuration', () => {
  withEnvironment({ ...localFixture, CF_PAGES_BRANCH: 'test', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' }, () => assert.throws(build));
  withEnvironment({ ...localFixture, CF_PAGES_BRANCH: 'test' }, () => assert.ok(build().plugins.length));
});
test('non-hosted browser fixtures and other branches retain their own configuration', () => {
  withEnvironment({ CF_PAGES_BRANCH: 'another-branch', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'browser-test-public-key' }, () => assert.ok(build().plugins.length));
});
