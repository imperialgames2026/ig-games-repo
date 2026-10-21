import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LAB_PROJECT_REF } from '../config/test-lab.js';
import { prepareTestLabBackend } from '../scripts/prepare-test-lab-backend.mjs';
import { validateLabCandidate, planLabMigrations, planLabFunctions, summarizeLabAuth,
  createLabManagementReader, inspectTestLabManagement, LAB_READ_ONLY_QUERIES, parseLabInspectionOptions } from '../scripts/inspect-test-lab-management.mjs';

const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'ig-lab-inspection-test-'));
  const sourceRoot = join(workspace, 'source'), candidateDirectory = join(workspace, 'candidate');
  mkdirSync(sourceRoot);
  cpSync(new URL('../supabase/', import.meta.url), join(sourceRoot, 'supabase'), { recursive: true });
  prepareTestLabBackend({ output: candidateDirectory, sourceRoot });
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  return { workspace, sourceRoot, candidateDirectory };
}
function changeReport(f, change) {
  const file = join(f.candidateDirectory, 'test-lab-backend-report.json');
  const report = JSON.parse(readFileSync(file));
  change(report);
  writeFileSync(file, JSON.stringify(report));
}
const migration = (version, sql) => ({ version, file: version + '_example.sql', sql, sha256: checksum(sql) });
const object = { schema_name: 'public', object_name: 'profiles', object_kind: 'r' };
const metadata = { name: 'poker-table-v1', slug: 'poker-table-v1', version: 1, status: 'ACTIVE', verify_jwt: true, import_map: false, entrypoint_path: 'file:///src/index.ts' };

test('inspector verifies an existing candidate without reapplying it and rejects generated or original checksum drift', t => {
  const valid = fixture(t);
  const candidate = validateLabCandidate(valid.candidateDirectory, valid);
  assert.equal(candidate.project_ref, LAB_PROJECT_REF);
  assert.equal(candidate.migrations.length, 98);
  assert.equal(candidate.functions.length, 21);
  const sourceManifest = readFileSync(join(valid.sourceRoot, 'supabase/backend-manifest.json'));
  const reportBefore = readFileSync(join(valid.candidateDirectory, 'test-lab-backend-report.json'));
  validateLabCandidate(valid.candidateDirectory, valid);
  assert.deepEqual(readFileSync(join(valid.sourceRoot, 'supabase/backend-manifest.json')), sourceManifest);
  assert.deepEqual(readFileSync(join(valid.candidateDirectory, 'test-lab-backend-report.json')), reportBefore);
  const first = candidate.migrations[0];
  appendFileSync(join(valid.candidateDirectory, 'supabase/migrations', first.file), '\nselect 99;\n');
  assert.throws(() => validateLabCandidate(valid.candidateDirectory, valid), /Checksum mismatch/);
  const original = fixture(t);
  appendFileSync(join(original.sourceRoot, 'supabase/functions/secure-wallet/index.ts'), '\n// changed excluded source\n');
  assert.throws(() => validateLabCandidate(original.candidateDirectory, original), /Checksum mismatch/);
});

test('candidate report cannot authorize a different target, escaping path, unsafe config or changed function set', t => {
  const target = fixture(t);
  changeReport(target, report => { report.project_ref = 'qonqemhljgxlwpghkxhn'; });
  assert.throws(() => validateLabCandidate(target.candidateDirectory, target), /confirmed lab/);
  const path = fixture(t);
  changeReport(path, report => { report.migrations[0].source_path = '../../outside.sql'; });
  assert.throws(() => validateLabCandidate(path.candidateDirectory, path), /artifact mapping/);
  const config = fixture(t);
  const configPath = join(config.candidateDirectory, 'supabase/config.toml');
  const unsafeConfig = readFileSync(configPath, 'utf8').replace('verify_jwt = true', 'verify_jwt = false');
  writeFileSync(configPath, unsafeConfig);
  changeReport(config, report => { report.config_sha256 = checksum(unsafeConfig); });
  assert.throws(() => validateLabCandidate(config.candidateDirectory, config), /config differs/);
  const functions = fixture(t);
  changeReport(functions, report => { report.functions[0].name = 'secure-wallet'; });
  assert.throws(() => validateLabCandidate(functions.candidateDirectory, functions), /allowlist changed/);
});

