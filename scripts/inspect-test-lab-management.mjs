import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAB_PROJECT_REF, LAB_SUPABASE_URL } from '../config/test-lab.js';
import { STAGING_PROJECT_REF, TEST_LAB_FUNCTIONS } from './prepare-test-lab-backend.mjs';
import { matchesRecordedSql } from './deploy-reviewed-staging.mjs';
import { readFunctionMultipart } from './plan-reviewed-functions.mjs';

const sourceRootDefault = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidateDefault = resolve(sourceRootDefault, '../ig-test-lab-candidate');
const pendingNames = ['poker-table-v1', 'ig-poker-bot-lab', 'poker-events-v1'];
const pendingMigration = '20261021013000_poker_tester_table_lifecycle.sql';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (base, file) => { const rel = relative(base, file); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); };
const identifier = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_$-]{0,127}$/.test(value);

function checkedFile(base, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') ||
      path.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid candidate/source path');
  const file = resolve(base, path);
  if (!within(base, file) || !within(realpathSync(base), realpathSync(file)) || !lstatSync(file).isFile()) throw Error('Candidate/source path escapes its directory');
  return readFileSync(file);
}
function verifiedFile(base, path, checksum) {
  const bytes = checkedFile(base, path);
  if (!/^[a-f0-9]{64}$/.test(checksum || '') || hash(bytes) !== checksum) throw Error('Checksum mismatch: ' + path);
  return bytes;
}
function requireCondition(condition, message) { if (!condition) throw Error(message); }
const sameNames = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Validate existing files; never regenerate, import, repair or apply them. */
export function validateLabCandidate(candidateDirectory, { sourceRoot = sourceRootDefault } = {}) {
  const root = realpathSync(sourceRoot), directory = realpathSync(candidateDirectory);
  const report = JSON.parse(checkedFile(directory, 'test-lab-backend-report.json'));
  requireCondition(report.schema_version === 1 && report.status === 'offline_candidate_not_deployed' &&
    report.project_ref === LAB_PROJECT_REF && report.supabase_url === LAB_SUPABASE_URL &&
    report.source_project_ref === STAGING_PROJECT_REF, 'Candidate is not for the confirmed lab');
  requireCondition(report.project_reference_transform?.from === STAGING_PROJECT_REF &&
    report.project_reference_transform?.to === LAB_PROJECT_REF &&
    report.project_reference_transform?.operation === 'exact_string_substitution_in_generated_files_only', 'Unexpected candidate transform');
  const original = JSON.parse(verifiedFile(root, 'supabase/backend-manifest.json', report.source_manifest_sha256));
  const pending = JSON.parse(verifiedFile(root, 'supabase/test-lab-poker-candidates.json', report.pending_poker_manifest_sha256));
  requireCondition(original.project_ref === STAGING_PROJECT_REF && Array.isArray(original.migrations) && Array.isArray(original.functions), 'Invalid original manifest');
  requireCondition(pending.schema_version === 1 && pending.target_project_ref === LAB_PROJECT_REF &&
    Array.isArray(pending.functions) && sameNames(pending.functions.map(fn => fn.name), pendingNames) &&
    pending.migrations?.length === 1 && pending.migrations[0].file === pendingMigration, 'Unexpected pending candidate sources');
  const sources = new Map();
  for (const migration of original.migrations) {
    requireCondition(/^\d{14}_[a-zA-Z0-9_]+\.sql$/.test(migration.file), 'Invalid source migration path');
    const path = 'supabase/deployed-migrations/' + migration.file;
    sources.set(path, verifiedFile(root, path, migration.sha256));
  }
  for (const fn of original.functions) {
    requireCondition(/^[a-z0-9-]+$/.test(fn.name) && Array.isArray(fn.files), 'Invalid source function');
    for (const name of fn.files) {
      const path = 'supabase/functions/' + fn.name + '/' + name;
      sources.set(path, verifiedFile(root, path, fn.sha256?.[name]));
    }
  }
  for (const migration of pending.migrations) {
    const path = 'supabase/migrations/' + migration.file;
    sources.set(path, verifiedFile(root, path, migration.sha256));
  }
  for (const fn of pending.functions) {
    requireCondition(fn.files?.length === 1 && fn.files[0] === 'index.ts', 'Unexpected pending handler files');
    const path = 'supabase/pending-functions/' + fn.name + '/index.ts';
    sources.set(path, verifiedFile(root, path, fn.sha256?.['index.ts']));
  }
  function validateGenerated(entry, path, sourcePath, status) {
    requireCondition(entry?.path === path && entry.source_path === sourcePath && entry.source_status === status, 'Unexpected generated artifact mapping');
    const source = sources.get(sourcePath);
    requireCondition(!!source && hash(source) === entry.source_sha256, 'Generated report source checksum mismatch');
    const transformed = Buffer.from(source.toString('utf8').replaceAll(STAGING_PROJECT_REF, LAB_PROJECT_REF));
    requireCondition(hash(transformed) === entry.generated_sha256 &&
      entry.project_reference_replacements === source.toString('utf8').split(STAGING_PROJECT_REF).length - 1, 'Generated transform checksum mismatch');
    const bytes = verifiedFile(directory, path, entry.generated_sha256);
    requireCondition(bytes.equals(transformed), 'Generated bytes differ from the explicit lab transform');
    return bytes;
  }
  requireCondition(Array.isArray(report.migrations) && report.migrations.length === original.migrations.length + pending.migrations.length, 'Incomplete candidate migration report');
  const versions = new Set();
  const migrations = [...original.migrations, ...pending.migrations].map((migration, index) => {
    const isPending = index >= original.migrations.length;
    const version = migration.file.slice(0, 14);
    requireCondition(!versions.has(version), 'Duplicate candidate migration version');
    versions.add(version);
    const sql = validateGenerated(report.migrations[index], 'supabase/migrations/' + migration.file,
      'supabase/' + (isPending ? 'migrations/' : 'deployed-migrations/') + migration.file,
      isPending ? 'pending_poker_forward_migration' : 'reviewed_staging_source').toString('utf8');
    return { file: migration.file, version, sha256: hash(sql), sql };
  });
  requireCondition(Array.isArray(report.functions) && sameNames(report.functions.map(fn => fn.name), TEST_LAB_FUNCTIONS), 'Candidate tester-function allowlist changed');
  const functions = TEST_LAB_FUNCTIONS.map(name => {
    const fn = report.functions.find(entry => entry.name === name);
    const originalFn = original.functions.find(entry => entry.name === name);
    const pendingFn = pending.functions.find(entry => entry.name === name);
    const files = pendingFn?.files || originalFn?.files;
    requireCondition(originalFn?.verify_jwt === true && fn.verify_jwt === true && Array.isArray(fn.files) &&
      files?.length === fn.files.length, 'Candidate function authentication/files changed');
    const sourceFiles = {};
    for (const file of files) {
      const path = 'supabase/functions/' + name + '/' + file;
      const entry = fn.files.find(entry => entry.path === path);
      sourceFiles[file] = validateGenerated(entry, path,
        'supabase/' + (pendingFn ? 'pending-functions/' : 'functions/') + name + '/' + file,
        pendingFn ? 'pending_poker_handler' : 'reviewed_staging_source');
    }
    return { name, verify_jwt: true, files: sourceFiles };
  });
  const excluded = original.functions.map(fn => fn.name).filter(name => !TEST_LAB_FUNCTIONS.includes(name));
  requireCondition(Array.isArray(report.excluded_functions) && sameNames(report.excluded_functions.map(fn => fn.name), excluded), 'Candidate financial/provider exclusions changed');
  const config = verifiedFile(directory, 'supabase/config.toml', report.config_sha256).toString('utf8');
  const expectedConfig = `project_id = "${LAB_PROJECT_REF}"\n\n[db]\nmajor_version = 17\n` +
    TEST_LAB_FUNCTIONS.map(name => `\n[functions.${name}]\nverify_jwt = true\n`).join('');
  requireCondition(config === expectedConfig, 'Candidate config differs from the lab-only authenticated function config');
  return { project_ref: LAB_PROJECT_REF, migrations, functions,
    summary: { project_ref: LAB_PROJECT_REF, migrations: migrations.length, functions: functions.length,
      excluded_functions: excluded, source_manifest_sha256: report.source_manifest_sha256,
      pending_poker_manifest_sha256: report.pending_poker_manifest_sha256, config_sha256: report.config_sha256 } };
}

