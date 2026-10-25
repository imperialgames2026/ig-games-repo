#!/usr/bin/env node
// Reject stale or non-practice bundles before syncing to the Android shell.
// This is a release guard, not a substitute for Auth, CI, and emulator testing.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function fail(message) { console.error('Mobile bundle rejected: ' + message); process.exit(1); }
const releasePath = 'dist/release.json';
if (!existsSync('dist/index.html') || !existsSync(releasePath)) fail('run npm run build first');
const release = JSON.parse(readFileSync(releasePath, 'utf8'));
const manifest = JSON.parse(readFileSync('supabase/backend-manifest.json', 'utf8'));
const scope = JSON.parse(readFileSync('config/game-migration-scope.json', 'utf8'));
const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (release.commit !== expectedCommit) fail('source SHA does not match the bundled release');
if (release.release_mode !== 'practice' || release.legacy_operations_enabled !== false)
  fail('only the reviewed practice build is permitted');
if (release.reviewed_migration_count !== manifest.migrations.length)
  fail('backend migration manifest mismatch');
if (release.held_game_count !== scope.nonMigration.length || scope.nonMigration.length !== 23)
  fail('excluded-game policy mismatch');
// Source inventory is not a hosted migration count. The installed v7 inventory
// (69960cca) is unchanged; only the two reviewed replay/fairness files were added.
// Read-only hosted history 2026-10-25 confirms those versions present and the exact
// three KYC versions absent. This does not certify deployed SQL bytes/runtime.
// Pin every file/hash/status so a same-count replacement cannot bypass re-review.
const migrationInventoryHash = createHash('sha256').update(JSON.stringify(manifest.migrations)).digest('hex');
if (migrationInventoryHash !== '3ef204b9bf91cc1107559a29b3491fc2d39cbed8679b6aba02de14a27e6eded6')
  fail('reviewed migration inventory changed; re-review required');
const pendingMigrations = manifest.migrations.filter(m => m.status === 'pending_deployment');
const recordedReviewedMigrations = manifest.migrations.length - pendingMigrations.length;
if (recordedReviewedMigrations !== 108 || pendingMigrations.length !== 3)
  fail('reviewed migration classification changed; re-review required');
const expectedBackend = 'https://qonqemhljgxlwpghkxhn.supabase.co';
if (release.backend_url !== expectedBackend) fail('unexpected Supabase backend');
if (!process.env.MOBILE_ISOLATED_AUTH_REVIEWED)
  console.warn('WARNING: Native Auth is not approved: do not distribute this build for sign-in testing.');
console.log('Practice bundle verified:', expectedCommit, 'migrations:', manifest.migrations.length, 'held games:', scope.nonMigration.length);
