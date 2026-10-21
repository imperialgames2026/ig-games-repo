import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { LAB_PROJECT_REF, LAB_SUPABASE_URL, validateLabConfiguration } from '../config/test-lab.js';
import { TEST_LAB_FUNCTIONS } from './prepare-test-lab-backend.mjs';

export const REQUIRED_LAB_TABLES = Object.freeze([
  'profiles', 'user_roles', 'ig_practice_game_catalog', 'ig_announcements',
  'poker_tables_v1', 'poker_seats_v1', 'poker_events_v1',
]);
const requiredCorsHeaders = ['authorization', 'apikey', 'content-type', 'x-client-info', 'x-supabase-api-version'];
const knownErrorCode = value => typeof value === 'string' && /^(?:PGRST\d{3}|42501|NOT_FOUND)$/.test(value) ? value : null;

/** Public connectivity only: no signup, sessions, mutation calls or row reads. */
export async function inspectPublicLab({ environment, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  validateLabConfiguration(environment || {});
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY;
  const headers = { apikey: key, authorization: 'Bearer ' + key, Origin: 'https://imperialgaming.llc' };
  async function request(path, method = 'GET') {
    try {
      const response = await fetchImpl(LAB_SUPABASE_URL + path, {
        method, headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
      });
      const body = await response.json().catch(() => null);
      return { status: response.status, body, headers: response.headers };
    } catch {
      // Never echo request/response details: errors can contain credentials.
      return { status: null, body: null, headers: new Headers() };
    }
  }
  const auth = await request('/auth/v1/settings');
  const authReport = {
    status: auth.status, available: auth.status === 200,
    signup_enabled: typeof auth.body?.disable_signup === 'boolean' ? !auth.body.disable_signup : null,
    email_enabled: typeof auth.body?.external?.email === 'boolean' ? auth.body.external.email : null,
    email_autoconfirm: typeof auth.body?.mailer_autoconfirm === 'boolean' ? auth.body.mailer_autoconfirm : null,
  };
  const report = {
    schema_version: 1, project_ref: LAB_PROJECT_REF, supabase_url: LAB_SUPABASE_URL,
    observed_at: new Date().toISOString(), read_only: true,
    status: 'backend_setup_required', auth: authReport, tables: [], functions: [], issues: [],
    limitations: [
      'Zero-row anonymous requests establish API exposure only, not complete schema or migration history.',
      'OPTIONS checks establish function availability/CORS only, not authenticated gameplay or authorization.',
      'No account, bot, schema, configuration or deployment is created or changed.',
    ],
  };
  if (!authReport.available) {
    report.issues.push('public_auth_connection_unverified');
    return report;
  }
  const jobs = [
    ...REQUIRED_LAB_TABLES.map(name => async () => {
      const result = await request('/rest/v1/' + name + '?select=*&limit=0');
      const code = knownErrorCode(result.body?.code);
      const state = result.status === 200 ? 'anonymous_api_available'
        : [401, 403].includes(result.status) && code === '42501' ? 'anonymous_read_restricted'
          : code === 'PGRST205' ? 'missing_or_unexposed' : 'unverified';
      return { kind: 'table', name, status: result.status, code, state };
    }),
    ...TEST_LAB_FUNCTIONS.map(name => async () => {
      const result = await request('/functions/v1/' + name, 'OPTIONS');
      const allowed = (result.headers.get('access-control-allow-headers') || '').toLowerCase().split(',').map(value => value.trim());
      const missingHeaders = requiredCorsHeaders.filter(value => !allowed.includes(value));
      const code = knownErrorCode(result.body?.code);
      const state = result.status >= 200 && result.status < 300 ? (missingHeaders.length ? 'cors_incomplete' : 'available')
        : result.status === 404 && code === 'NOT_FOUND' ? 'not_deployed' : 'unverified';
      return { kind: 'function', name, status: result.status, code, state, missing_cors_headers: missingHeaders };
    }),
  ];
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= jobs.length) return;
      results[index] = await jobs[index]();
    }
  }));
  report.tables = results.filter(item => item.kind === 'table').map(({ kind, ...item }) => item);
  report.functions = results.filter(item => item.kind === 'function').map(({ kind, ...item }) => item);
  for (const item of report.tables) if (!['anonymous_api_available', 'anonymous_read_restricted'].includes(item.state)) report.issues.push('table:' + item.name + ':' + item.state);
  for (const item of report.functions) if (item.state !== 'available') report.issues.push('function:' + item.name + ':' + item.state);
  if (!report.issues.length) report.status = 'public_surface_available';
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--output')) throw Error('Usage: node --use-env-proxy scripts/check-test-lab-public.mjs [--output <new-report-file>]');
    const environment = loadEnv('lab', fileURLToPath(new URL('../', import.meta.url)), 'VITE_');
    environment.VITE_SUPABASE_URL ??= LAB_SUPABASE_URL;
    const report = await inspectPublicLab({ environment });
    const json = JSON.stringify(report, null, 2) + '\n';
    if (args[1]) writeFileSync(args[1], json, { flag: 'wx' });
    console.log(json);
    if (report.issues.length) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