export function planLabMigrations(migrations, history, { historyPresent = true, publicObjects = [] } = {}) {
  const blockers = [], applied = [], pending = [], known = new Map(), hosted = new Map();
  for (const migration of migrations) {
    requireCondition(/^\d{14}$/.test(migration.version) && !known.has(migration.version) && hash(migration.sql) === migration.sha256, 'Invalid candidate migration input');
    known.set(migration.version, migration);
  }
  requireCondition(Array.isArray(history) && Array.isArray(publicObjects), 'Incomplete migration/schema inventory');
  for (const row of history) {
    if (!/^\d{14}$/.test(row.version || '') || hosted.has(row.version)) {
      blockers.push({ code: 'invalid_or_duplicate_hosted_history' }); continue;
    }
    hosted.set(row.version, row);
    if (!known.has(row.version)) blockers.push({ code: 'unknown_hosted_migration', version: row.version });
  }
  if (!historyPresent && history.length) blockers.push({ code: 'history_presence_inconsistent' });
  if (!history.length && publicObjects.length) blockers.push({ code: historyPresent ? 'empty_history_with_existing_public_objects' : 'missing_history_with_existing_public_objects' });
  for (const migration of migrations) {
    const row = hosted.get(migration.version);
    if (!row) pending.push({ version: migration.version, file: migration.file, generated_sha256: migration.sha256 });
    else if (matchesRecordedSql(migration.sql, row.statements)) applied.push({ version: migration.version, file: migration.file, status: 'generated_sql_matches' });
    else blockers.push({ code: 'hosted_sql_differs_or_is_unverifiable', version: migration.version, file: migration.file, expected_generated_sha256: migration.sha256 });
  }
  // A gap followed by a later applied version needs explicit reconciliation.
  if (pending.some(migration => [...hosted.keys()].some(version => version > migration.version))) blockers.push({ code: 'hosted_history_has_candidate_gaps' });
  return { history_present: historyPresent, hosted_count: history.length, matching: applied, missing: pending,
    fresh_schema_candidate: !history.length && !publicObjects.length, reconciliation_required: !!blockers.length, blockers };
}

