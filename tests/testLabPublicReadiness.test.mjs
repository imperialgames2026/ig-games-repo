import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicLab } from '../scripts/check-test-lab-public.mjs';
import { LAB_SUPABASE_URL } from '../config/test-lab.js';

const publicKey = 'sb_publishable_readiness_fixture';
const environment = { VITE_SUPABASE_URL: LAB_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey };
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const cors = { 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version' };
test('public preflight distinguishes protected existing tables from missing schema and handlers without reading rows', async () => {
  const requests = [];
  const report = await inspectPublicLab({ environment, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/auth/v1/settings')) return reply({ disable_signup: false, mailer_autoconfirm: false, external: { email: true }, secret: publicKey });
    if (url.includes('/rest/v1/ig_practice_game_catalog')) return reply({ code: 'PGRST205', message: publicKey }, 404);
    if (url.includes('/rest/v1/')) return reply({ code: '42501' }, 401);
    return reply({ code: 'NOT_FOUND' }, 404);
  } });
  assert.equal(report.status, 'backend_setup_required');
  assert.equal(report.auth.signup_enabled, true);
  assert.equal(report.tables.find(item => item.name === 'profiles').state, 'anonymous_read_restricted');
  assert.equal(report.tables.find(item => item.name === 'ig_practice_game_catalog').state, 'missing_or_unexposed');
  assert.ok(report.functions.every(item => item.state === 'not_deployed'));
  assert.ok(requests.every(({ url, options }) => url.startsWith(LAB_SUPABASE_URL + '/') && ['GET', 'OPTIONS'].includes(options.method)));
  assert.ok(requests.filter(({ url }) => url.includes('/rest/')).every(({ url }) => url.endsWith('?select=*&limit=0')));
  assert.ok(requests.every(({ options }) => options.headers.apikey === publicKey && options.redirect === 'error' && !options.body));
  assert.ok(!JSON.stringify(report).includes(publicKey));
});
test('available public endpoints still require complete CORS and do not establish authenticated readiness', async () => {
  const report = await inspectPublicLab({ environment, fetchImpl: async url => {
    if (url.endsWith('/auth/v1/settings')) return reply({ disable_signup: true });
    if (url.includes('/rest/')) return reply([]);
    return reply({}, 200, url.endsWith('/poker-table-v1') ? {} : cors);
  } });
  assert.equal(report.functions.find(item => item.name === 'poker-table-v1').state, 'cors_incomplete');
  assert.equal(report.status, 'backend_setup_required');
  assert.ok(report.limitations.some(value => value.includes('not authenticated gameplay')));
  const ready = await inspectPublicLab({ environment, fetchImpl: async url => reply(url.includes('/rest/') ? [] : {}, 200, cors) });
  assert.equal(ready.status, 'public_surface_available');
  assert.equal(ready.auth.signup_enabled, null);
});
test('incorrect projects fail before network access and failed Auth stops additional probes', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return reply({ message: publicKey }, 401); };
  await assert.rejects(() => inspectPublicLab({ environment: { ...environment, VITE_SUPABASE_URL: 'https://other.supabase.co' }, fetchImpl }), /cannot use another project/);
  assert.equal(calls, 0);
  const report = await inspectPublicLab({ environment, fetchImpl });
  assert.equal(calls, 1);
  assert.deepEqual(report.issues, ['public_auth_connection_unverified']);
  assert.ok(!JSON.stringify(report).includes(publicKey));
});
test('network errors remain safe report data without exposing request credentials', async () => {
  const report = await inspectPublicLab({ environment, fetchImpl: async () => { throw Error(publicKey); } });
  assert.equal(report.auth.status, null);
  assert.ok(!JSON.stringify(report).includes(publicKey));
});
