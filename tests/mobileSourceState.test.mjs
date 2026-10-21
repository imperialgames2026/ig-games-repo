import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { requireCommittedMobileSource } from '../scripts/mobile-source-state.mjs';

function repo(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'mobile-source-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'Isolated Test');
  git('config', 'user.email', 'test@example.invalid');
  writeFileSync(join(cwd, '.gitignore'), 'dist/\n');
  writeFileSync(join(cwd, 'App.jsx'), 'export default 1;\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'fixture');
  return { cwd, git };
}

test('returns exact committed SHA and permits ignored generated assets', t => {
  const { cwd, git } = repo(t);
  mkdirSync(join(cwd, 'dist'));
  writeFileSync(join(cwd, 'dist/index.html'), 'generated');
  assert.equal(requireCommittedMobileSource(cwd), git('rev-parse', 'HEAD'));
});
test('rejects unstaged application edits outside package/native paths', t => {
  const { cwd } = repo(t);
  writeFileSync(join(cwd, 'App.jsx'), 'export default 2;\n');
  assert.throws(() => requireCommittedMobileSource(cwd), /requires committed source/);
});
test('rejects staged edits and staged new source files', t => {
  const { cwd, git } = repo(t);
  writeFileSync(join(cwd, 'App.jsx'), 'export default 2;\n'); git('add', '.');
  assert.throws(() => requireCommittedMobileSource(cwd), /requires committed source/);
  git('commit', '--quiet', '-m', 'changed fixture');
  writeFileSync(join(cwd, 'new.js'), 'export default 3;\n'); git('add', '.');
  assert.throws(() => requireCommittedMobileSource(cwd), /requires committed source/);
});
test('rejects untracked source rather than stamping an incomplete commit', t => {
  const { cwd } = repo(t);
  writeFileSync(join(cwd, 'new.js'), 'export default 3;\n');
  assert.throws(() => requireCommittedMobileSource(cwd), /requires committed source/);
});
