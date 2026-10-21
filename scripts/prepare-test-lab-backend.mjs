import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAB_PROJECT_REF, LAB_SUPABASE_URL } from '../config/test-lab.js';

export const STAGING_PROJECT_REF = 'qonqemhljgxlwpghkxhn';
export const TEST_LAB_FUNCTIONS = Object.freeze([
  'provably-fair-demo', 'provably-fair-v2',
  'poker-table-v1', 'admin-poker-events', 'poker-events-v1',
  'legacy-leaderboard-v1', 'ig-support-v1', 'ig-self-exclusion-v1',
  'ig-multiplayer-practice', 'ig-shared-event-practice', 'ig-blackjack-practice',
  'ig-poker-tournament-admin', 'ig-poker-tournament-prizes',
  'ig-admin-command-center', 'ig-player-analytics-v1', 'ig-admin-users-preview-v1',
  'ig-poker-bot-lab', 'ig-crash-v2', 'ig-originals-practice',
  'ig-mines-practice', 'ig-final-practice',
]);
const EXCLUDED = Object.freeze({
  'admin-mutations': 'Financial/admin mutation gateway is outside tester-chip scope.',
  'secure-wallet': 'Wallet transfers and balance mutations are excluded.',
  'admin-crash-rounds': 'Legacy private Crash queue is not used by the current shared practice service.',
  'crypto-deposit-preview-v1': 'Deposit surfaces are excluded, including read-only provider previews.',
  'ig-fireblocks-sandbox-admin': 'Custody/provider administration is excluded.',
  'ig-fireblocks-sandbox-webhook': 'Custody/provider webhooks are excluded.',
  'ign-staking-v1': 'Token staking and reward mutations are excluded.',
  'ig-support-supervisor': 'Optional external AI/email integrations are excluded.',
  'ig-payment-requests': 'Deposit/withdrawal/payment preparation is excluded.',
});
const PENDING_FUNCTIONS = Object.freeze(['poker-table-v1', 'ig-poker-bot-lab', 'poker-events-v1']);
const PENDING_MIGRATION = '20261021013000_poker_tester_table_lifecycle.sql';
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (base, file) => {
  const rel = relative(base, file);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
function safeSource(root, directory, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') ||
      path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid source path: ' + String(path));
  }
  const base = resolve(root, directory);
  const file = resolve(base, path);
  if (!inside(base, file) || !inside(root, realpathSync(base)) ||
      !inside(realpathSync(base), realpathSync(file))) throw new Error('Source path escapes reviewed directory: ' + path);
  if (!lstatSync(file).isFile()) throw new Error('Source must be a regular file: ' + path);
  return file;
}
function verifiedSource(root, directory, path, expected) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Missing source checksum: ' + path);
  const file = safeSource(root, directory, path);
  const bytes = readFileSync(file);
  if (hash(bytes) !== expected) throw new Error('Source checksum mismatch: ' + relative(root, file));
  return { bytes, path: relative(root, file), relativeName: path, sha256: expected };
}
function resolvedOutput(path) {
  let parent = resolve(path);
  const suffix = [];
  while (!existsSync(parent)) {
    suffix.unshift(basename(parent));
    parent = dirname(parent);
  }
  return resolve(realpathSync(parent), ...suffix);
}
function generatedArtifact(source, outputPath, sourceStatus) {
  const text = source.bytes.toString('utf8');
  const replacements = text.split(STAGING_PROJECT_REF).length - 1;
  const generated = Buffer.from(text.replaceAll(STAGING_PROJECT_REF, LAB_PROJECT_REF));
  return {
    path: outputPath,
    bytes: generated,
    report: {
      path: outputPath, source_path: source.path, source_status: sourceStatus,
      source_sha256: source.sha256, generated_sha256: hash(generated),
      project_reference_replacements: replacements,
    },
  };
}

