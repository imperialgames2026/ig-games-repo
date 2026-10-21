import test from 'node:test';
import assert from 'node:assert/strict';
import configuration from '../vite.config.js';
import { resolveTestLabHostingEnvironment } from '../config/test-lab-hosting.js';

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

test('Cloudflare and Vercel test branches pin browser settings to the selected lab', () => {
  for (const branchName of ['CF_PAGES_BRANCH', 'VERCEL_GIT_COMMIT_REF']) {
    withEnvironment({ ...localFixture, [branchName]: 'test', VITE_SUPABASE_URL: 'https://qonqemhljgxlwpghkxhn.supabase.co' }, () => {
      const { define } = build();
      assert.equal(JSON.parse(define['import.meta.env.VITE_SUPABASE_URL']), localFixture.VITE_SUPABASE_URL);
      assert.match(JSON.parse(define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY']), /^sb_publishable_/);
      assert.notEqual(JSON.parse(define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY']), localFixture.VITE_SUPABASE_PUBLISHABLE_KEY);
      assert.equal(define['import.meta.env.VITE_SUPABASE_ANON_KEY'], define['import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY']);
    });
  }
});
test('hosted test settings reject missing, privileged and wrong-project pinned configuration', () => {
  const hosting = { CF_PAGES_BRANCH: 'test' };
  const pinned = { project_ref: 'jvyzpxjqmymafjapprpp', supabase_url: localFixture.VITE_SUPABASE_URL, publishable_key: localFixture.VITE_SUPABASE_PUBLISHABLE_KEY };
  for (const change of [{ publishable_key: '' }, { publishable_key: 'sb_secret_fixture' }, { project_ref: 'another-project' }, { supabase_url: 'https://qonqemhljgxlwpghkxhn.supabase.co' }]) {
    assert.throws(() => resolveTestLabHostingEnvironment({}, hosting, { ...pinned, ...change }));
  }
  assert.equal(resolveTestLabHostingEnvironment({}, hosting, pinned).VITE_SUPABASE_URL, localFixture.VITE_SUPABASE_URL);
});
test('non-hosted browser fixtures and other branches retain their own configuration', () => {
  const environment = { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'browser-test-public-key' };
  assert.equal(resolveTestLabHostingEnvironment(environment, {}), environment);
  withEnvironment({ ...environment, CF_PAGES_BRANCH: 'another-branch' }, () => assert.deepEqual(build().define, {}));
});