test('migration plan compares generated lab SQL exactly and blocks unknown, changed, unverifiable or gapped history', () => {
  const a = migration('20261020000000', 'create table public.example(id uuid);\n');
  const b = migration('20261021000000', "select 'jvyzpxjqmymafjapprpp';\n");
  const row = item => ({ version: item.version, statements: [item.sql] });
  const match = planLabMigrations([a, b], [row(a)], { publicObjects: [object] });
  assert.equal(match.reconciliation_required, false);
  assert.equal(match.matching.length, 1);
  assert.deepEqual(match.missing.map(item => item.version), [b.version]);
  const wrongProjectSql = row(b); wrongProjectSql.statements = [b.sql.replace(LAB_PROJECT_REF, 'qonqemhljgxlwpghkxhn')];
  for (const [history, code] of [
    [[row(a), { version: '20261020000001', statements: ['select 1'] }], 'unknown_hosted_migration'],
    [[row(a), wrongProjectSql], 'hosted_sql_differs_or_is_unverifiable'],
    [[{ ...row(a), statements: null }], 'hosted_sql_differs_or_is_unverifiable'],
    [[row(b)], 'hosted_history_has_candidate_gaps'],
    [[row(a), row(a)], 'invalid_or_duplicate_hosted_history'],
  ]) assert.ok(planLabMigrations([a, b], history, { publicObjects: [object] }).blockers.some(blocker => blocker.code === code), code);
});

test('empty or missing history with existing public tables cannot become a fresh-project replay proposal', () => {
  const a = migration('20261021000000', 'select 1;\n');
  for (const historyPresent of [true, false]) {
    const partial = planLabMigrations([a], [], { historyPresent, publicObjects: [object] });
    assert.equal(partial.fresh_schema_candidate, false);
    assert.equal(partial.reconciliation_required, true);
    assert.match(partial.blockers[0].code, /history_with_existing_public_objects/);
  }
  const empty = planLabMigrations([a], [], { historyPresent: false, publicObjects: [] });
  assert.equal(empty.fresh_schema_candidate, true);
  assert.equal(empty.missing.length, 1);
  assert.equal(empty.reconciliation_required, false);
});

test('function plan verifies generated sources and JWT configuration and blocks unknown, missing-proof or racing content', () => {
  const source = Buffer.from('Deno.serve(() => Response.json({practiceOnly:true}));');
  const functions = [{ name: metadata.name, verify_jwt: true, files: { 'index.ts': source } }];
  const observed = { [metadata.name]: { files: { 'index.ts': source } } };
  const match = planLabFunctions(functions, [metadata], observed);
  assert.equal(match.reconciliation_required, false);
  assert.equal(match.entries[0].status, 'generated_source_and_jwt_match');
  assert.equal(planLabFunctions(functions, []).entries[0].status, 'missing_candidate_handler');
  for (const [remote, observations, code] of [
    [[metadata, { ...metadata, name: 'secure-wallet', slug: 'secure-wallet' }], observed, 'unknown_or_excluded_hosted_function'],
    [[{ ...metadata, verify_jwt: false }], observed, 'hosted_function_configuration_differs'],
    [[metadata], {}, 'hosted_function_source_unverified'],
    [[metadata], { [metadata.name]: { ...observed[metadata.name], changedDuringRead: true } }, 'hosted_function_changed_during_inspection'],
    [[metadata], { [metadata.name]: { files: { 'index.ts': Buffer.from('changed') } } }, 'hosted_function_source_differs'],
    [[metadata], { [metadata.name]: { files: { 'index.ts': source, 'extra.ts': source } } }, 'hosted_function_source_differs'],
  ]) assert.ok(planLabFunctions(functions, remote, observations).blockers.some(blocker => blocker.code === code), code);
});