export function planLabFunctions(functions, remoteFunctions, observations = {}) {
  requireCondition(Array.isArray(remoteFunctions), 'Incomplete function inventory');
  const blockers = [], entries = [], candidates = new Map(functions.map(fn => [fn.name, fn]));
  const remote = new Map();
  for (const fn of remoteFunctions) {
    const name = fn.slug || fn.name;
    if (!identifier(name) || remote.has(name)) { blockers.push({ code: 'invalid_or_duplicate_remote_function' }); continue; }
    remote.set(name, fn);
    if (!candidates.has(name)) blockers.push({ code: 'unknown_or_excluded_hosted_function', name });
  }
  for (const [name, fn] of candidates) {
    const hosted = remote.get(name);
    if (!hosted) { entries.push({ name, status: 'missing_candidate_handler' }); continue; }
    if (hosted.status !== 'ACTIVE' || hosted.verify_jwt !== true || hosted.import_map === true) {
      blockers.push({ code: 'hosted_function_configuration_differs', name });
      entries.push({ name, status: 'configuration_mismatch' }); continue;
    }
    const observed = observations[name];
    if (!observed?.files || observed.error || observed.changedDuringRead) {
      blockers.push({ code: observed?.changedDuringRead ? 'hosted_function_changed_during_inspection' : 'hosted_function_source_unverified', name });
      entries.push({ name, status: 'source_unverified' }); continue;
    }
    const expectedFiles = Object.keys(fn.files), actualFiles = Object.keys(observed.files);
    const matches = sameNames(expectedFiles, actualFiles) && expectedFiles.every(file => hash(fn.files[file]) === hash(observed.files[file]));
    if (!matches) blockers.push({ code: 'hosted_function_source_differs', name });
    entries.push({ name, status: matches ? 'generated_source_and_jwt_match' : 'source_mismatch',
      expected_files: expectedFiles.map(file => ({ file, sha256: hash(fn.files[file]) })) });
  }
  return { hosted_count: remoteFunctions.length, entries, reconciliation_required: !!blockers.length, blockers };
}

export function summarizeLabAuth(auth) {
  function origin(value) {
    if (typeof value !== 'string') return null;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.origin : null; } catch { return null; }
  }
  const rawRedirects = Array.isArray(auth?.uri_allow_list) ? auth.uri_allow_list : typeof auth?.uri_allow_list === 'string' ? auth.uri_allow_list.split(',') : [];
  const origins = rawRedirects.map(value => origin(typeof value === 'string' ? value.trim() : null));
  const flags = {};
  for (const key of ['disable_signup', 'external_email_enabled', 'external_anonymous_users_enabled', 'mailer_autoconfirm', 'security_captcha_enabled']) {
    if (typeof auth?.[key] === 'boolean') flags[key] = auth[key];
  }
  return { site_origin: origin(auth?.site_url), redirect_origins: [...new Set(origins.filter(Boolean))].sort(),
    invalid_redirect_entries: origins.filter(value => !value).length, flags };
}

