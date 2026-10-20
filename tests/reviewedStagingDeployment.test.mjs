import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { planMigrations, migrationTransaction, websiteAuthPatch, planFunctions } from '../scripts/deploy-reviewed-staging.mjs';

const sql = '-- Reviewed SQL\ncreate table public.example(id uuid);\n';
const migration = { file: '20261019203000_example.sql', sha256: createHash('sha256').update(sql).digest('hex') };
const manifest = { project_ref: 'qonqemhljgxlwpghkxhn', migrations: [migration] };
const history = [{ version: '20261019203000', name: 'example', statements: [sql] }];

test('partial deployment resumes only matching source and JWT settings; unrelated changes stop it', async () => {
  const source = 'reviewed function';
  const fn = {name:'example',status:'pending_deployment',deployed_version:1,verify_jwt:true,files:['index.ts'],sha256:{'index.ts':createHash('sha256').update(source).digest('hex')}};
  const m = {functions:[fn]};
  const files = async () => ({'index.ts':source});
  assert.deepEqual(await planFunctions(m,[{slug:'example',version:2,verify_jwt:true}],files),[]);
  assert.deepEqual(await planFunctions(m,[{slug:'example',version:1,verify_jwt:true}],async()=>({'index.ts':'old'})),[fn]);
  assert.deepEqual(await planFunctions({functions:[{...fn,deployed_version:null}]},[],files),[{...fn,deployed_version:null}]);
  for (const [remote,read] of [
    [{slug:'example',version:2,verify_jwt:false},files],
    [{slug:'example',version:2,verify_jwt:true},async()=>({'index.ts':'unrelated'})],
    [{slug:'example',version:2,verify_jwt:true},async()=>({'index.ts':source,'extra.ts':'unexpected'})],
  ]) await assert.rejects(planFunctions(m,[remote],read),/changed outside/);
});

test('website Auth settings use the current domain, preserve existing redirects and omit unrelated credentials', () => {
  const auth = {site_url:'https://previous.example', uri_allow_list:'https://previous.example/ResetPassword', smtp_pass:'not-a-real-secret', disable_signup:true};
  const patch = websiteAuthPatch(auth);
  assert.equal(patch.site_url, 'https://imperialgaming.llc');
  const redirects = patch.uri_allow_list.split(',');
  for (const url of ['https://previous.example/ResetPassword', 'https://imperialgaming.llc', 'https://imperialgaming.llc/ResetPassword', 'https://www.imperialgaming.llc/ResetPassword', 'https://ig-games-repo.vercel.app/ResetPassword']) assert.ok(redirects.includes(url));
  assert.deepEqual(Object.keys(patch).sort(), ['site_url', 'uri_allow_list']);
  assert.ok(redirects.every(url => !url.includes('*')));
  assert.deepEqual(websiteAuthPatch({...auth,...patch}), {});
});

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
