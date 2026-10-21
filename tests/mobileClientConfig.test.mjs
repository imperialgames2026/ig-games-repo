import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMobileClient, PRACTICE_BACKEND, PRACTICE_PROJECT } from '../scripts/mobile-client-config.mjs';
const good = { VITE_SUPABASE_URL: PRACTICE_BACKEND, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(30), VITE_ENABLE_LEGACY_EDGE_FUNCTIONS: 'false' };
const jwt = payload => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.test-only';
test('accepts a client publishable key without returning it', () => assert.deepEqual(validateMobileClient(good), { kind: 'publishable' }));
test('accepts matching legacy anon key', () => assert.deepEqual(validateMobileClient({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon', ref: PRACTICE_PROJECT }) }), { kind: 'anon' }));
for (const [name, change] of Object.entries({
  missing: { VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  secret: { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_expose_this_key' },
  serviceRole: { VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role', ref: PRACTICE_PROJECT }) },
  foreignAnon: { VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon', ref: 'other-project' }) },
  wrongBackend: { VITE_SUPABASE_URL: 'https://other.supabase.co' },
  legacyEnabled: { VITE_ENABLE_LEGACY_EDGE_FUNCTIONS: 'true' },
  placeholder: { VITE_SUPABASE_PUBLISHABLE_KEY: 'placeholder-key' },
  malformed: { VITE_SUPABASE_PUBLISHABLE_KEY: 'a.b.c' },
})) test(`rejects ${name}`, () => assert.throws(() => validateMobileClient({ ...good, ...change })));
