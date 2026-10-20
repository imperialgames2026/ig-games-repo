import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

// Deliberately accepts no connection URL: this harness cannot target a hosted DB.
const mode = process.argv[2] || 'app-records';
if (!['app-records', 'replay', 'replay-cron'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/test-local-database.mjs [app-records|replay|replay-cron]');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = `ig-local-test-${randomUUID()}`;
const docker = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', ...options });
const sql = input => docker(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'], { input });
const read = path => readFileSync(resolve(root, path), 'utf8');
let started = false;
try {
  docker(['run', '-d', '--name', name, '--network', 'none',
    '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    ...(mode === 'replay-cron'
      ? ['ig-local-postgres-cron', '-c', 'shared_preload_libraries=pg_cron', '-c', 'cron.database_name=postgres', '-c', 'cron.launch_active_jobs=off']
      : ['postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'])]);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'pipe' }); ready = true; break; }
    catch { await setTimeout(500); }
  }
  if (!ready) throw new Error('Local Postgres did not become ready');
  sql(read('tests/database/bootstrap.sql'));
  if (mode === 'app-records') {
    sql(read('tests/database/app-records.sql') + read('supabase/proposals/app-records-owner-read.sql') + read('tests/database/app-records-assertions.sql'));
    console.log('PASS: ownerless exposure reproduced; proposal denies anonymous/other-owner reads and preserves owner/admin reads. Transaction rolled back.');
  } else {
    const manifest = JSON.parse(read('supabase/backend-manifest.json'));
    for (const migration of [...manifest.migrations].sort((a, b) => a.file.localeCompare(b.file))) {
      console.log(`REPLAY ${migration.file}`);
      if (!/^\d{14}_[a-zA-Z0-9_-]+\.sql$/.test(migration.file)) throw new Error('Invalid migration filename');
      const content = read(`supabase/deployed-migrations/${migration.file}`);
      if (createHash('sha256').update(content).digest('hex') !== migration.sha256) throw new Error('Migration checksum mismatch');
      sql('begin;\n' + content + '\ncommit;');
    }
    console.log(`PASS: ${manifest.migrations.length} migrations structurally replayed with minimal Auth/Storage fixtures. Full Supabase service validation still required.`);
    sql(read('tests/database/replayed-records-before.sql') + read('supabase/proposals/app-records-owner-read.sql') + read('tests/database/replayed-records-after.sql'));
    console.log('PASS: replayed signup rejects metadata escalation; actual canonical-role policies preserve owner/admin isolation after proposed correction. Rolled back.');
  }
} finally {
  if (started) docker(['rm', '-fv', name]);
}
