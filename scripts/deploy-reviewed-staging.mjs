import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = 'qonqemhljgxlwpghkxhn';
const sha256 = value => createHash('sha256').update(value).digest('hex');

// Restored migrations preserve the SQL stored by Supabase. Its history can store
// one query or multiple statements; compare exact reconstructions, never strip
// comments, alter SQL, or replace the reviewed checksum.
export function matchesRecordedSql(sql, statements) {
  if (!Array.isArray(statements) || !statements.length) return false;
  const expected = sha256(sql);
  for (const parts of [statements, statements.map(s => s.trim()), statements.map(s => s.trim().replace(/;$/, ''))]) {
    for (const separator of ['', '\n', '\n\n', ';\n', ';\n\n']) {
      for (const suffix of ['', '\n', '\n\n', ';', ';\n', ';\n\n']) {
        if (sha256(parts.join(separator) + suffix) === expected) return true;
      }
    }
  }
  return false;
}

export function planMigrations(manifest, history, loadSql) {
  if (manifest.project_ref !== project) throw Error('Unexpected staging project');
  const known = new Map(manifest.migrations.map(m => [m.file.slice(0, 14), m]));
  if (known.size !== manifest.migrations.length) throw Error('Duplicate migration versions');
  const applied = new Map(history.map(m => [m.version, m]));
  for (const version of applied.keys()) {
    if (!known.has(version)) throw Error('Hosted history contains an unreviewed migration: ' + version);
  }
  const pending = [];
  for (const [version, migration] of known) {
    const sql = loadSql(migration.file);
    if (sha256(sql) !== migration.sha256) throw Error('Reviewed checksum mismatch: ' + migration.file);
    if (applied.has(version)) {
      if (!matchesRecordedSql(sql, applied.get(version).statements)) {
        throw Error('Hosted SQL differs from reviewed migration: ' + migration.file);
      }
    } else if (migration.status === 'pending_deployment') {
      pending.push({ ...migration, version, sql, name: migration.file.slice(15, -4) });
    } else {
      throw Error('Recorded migration is absent from staging: ' + migration.file);
    }
  }
  return pending;
}

export function migrationTransaction(migration, expectedVersions) {
  const { version, name, sql, sha256: checksum } = migration;
  if (!/^\d{14}$/.test(version) || !/^[a-z0-9_]+$/.test(name) ||
      sha256(sql) !== checksum || expectedVersions.some(v => !/^\d{14}$/.test(v))) throw Error('Invalid migration');
  if (/(^|\n)\s*(begin|commit|rollback)\s*;/i.test(sql)) throw Error('Migration controls its own transaction');
  const tag = '$reviewed_' + checksum.slice(0, 12) + '$';
  if (sql.includes(tag)) throw Error('SQL delimiter collision');
  const versions = expectedVersions.map(v => "'" + v + "'").join(',');
  return `begin;
select pg_advisory_xact_lock(hashtext('imperial-reviewed-staging')::bigint);
do $history_guard$ begin
  if (select count(*) from supabase_migrations.schema_migrations) <> ${expectedVersions.length}
     or exists(select 1 from supabase_migrations.schema_migrations where version not in (${versions || "''"})) then
    raise exception 'Staging migration history changed during deployment';
  end if;
end $history_guard$;
${sql}
insert into supabase_migrations.schema_migrations(version,name,statements)
values ('${version}','${name}',array[${tag}${sql}${tag}]);
commit;`;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw Error('Missing Actions secret SUPABASE_ACCESS_TOKEN');
  const manifest = JSON.parse(readFileSync(resolve(root, 'supabase/backend-manifest.json'), 'utf8'));
  async function api(path, body, method = body ? 'POST' : 'GET') {
    const response = await fetch('https://api.supabase.com/v1/projects/' + project + path, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw Error(`Supabase management ${method} ${path}: HTTP ${response.status}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  const history = await api('/database/query', {
    query: 'select version,name,statements from supabase_migrations.schema_migrations order by version', read_only: true,
  });
  const pending = planMigrations(manifest, history, file => readFileSync(resolve(root, 'supabase/deployed-migrations', file), 'utf8'));
  const remoteFunctions = await api('/functions');
  const functions = manifest.functions.filter(f => f.status === 'pending_deployment');
  for (const fn of functions) {
    const remote = remoteFunctions.find(f => f.slug === fn.name || f.name === fn.name);
    if ((remote?.version ?? null) !== fn.deployed_version) throw Error('Hosted function version changed: ' + fn.name);
  }
  console.log(JSON.stringify({ project, reviewedAppliedMigrations: history.length, pendingMigrations: pending.map(m => m.file), pendingFunctions: functions.map(f => f.name) }));
  if (!process.argv.includes('--apply')) return;
  const versions = history.map(m => m.version);
  for (const migration of pending) {
    await api('/database/query', { query: migrationTransaction(migration, versions), read_only: false });
    versions.push(migration.version);
    console.log('Applied reviewed migration: ' + migration.file);
  }
  // Preserve existing Auth settings and redirect entries; add only this verified
  // public deployment's confirmation and recovery destinations.
  const auth = await api('/config/auth');
  const destinations = new Set((auth.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean));
  for (const path of ['', '/', '/ResetPassword']) destinations.add('https://ig-games-repo.vercel.app' + path);
  const allowlist = [...destinations].join(',');
  if (allowlist !== (auth.uri_allow_list || '')) {
    await api('/config/auth', { uri_allow_list: allowlist }, 'PATCH');
    console.log('Added verified frontend confirmation and recovery redirects; preserved existing Auth configuration');
  }
  const workdir = process.argv.find(arg => arg.startsWith('--functions-file='))?.slice('--functions-file='.length);
  if (workdir) writeFileSync(workdir, functions.map(f => f.name).join('\n') + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
