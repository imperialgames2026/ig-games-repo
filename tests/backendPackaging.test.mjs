import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('reviewed backend packages all sources and rejects changed function bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'ig-package-test-'));
  try {
    cpSync(new URL('../supabase/', import.meta.url), join(root, 'supabase'), { recursive: true });
    cpSync(new URL('../scripts/', import.meta.url), join(root, 'scripts'), { recursive: true });
    const script = join(root, 'scripts/prepare-reviewed-backend.mjs');
    const valid = spawnSync(process.execPath, [script, join(root, 'valid')], { encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).functions, 29);
    assert.equal(JSON.parse(valid.stdout).migrations, 90);
    appendFileSync(join(root, 'supabase/functions/secure-wallet/index.ts'), '\n// unexpected change\n');
    const changed = spawnSync(process.execPath, [script, join(root, 'changed')], { encoding: 'utf8' });
    assert.notEqual(changed.status, 0);
    assert.match(changed.stderr, /Function checksum mismatch: secure-wallet\/index.ts/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