/** Prepare files only. This function never contacts or mutates a remote service. */
export function prepareTestLabBackend({ output, projectRef = LAB_PROJECT_REF, sourceRoot = defaultRoot } = {}) {
  if (projectRef !== LAB_PROJECT_REF) throw new Error('Refusing target: this candidate is only for ' + LAB_PROJECT_REF);
  if (!output) throw new Error('An empty output directory is required');
  const root = realpathSync(sourceRoot);
  const out = resolvedOutput(output);
  if (inside(root, out) || inside(out, root)) throw new Error('Output must be outside the source checkout');
  if (existsSync(out) && (!lstatSync(out).isDirectory() || readdirSync(out).length)) throw new Error('Output directory must be empty');

  const manifestFile = safeSource(root, 'supabase', 'backend-manifest.json');
  const manifestBytes = readFileSync(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.project_ref !== STAGING_PROJECT_REF) throw new Error('Unexpected reviewed staging source project');
  if (!Array.isArray(manifest.migrations) || !manifest.migrations.length || !Array.isArray(manifest.functions)) throw new Error('Incomplete reviewed source manifest');
  const artifacts = [];
  const versions = new Set();
  for (const migration of manifest.migrations) {
    if (!/^\d{14}_[A-Za-z0-9_]+\.sql$/.test(migration.file || '')) throw new Error('Invalid migration path/version');
    const version = migration.file.split('_')[0];
    if (versions.has(version)) throw new Error('Duplicate migration version: ' + version);
    versions.add(version);
    const source = verifiedSource(root, 'supabase/deployed-migrations', migration.file, migration.sha256);
    artifacts.push(generatedArtifact(source, 'supabase/migrations/' + migration.file, 'reviewed_staging_source'));
  }
  const reviewedFunctions = new Map();
  for (const fn of manifest.functions) {
    if (!/^[a-z0-9-]+$/.test(fn.name || '') || reviewedFunctions.has(fn.name) ||
        typeof fn.verify_jwt !== 'boolean' || !Array.isArray(fn.files) || !fn.files.length ||
        new Set(fn.files).size !== fn.files.length) throw new Error('Invalid function manifest');
    if (!fn.verify_jwt && fn.name !== 'ig-fireblocks-sandbox-webhook') throw new Error('Unexpected unauthenticated source function');
    // Validate every reviewed function, even excluded financial handlers. A
    // modified source tree cannot be concealed by the tester-function filter.
    const files = fn.files.map(file => verifiedSource(root, 'supabase/functions/' + fn.name, file, fn.sha256?.[file]));
    for (const file of files) if (/@base44\/sdk|base44Compat/.test(file.bytes.toString('utf8'))) throw new Error('Legacy SDK in reviewed function: ' + fn.name);
    reviewedFunctions.set(fn.name, { ...fn, sources: files });
  }
  for (const name of TEST_LAB_FUNCTIONS) {
    if (!reviewedFunctions.has(name) || !reviewedFunctions.get(name).verify_jwt) throw new Error('Missing authenticated tester function: ' + name);
    if (/(?:wallet|staking|payment|deposit|withdraw|fireblocks|custody)/i.test(name) || EXCLUDED[name]) throw new Error('Financial function in tester allowlist: ' + name);
  }
  for (const name of reviewedFunctions.keys()) {
    if (!TEST_LAB_FUNCTIONS.includes(name) && !EXCLUDED[name]) throw new Error('Unclassified source function: ' + name);
  }

  const candidateFile = safeSource(root, 'supabase', 'test-lab-poker-candidates.json');
  const candidateBytes = readFileSync(candidateFile);
  const candidate = JSON.parse(candidateBytes.toString('utf8'));
  if (candidate.schema_version !== 1 || candidate.target_project_ref !== LAB_PROJECT_REF) throw new Error('Pending poker candidate has a different target or schema');
  if (!Array.isArray(candidate.migrations) || candidate.migrations.length !== 1 ||
      candidate.migrations[0].file !== PENDING_MIGRATION) throw new Error('Unexpected pending poker migration');
  const pending = candidate.migrations[0];
  const pendingVersion = pending.file.split('_')[0];
  if (versions.has(pendingVersion) || [...versions].some(version => version >= pendingVersion)) throw new Error('Pending poker migration must follow reviewed history');
  versions.add(pendingVersion);
  artifacts.push(generatedArtifact(verifiedSource(root, 'supabase/migrations', pending.file, pending.sha256),
    'supabase/migrations/' + pending.file, 'pending_poker_forward_migration'));
  if (!Array.isArray(candidate.functions) || candidate.functions.length !== PENDING_FUNCTIONS.length ||
      new Set(candidate.functions.map(fn => fn.name)).size !== PENDING_FUNCTIONS.length ||
      candidate.functions.some(fn => !PENDING_FUNCTIONS.includes(fn.name))) throw new Error('Unexpected pending poker handler');
  const overrides = new Map();
  for (const fn of candidate.functions) {
    if (!Array.isArray(fn.files) || fn.files.length !== 1 || fn.files[0] !== 'index.ts') throw new Error('Unexpected pending poker handler paths');
    const source = verifiedSource(root, 'supabase/pending-functions/' + fn.name, 'index.ts', fn.sha256?.['index.ts']);
    if (/@base44\/sdk|base44Compat/.test(source.bytes.toString('utf8'))) throw new Error('Legacy SDK in pending poker handler');
    overrides.set(fn.name, source);
  }
  const functions = [];
  for (const name of TEST_LAB_FUNCTIONS) {
    const reviewed = reviewedFunctions.get(name);
    const sources = overrides.has(name) ? [overrides.get(name)] : reviewed.sources;
    const files = sources.map(source => generatedArtifact(source,
      'supabase/functions/' + name + '/' + source.relativeName,
      overrides.has(name) ? 'pending_poker_handler' : 'reviewed_staging_source'));
    artifacts.push(...files);
    functions.push({ name, verify_jwt: true, files: files.map(file => file.report) });
  }
  if (new Set(artifacts.map(file => file.path)).size !== artifacts.length) throw new Error('Generated artifact path collision');
  const config = `project_id = "${LAB_PROJECT_REF}"\n\n[db]\nmajor_version = 17\n` +
    functions.map(fn => `\n[functions.${fn.name}]\nverify_jwt = true\n`).join('');
  const report = {
    schema_version: 1,
    status: 'offline_candidate_not_deployed',
    project_ref: LAB_PROJECT_REF, supabase_url: LAB_SUPABASE_URL,
    source_project_ref: STAGING_PROJECT_REF,
    source_manifest_sha256: hash(manifestBytes),
    pending_poker_manifest_sha256: hash(candidateBytes),
    project_reference_transform: { from: STAGING_PROJECT_REF, to: LAB_PROJECT_REF, operation: 'exact_string_substitution_in_generated_files_only' },
    migrations: artifacts.filter(file => file.path.startsWith('supabase/migrations/')).map(file => file.report),
    functions,
    excluded_functions: [...reviewedFunctions.keys()].filter(name => !TEST_LAB_FUNCTIONS.includes(name)).map(name => ({ name, reason: EXCLUDED[name] })),
    config_sha256: hash(config),
    limitations: [
      'This package has not inspected or changed the lab project.',
      'The complete schema is for a fresh-project replay; existing hosted history must be reconciled before any application.',
      'Historical financial schema is retained for schema dependencies, but payment/wallet/custody/staking handlers and provider credentials are excluded.',
      'Pending poker sources require database, authenticated multi-account and bot runtime verification before a release.',
    ],
  };
  // All paths, checksums and target constraints are validated before the first write.
  mkdirSync(out, { recursive: true });
  for (const artifact of artifacts) {
    const file = join(out, artifact.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, artifact.bytes, { flag: 'wx' });
  }
  writeFileSync(join(out, 'supabase/config.toml'), config, { flag: 'wx' });
  writeFileSync(join(out, 'test-lab-backend-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return { output: out, project: LAB_PROJECT_REF, status: report.status, migrations: versions.size, functions: functions.length, excludedFunctions: report.excluded_functions.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [output, ...options] = process.argv.slice(2);
    if (options.length > 1 || options.some(option => !option.startsWith('--project-ref='))) throw new Error('Usage: node scripts/prepare-test-lab-backend.mjs <empty-output-directory> [--project-ref=' + LAB_PROJECT_REF + ']');
    const projectRef = options.length ? options[0].slice('--project-ref='.length) : LAB_PROJECT_REF;
    console.log(JSON.stringify(prepareTestLabBackend({ output, projectRef })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
