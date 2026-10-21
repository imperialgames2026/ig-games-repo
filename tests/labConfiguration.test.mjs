import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_PROJECT_REF, LAB_SUPABASE_URL, validateLabConfiguration } from '../config/test-lab.js';

const jwt = payload => ['header', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'signature'].join('.');
test('lab builds accept public project keys and reject absent or privileged credentials', () => {
  const environment = { VITE_SUPABASE_URL: LAB_SUPABASE_URL };
  assert.throws(() => validateLabConfiguration(environment), /public publishable key/);
  assert.throws(() => validateLabConfiguration({ ...environment, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_example' }), /cannot be bundled/);
  assert.throws(() => validateLabConfiguration({ ...environment, VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role', ref: LAB_PROJECT_REF }) }), /cannot be bundled/);
  assert.doesNotThrow(() => validateLabConfiguration({ ...environment, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_configuration_fixture' }));
  assert.doesNotThrow(() => validateLabConfiguration({ ...environment, VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon', ref: LAB_PROJECT_REF }) }));
});
test('lab builds reject stale staging URLs and public keys for another project', () => {
  assert.throws(() => validateLabConfiguration({ VITE_SUPABASE_URL: 'https://qonqemhljgxlwpghkxhn.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_configuration_fixture' }), /cannot use another project/);
  assert.throws(() => validateLabConfiguration({ VITE_SUPABASE_URL: LAB_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon', ref: 'qonqemhljgxlwpghkxhn' }) }), /cannot be bundled/);
});