export const LAB_READ_ONLY_QUERIES = Object.freeze({
  historyPresence: "select to_regclass('supabase_migrations.schema_migrations') is not null as history_present",
  migrationHistory: 'select version,name,statements from supabase_migrations.schema_migrations order by version',
  publicObjects: "select n.nspname as schema_name,c.relname as object_name,c.relkind::text as object_kind from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f') order by c.relname",
  publicRoutines: "select n.nspname as schema_name,p.proname as object_name,p.prokind::text as object_kind from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname,p.oid",
});

/** The only transport: fixed lab project, GETs, and four immutable read-only SELECTs. */
export function createLabManagementReader({ token, fetchImpl = globalThis.fetch } = {}) {
  if (typeof token !== 'string' || !token.trim()) throw Error('Missing SUPABASE_ACCESS_TOKEN for read-only lab management inspection');
  async function request(path, queryName) {
    const options = { method: queryName ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: path.endsWith('/body') ? 'multipart/form-data' : 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(30000) };
    if (queryName) {
      if (!Object.hasOwn(LAB_READ_ONLY_QUERIES, queryName)) throw Error('Unknown read-only query');
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify({ query: LAB_READ_ONLY_QUERIES[queryName], read_only: true });
    }
    let response;
    try { response = await fetchImpl('https://api.supabase.com/v1/projects/' + LAB_PROJECT_REF + path, options); }
    catch { throw Error('Lab management read could not reach the API'); }
    if (!response.ok) throw Error('Lab management read HTTP ' + response.status);
    return response;
  }
  const functionPath = name => {
    if (!/^[a-z0-9-]{1,80}$/.test(name)) throw Error('Invalid function name');
    return '/functions/' + name;
  };
  return Object.freeze({
    project: async () => (await request('')).json(),
    auth: async () => (await request('/config/auth')).json(),
    functions: async () => (await request('/functions')).json(),
    query: async name => {
      if (!Object.hasOwn(LAB_READ_ONLY_QUERIES, name)) throw Error('Unknown read-only query');
      return (await request('/database/query', name)).json();
    },
    functionMetadata: async name => (await request(functionPath(name))).json(),
    functionSources: async (name, metadata) => readFunctionMultipart(await request(functionPath(name) + '/body'), metadata),
  });
}

