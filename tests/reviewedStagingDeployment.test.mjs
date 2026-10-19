import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { planMigrations, migrationTransaction } from '../scripts/deploy-reviewed-staging.mjs';

const sql = '-- Reviewed SQL\ncreate table public.example(id uuid);\n';
const migration = { file: '20261019203000_example.sql', sha256: createHash('sha256').update(sql).digest('hex') };
const manifest = { project_ref: 'qonqemhljgxlwpghkxhn', migrations: [migration] };
const history = [{ version: '20261019203000', name: 'example', statements: [sql] }];

test('deployment rejects a different project, unknown history, absent recorded history and changed SQL', () => {
  for (const [m, h, source] of [
    [{ ...manifest, project_ref: 'other' }, history, sql],
    [manifest, [...history, { version: '20261019210000', statements: ['select 1'] }], sql],
    [manifest, [], sql],
    [manifest, [{ ...history[0], statements: [sql.replace('id uuid', 'id text')] }], sql],
    [manifest, history, sql + '-- Unreviewed change'],
  ]) assert.throws(() => planMigrations(m, h, () => source));
});

test('only an explicitly pending migration can be planned and an exact replay is skipped', () => {
  assert.deepEqual(planMigrations(manifest, history, () => sql), []);
  const pending = planMigrations({ ...manifest, migrations: [{ ...migration, status: 'pending_deployment' }] }, [], () => sql);
  assert.equal(pending.length, 1);
  const query = migrationTransaction(pending[0], ['20261019000000']);
  assert.match(query, /^begin;/);
  assert.match(query, /pg_advisory_xact_lock/);
  assert.ok(query.indexOf('Staging migration history changed') < query.indexOf(sql));
  assert.ok(query.indexOf(sql) < query.indexOf('insert into supabase_migrations.schema_migrations'));
  assert.match(query, /commit;$/);
  assert.throws(() => migrationTransaction({ ...pending[0], version: "2026');commit;--" }, []));
});