test('Auth summary exposes only approved flags and origins, omitting credentials, URL userinfo, paths and tokens', () => {
  const secret = 'do-not-emit-fixture-secret';
  const summary = summarizeLabAuth({ site_url: `https://user:${secret}@lab.example/account?token=${secret}`,
    uri_allow_list: `https://lab.example/ResetPassword?token=${secret},https://preview.example/path,mailto:${secret}`,
    smtp_pass: secret, external_google_secret: secret, disable_signup: false, external_email_enabled: true,
    mailer_autoconfirm: false, custom_secret: secret });
  assert.equal(summary.site_origin, 'https://lab.example');
  assert.deepEqual(summary.redirect_origins, ['https://lab.example', 'https://preview.example']);
  assert.equal(summary.invalid_redirect_entries, 1);
  assert.deepEqual(summary.flags, { disable_signup: false, external_email_enabled: true, mailer_autoconfirm: false });
  assert.ok(!JSON.stringify(summary).includes(secret));
  assert.ok(!JSON.stringify(summary).includes('smtp'));
  assert.ok(!JSON.stringify(summary).includes('ResetPassword'));
});

test('management transport is pinned to the lab and has only GETs or immutable read_only SELECT queries', async () => {
  const requests = [];
  const reader = createLabManagementReader({ token: 'fixture-only-management-token', fetchImpl: async (url, options) => {
    requests.push({ url, options }); return Response.json([]);
  } });
  await reader.project(); await reader.auth(); await reader.functions(); await reader.functionMetadata('poker-table-v1');
  for (const query of Object.keys(LAB_READ_ONLY_QUERIES)) await reader.query(query);
  for (const { url, options } of requests) {
    assert.ok(url.startsWith('https://api.supabase.com/v1/projects/' + LAB_PROJECT_REF));
    assert.equal(options.redirect, 'error', 'Redirects cannot move authenticated reads outside the confirmed project');
    if (options.method === 'POST') {
      assert.ok(url.endsWith('/database/query'));
      const body = JSON.parse(options.body);
      assert.equal(body.read_only, true);
      assert.ok(Object.values(LAB_READ_ONLY_QUERIES).includes(body.query));
      assert.match(body.query, /^select /i);
    } else assert.equal(options.method, 'GET');
  }
  const before = requests.length;
  await assert.rejects(reader.query('deleteEverything'), /Unknown read-only query/);
  await assert.rejects(reader.functionMetadata('../another-project'), /Invalid function name/);
  assert.equal(requests.length, before);
  assert.ok(!Object.keys(reader).some(name => /apply|delete|deploy|patch/i.test(name)));
  assert.throws(() => createLabManagementReader({ token: '' }), /Missing SUPABASE_ACCESS_TOKEN/);
  for (const arg of ['--apply', '--project-ref=other', '--project-ref=' + LAB_PROJECT_REF, '--candidate=']) {
    assert.throws(() => parseLabInspectionOptions([arg]));
  }
});

function fakeManagement({ objects = [object], history = [], functions = [], source, after, failures = [] } = {}) {
  const requests = [], secret = 'never-emit-management-fixture-secret';
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method, body: options.body });
    const suffix = url.split('/projects/' + LAB_PROJECT_REF)[1];
    if (failures.includes(suffix)) return Response.json({ secret }, { status: 401 });
    if (suffix === '') return Response.json({ id: LAB_PROJECT_REF, status: 'ACTIVE_HEALTHY', region: 'us-east-1', database: { password: secret } });
    if (suffix === '/config/auth') return Response.json({ site_url: 'https://lab.example', uri_allow_list: 'https://lab.example/ResetPassword', smtp_pass: secret, disable_signup: false });
    if (suffix === '/functions') return Response.json(functions);
    if (suffix.endsWith('/body')) {
      const form = new FormData();
      form.set('metadata', JSON.stringify({ entrypoint_path: 'file:///src/index.ts' }));
      form.append('file', new Blob([source || '']), '/src/index.ts');
      return new Response(form);
    }
    if (suffix.startsWith('/functions/')) return Response.json(after || functions[0]);
    if (suffix === '/database/query') {
      const body = JSON.parse(options.body);
      assert.equal(body.read_only, true);
      if (body.query === LAB_READ_ONLY_QUERIES.historyPresence) return Response.json([{ history_present: true }]);
      if (body.query === LAB_READ_ONLY_QUERIES.migrationHistory) return Response.json(history);
      if (body.query === LAB_READ_ONLY_QUERIES.publicObjects) return Response.json(objects);
      if (body.query === LAB_READ_ONLY_QUERIES.publicRoutines) return Response.json([]);
    }
    throw Error('Unexpected fixture request');
  };
  return { fetchImpl, requests, secret };
}

