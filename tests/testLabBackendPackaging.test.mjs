import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LAB_PROJECT_REF, LAB_SUPABASE_URL } from '../config/test-lab.js';
import { prepareTestLabBackend, STAGING_PROJECT_REF, TEST_LAB_FUNCTIONS } from '../scripts/prepare-test-lab-backend.mjs';

const checksum = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'ig-lab-package-'));
  const sourceRoot = join(workspace, 'source');
  mkdirSync(sourceRoot);
  cpSync(new URL('../supabase/', import.meta.url), join(sourceRoot, 'supabase'), { recursive: true });
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  return { workspace, sourceRoot, output: join(workspace, 'candidate') };
}
const load = file => JSON.parse(readFileSync(file, 'utf8'));
function changeManifest(sourceRoot, change, name = 'backend-manifest.json') {
  const file = join(sourceRoot, 'supabase', name);
  const json = load(file);
  change(json);
  writeFileSync(file, JSON.stringify(json));
}

test('lab candidate is deterministic, verifies the staging baseline and transforms only generated references', t => {
  const options = fixture(t);
  const originalManifest = readFileSync(join(options.sourceRoot, 'supabase/backend-manifest.json'));
  const result = prepareTestLabBackend(options);
  assert.equal(result.project, LAB_PROJECT_REF);
  assert.equal(result.status, 'offline_candidate_not_deployed');
  assert.equal(result.functions, TEST_LAB_FUNCTIONS.length);
  const baseline = JSON.parse(originalManifest);
  assert.equal(result.migrations, baseline.migrations.length + 1);
  const report = load(join(options.output, 'test-lab-backend-report.json'));
  assert.equal(report.supabase_url, LAB_SUPABASE_URL);
  assert.equal(report.source_project_ref, STAGING_PROJECT_REF);
  assert.equal(report.source_manifest_sha256, checksum(originalManifest));
  assert.match(readFileSync(join(options.output, 'supabase/config.toml'), 'utf8'), new RegExp('project_id = "' + LAB_PROJECT_REF + '"'));
  assert.ok(report.functions.every(fn => fn.verify_jwt));
  assert.deepEqual(report.functions.filter(fn => fn.files.some(file => file.source_status === 'pending_poker_handler')).map(fn => fn.name).sort(), ['ig-poker-bot-lab', 'poker-events-v1', 'poker-table-v1']);
  assert.equal(report.migrations.at(-1).source_status, 'pending_poker_forward_migration');
  for (const entry of [...report.migrations, ...report.functions.flatMap(fn => fn.files)]) {
    const generated = readFileSync(join(options.output, entry.path));
    const source = readFileSync(join(options.sourceRoot, entry.source_path));
    assert.equal(checksum(source), entry.source_sha256, entry.source_path);
    assert.equal(checksum(generated), entry.generated_sha256, entry.path);
    assert.equal(generated.toString(), source.toString().replaceAll(STAGING_PROJECT_REF, LAB_PROJECT_REF), entry.path);
    assert.ok(!generated.includes(STAGING_PROJECT_REF), entry.path);
  }
  const avatar = report.migrations.find(file => file.path.endsWith('_profile_settings_and_avatar_storage.sql'));
  assert.equal(avatar.project_reference_replacements, 1, 'Avatar URL ownership validation must follow the lab project');
  const bot = report.functions.find(fn => fn.name === 'ig-poker-bot-lab').files[0];
  assert.ok(bot.project_reference_replacements > 0, 'Bot project guard must follow the lab target');
  assert.deepEqual(readFileSync(join(options.sourceRoot, 'supabase/backend-manifest.json')), originalManifest);
  const secondOutput = join(options.workspace, 'second-candidate');
  prepareTestLabBackend({ ...options, output: secondOutput });
  assert.deepEqual(readFileSync(join(options.output, 'test-lab-backend-report.json')), readFileSync(join(secondOutput, 'test-lab-backend-report.json')));
});

