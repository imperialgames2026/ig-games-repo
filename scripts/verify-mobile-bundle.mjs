#!/usr/bin/env node
// Reject stale or non-practice bundles before syncing to the Android shell.
// This is a release guard, not a substitute for Auth, CI, and emulator testing.
import { readFileSync, existsSync } from 'node:fs';
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
// Mobile may carry reviewed-but-pending source migrations, but it must not silently
// treat them as hosted/deployed. Current hosted practice baseline remains 104.
const pendingMigrations = manifest.migrations.filter(m => m.status === 'pending_deployment');
const deployedReviewedMigrations = manifest.migrations.length - pendingMigrations.length;
if (deployedReviewedMigrations !== 105) fail('deployed migration baseline changed; re-review required');
if (pendingMigrations.length !== 3) fail('pending migration set changed; re-review required');
const expectedBackend = 'https://qonqemhljgxlwpghkxhn.supabase.co';
if (release.backend_url !== expectedBackend) fail('unexpected Supabase backend');
if (!process.env.MOBILE_ISOLATED_AUTH_REVIEWED)
  console.warn('WARNING: Native Auth is not approved: do not distribute this build for sign-in testing.');
console.log('Practice bundle verified:', expectedCommit, 'migrations:', manifest.migrations.length, 'held games:', scope.nonMigration.length);