export async function inspectTestLabManagement({ candidateDirectory = candidateDefault, sourceRoot = sourceRootDefault,
  token = process.env.SUPABASE_ACCESS_TOKEN, fetchImpl = globalThis.fetch } = {}) {
  const reader = createLabManagementReader({ token, fetchImpl });
  const candidate = validateLabCandidate(candidateDirectory, { sourceRoot });
  const readNames = ['project', 'auth', 'functions', 'publicObjects', 'publicRoutines', 'historyPresence'];
  const reads = await Promise.allSettled([reader.project(), reader.auth(), reader.functions(),
    reader.query('publicObjects'), reader.query('publicRoutines'), reader.query('historyPresence')]);
  const values = {}, failures = [];
  reads.forEach((read, index) => { if (read.status === 'fulfilled') values[readNames[index]] = read.value; else failures.push({ code: 'management_read_failed', component: readNames[index] }); });
  let history;
  const present = values.historyPresence?.[0]?.history_present;
  if (present === false) history = [];
  else if (present === true) {
    try { history = await reader.query('migrationHistory'); } catch { failures.push({ code: 'management_read_failed', component: 'migrationHistory' }); }
  } else failures.push({ code: 'history_presence_unverified' });
  const objects = [...(Array.isArray(values.publicObjects) ? values.publicObjects : []), ...(Array.isArray(values.publicRoutines) ? values.publicRoutines : [])];
  const observations = {};
  if (Array.isArray(values.functions)) {
    const names = new Set(candidate.functions.map(fn => fn.name));
    const current = values.functions.filter(fn => names.has(fn.slug || fn.name));
    for (let index = 0; index < current.length; index += 4) {
      await Promise.all(current.slice(index, index + 4).map(async metadata => {
        const name = metadata.slug || metadata.name;
        try {
          const before = await reader.functionMetadata(name);
          const files = await reader.functionSources(name, before);
          const after = await reader.functionMetadata(name);
          const changedDuringRead = (before.slug || before.name) !== name ||
            ['version', 'verify_jwt', 'import_map', 'status'].some(field => before[field] !== metadata[field]) ||
            ['version', 'ezbr_sha256', 'verify_jwt', 'entrypoint_path', 'deno2_entrypoint_path', 'import_map', 'status']
              .some(field => after[field] !== before[field]);
          observations[name] = { files, changedDuringRead };
        } catch { observations[name] = { error: true }; }
      }));
    }
  }
  if (!Array.isArray(values.publicObjects) || !Array.isArray(values.publicRoutines)) failures.push({ code: 'public_schema_inventory_unverified' });
  if (!values.auth || typeof values.auth !== 'object' || Array.isArray(values.auth) || typeof values.auth.site_url !== 'string') failures.push({ code: 'auth_configuration_unverified' });
  const migrations = Array.isArray(history) && typeof present === 'boolean' && Array.isArray(values.publicObjects) && Array.isArray(values.publicRoutines)
    ? planLabMigrations(candidate.migrations, history, { historyPresent: present, publicObjects: objects }) : null;
  const functions = Array.isArray(values.functions) ? planLabFunctions(candidate.functions, values.functions, observations) : null;
  const blockers = [...failures, ...(migrations?.blockers || []), ...(functions?.blockers || [])];
  if (!migrations) blockers.push({ code: 'migration_reconciliation_unverified' });
  if (!functions) blockers.push({ code: 'function_reconciliation_unverified' });
  const metadata = values.project || {};
  if (metadata.id !== LAB_PROJECT_REF) blockers.push({ code: 'management_project_identity_unverified' });
  return {
    schema_version: 1, project_ref: LAB_PROJECT_REF, supabase_url: LAB_SUPABASE_URL,
    status: blockers.length ? 'reconciliation_required' : 'read_only_comparison_complete',
    remote_mutations_performed: false, application_authorized_by_this_plan: false,
    candidate: candidate.summary,
    project: { id_matches_confirmed_lab: metadata.id === LAB_PROJECT_REF,
      status: identifier(metadata.status) ? metadata.status : null, region: identifier(metadata.region) ? metadata.region : null },
    auth: values.auth ? summarizeLabAuth(values.auth) : null,
    public_schema: { object_count: objects.length,
      objects: objects.filter(row => row.schema_name === 'public' && identifier(row.object_name))
        .map(row => ({ name: row.object_name, kind: ['r', 'p', 'v', 'm', 'S', 'f', 'a', 'w'].includes(row.object_kind) ? row.object_kind : 'other' })) },
    migrations, functions, blockers,
    limitations: ['Schema inventory lists public object names and kinds; it does not establish column, policy or routine-definition parity.',
      'This plan never repairs migration history, deploys code, changes Auth settings or authorizes application.'],
    next_steps: blockers.length ? ['Reconcile every reported mismatch or unknown object/history before proposing any change.'] :
      ['Review missing migrations/functions against this exact candidate; this inspector cannot apply them.', 'Verify intended Auth domains and authenticated gameplay separately.'],
  };
}

export function parseLabInspectionOptions(args) {
  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--candidate=') && !Object.hasOwn(options, 'candidateDirectory')) options.candidateDirectory = arg.slice('--candidate='.length);
    else if (arg.startsWith('--output=') && !Object.hasOwn(options, 'output')) options.output = arg.slice('--output='.length);
    else throw Error('Usage: node scripts/inspect-test-lab-management.mjs [--candidate=<existing-candidate>] [--output=<new-plan.json>]. This inspector has no apply or project-switch option.');
  }
  if (Object.values(options).some(value => !value)) throw Error('Candidate and output options require nonempty paths');
  return options;
}

function resolvedNewOutput(path) {
  let parent = resolve(path);
  const suffix = [];
  while (!existsSync(parent)) { suffix.unshift(basename(parent)); parent = dirname(parent); }
  return resolve(realpathSync(parent), ...suffix);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseLabInspectionOptions(process.argv.slice(2));
    const plan = await inspectTestLabManagement(options);
    const json = JSON.stringify(plan, null, 2) + '\n';
    if (options.output) {
      const output = resolvedNewOutput(options.output);
      if (within(sourceRootDefault, output) || within(realpathSync(options.candidateDirectory || candidateDefault), output) || existsSync(output)) throw Error('Plan output must be a new file outside source and candidate directories');
      writeFileSync(output, json, { flag: 'wx' });
      console.log(JSON.stringify({ project: LAB_PROJECT_REF, status: plan.status, plan: output, blockers: plan.blockers.length, remote_mutations_performed: false }));
    } else process.stdout.write(json);
    if (plan.blockers.length) process.exitCode = 2;
  } catch (error) {
    // Never expose raw Management API bodies, configuration objects or tokens.
    console.error(error.message);
    process.exitCode = 1;
  }
}