test('full read-only plan preserves partial-schema evidence, reports missing handlers and redacts raw API objects', async t => {
  const f = fixture(t), fake = fakeManagement();
  const plan = await inspectTestLabManagement({ ...f, token: 'fixture-only-management-token', fetchImpl: fake.fetchImpl });
  assert.equal(plan.status, 'reconciliation_required');
  assert.equal(plan.migrations.fresh_schema_candidate, false);
  assert.ok(plan.blockers.some(blocker => blocker.code === 'empty_history_with_existing_public_objects'));
  assert.equal(plan.functions.entries.filter(fn => fn.status === 'missing_candidate_handler').length, 21);
  assert.equal(plan.public_schema.objects[0].name, 'profiles');
  assert.equal(plan.remote_mutations_performed, false);
  assert.equal(plan.application_authorized_by_this_plan, false);
  assert.ok(!JSON.stringify(plan).includes(fake.secret));
  assert.ok(!JSON.stringify(plan).includes('fixture-only-management-token'));
  assert.ok(fake.requests.every(request => request.method === 'GET' || JSON.parse(request.body).read_only === true));
});

test('live-function source proof uses a post-download metadata guard; failed reads cannot yield a complete plan', async t => {
  const f = fixture(t), candidate = validateLabCandidate(f.candidateDirectory, f);
  const fn = candidate.functions.find(fn => fn.name === metadata.name);
  const fake = fakeManagement({ objects: [], functions: [metadata], source: fn.files['index.ts'], after: { ...metadata, version: 2 } });
  const racing = await inspectTestLabManagement({ ...f, token: 'fixture', fetchImpl: fake.fetchImpl });
  assert.ok(racing.blockers.some(blocker => blocker.code === 'hosted_function_changed_during_inspection'));
  const failed = fakeManagement({ failures: ['/config/auth', '/functions'] });
  const incomplete = await inspectTestLabManagement({ ...f, token: 'fixture', fetchImpl: failed.fetchImpl });
  assert.equal(incomplete.status, 'reconciliation_required');
  assert.ok(incomplete.blockers.some(blocker => blocker.code === 'function_reconciliation_unverified'));
  assert.ok(incomplete.blockers.some(blocker => blocker.code === 'auth_configuration_unverified'));
  assert.ok(!JSON.stringify(incomplete).includes(failed.secret));
});

test('list/detail response shape differences do not fabricate a function version race', async t => {
  const f = fixture(t), candidate = validateLabCandidate(f.candidateDirectory, f);
  const fn = candidate.functions.find(fn => fn.name === metadata.name);
  const { entrypoint_path, ...listMetadata } = metadata;
  const fake = fakeManagement({ objects: [], functions: [listMetadata], source: fn.files['index.ts'], after: metadata });
  const plan = await inspectTestLabManagement({ ...f, token: 'fixture', fetchImpl: fake.fetchImpl });
  assert.ok(!plan.blockers.some(blocker => blocker.code === 'hosted_function_changed_during_inspection'));
  assert.equal(plan.functions.entries.find(entry => entry.name === metadata.name).status, 'generated_source_and_jwt_match');
  assert.ok(entrypoint_path);
});

test('missing management token or invalid candidate prevents every network request', async t => {
  const f = fixture(t);
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error('must not execute'); };
  await assert.rejects(inspectTestLabManagement({ ...f, token: '', fetchImpl }), /Missing SUPABASE_ACCESS_TOKEN/);
  changeReport(f, report => { report.project_ref = 'another-project'; });
  await assert.rejects(inspectTestLabManagement({ ...f, token: 'fixture', fetchImpl }), /confirmed lab/);
  assert.equal(calls, 0);
});