test('lab candidate excludes financial/provider handlers and rejects an unclassified new handler', t => {
  const options = fixture(t);
  prepareTestLabBackend(options);
  const names = readdirSync(join(options.output, 'supabase/functions'));
  const report = load(join(options.output, 'test-lab-backend-report.json'));
  for (const name of ['secure-wallet', 'admin-mutations', 'ig-payment-requests', 'ign-staking-v1', 'crypto-deposit-preview-v1', 'ig-fireblocks-sandbox-admin', 'ig-fireblocks-sandbox-webhook']) {
    assert.ok(!names.includes(name), name);
    assert.ok(report.excluded_functions.some(fn => fn.name === name), name);
  }
  assert.ok(!names.some(name => /wallet|staking|payment|deposit|withdraw|fireblocks|custody/i.test(name)));
  const name = 'ig-new-custody-provider';
  const source = Buffer.from('Deno.serve(() => Response.json({disabled:true}));\n');
  mkdirSync(join(options.sourceRoot, 'supabase/functions', name));
  writeFileSync(join(options.sourceRoot, 'supabase/functions', name, 'index.ts'), source);
  changeManifest(options.sourceRoot, manifest => manifest.functions.push({ name, verify_jwt: true, files: ['index.ts'], sha256: { 'index.ts': checksum(source) } }));
  assert.throws(() => prepareTestLabBackend({ ...options, output: join(options.workspace, 'unknown') }), /Unclassified source function/);
});

test('lab target and pending manifest cannot redirect the package to staging or another project', t => {
  const options = fixture(t);
  for (const projectRef of [STAGING_PROJECT_REF, 'icwzqdbibhnrtjahfzsx', 'other']) {
    assert.throws(() => prepareTestLabBackend({ ...options, projectRef }), /Refusing target/);
    assert.ok(!existsSync(options.output));
  }
  changeManifest(options.sourceRoot, manifest => { manifest.target_project_ref = STAGING_PROJECT_REF; }, 'test-lab-poker-candidates.json');
  assert.throws(() => prepareTestLabBackend(options), /different target/);
  assert.ok(!existsSync(options.output));
});

test('changed SQL, excluded handler bytes and pending candidate bytes each fail checksum verification before writing', t => {
  for (const kind of ['migration', 'excluded', 'pending']) {
    const options = fixture(t);
    const manifest = load(join(options.sourceRoot, 'supabase/backend-manifest.json'));
    const path = kind === 'migration' ? join(options.sourceRoot, 'supabase/deployed-migrations', manifest.migrations[0].file) :
      kind === 'excluded' ? join(options.sourceRoot, 'supabase/functions/secure-wallet/index.ts') :
        join(options.sourceRoot, 'supabase/pending-functions/poker-table-v1/index.ts');
    appendFileSync(path, '\n-- unreviewed source change\n');
    assert.throws(() => prepareTestLabBackend(options), /Source checksum mismatch/);
    assert.ok(!existsSync(options.output), kind);
  }
});

test('manifest traversal, escaping symlinks and unexpected pending handler names fail closed', t => {
  const traversal = fixture(t);
  changeManifest(traversal.sourceRoot, manifest => {
    manifest.functions[0].files = ['../escape.ts'];
    manifest.functions[0].sha256['../escape.ts'] = manifest.functions[0].sha256['index.ts'];
  });
  assert.throws(() => prepareTestLabBackend(traversal), /Invalid source path/);
  assert.ok(!existsSync(traversal.output));
  const link = fixture(t);
  const manifest = load(join(link.sourceRoot, 'supabase/backend-manifest.json'));
  const migration = join(link.sourceRoot, 'supabase/deployed-migrations', manifest.migrations[0].file);
  const outside = join(link.workspace, 'outside.sql');
  writeFileSync(outside, readFileSync(migration));
  rmSync(migration);
  symlinkSync(outside, migration);
  assert.throws(() => prepareTestLabBackend(link), /Source path escapes/);
  assert.ok(!existsSync(link.output));
  const pending = fixture(t);
  changeManifest(pending.sourceRoot, manifest => { manifest.functions[0].name = 'secure-wallet'; }, 'test-lab-poker-candidates.json');
  assert.throws(() => prepareTestLabBackend(pending), /Unexpected pending poker handler/);
  assert.ok(!existsSync(pending.output));
});

test('packager preserves nonempty directories and cannot write into source through a symlink', t => {
  const options = fixture(t);
  mkdirSync(options.output);
  const sentinel = join(options.output, 'user-file.txt');
  writeFileSync(sentinel, 'keep this file');
  assert.throws(() => prepareTestLabBackend(options), /Output directory must be empty/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep this file');
  for (const output of [options.sourceRoot, join(options.sourceRoot, 'candidate'), options.workspace]) {
    assert.throws(() => prepareTestLabBackend({ ...options, output }), /outside the source checkout/);
  }
  const symlink = join(options.workspace, 'source-link');
  symlinkSync(options.sourceRoot, symlink);
  assert.throws(() => prepareTestLabBackend({ ...options, output: join(symlink, 'generated') }), /outside the source checkout/);
  assert.ok(!existsSync(join(options.sourceRoot, 'generated')));
});
