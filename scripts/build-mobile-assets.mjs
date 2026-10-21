import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadMobileEnvironment } from './mobile-client-config.mjs';

const env = await loadMobileEnvironment();
const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(source)) throw new Error('Exact source commit is required.');
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'package.json', 'package-lock.json', 'android'], { stdio: 'inherit' });
// GitHub PR runs otherwise inject a synthetic merge SHA into Vite metadata.
env.GITHUB_SHA = source;
delete env.CF_PAGES_COMMIT_SHA;
delete env.VERCEL_GIT_COMMIT_SHA;
execFileSync('npm', ['run', 'build'], { stdio: 'inherit', env });
execFileSync('node', ['scripts/verify-mobile-bundle.mjs'], { stdio: 'inherit', env });
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const manifest = JSON.parse(readFileSync('supabase/backend-manifest.json', 'utf8'));
writeFileSync('dist/mobile-release.json', JSON.stringify({
  source_commit: source,
  app_id: config.appId,
  app_name: config.appName,
  release_scope: 'practice',
  publish_approved: false,
  production_signing_configured: false,
  native_email_callbacks_enabled: false,
  backend_url: env.VITE_SUPABASE_URL,
  reviewed_migration_count: manifest.migrations.length,
  package_lock_sha256: hash('package-lock.json'),
  backend_manifest_sha256: hash('supabase/backend-manifest.json'),
  game_scope_sha256: hash('config/game-migration-scope.json'),
  release_gates: ['durable app ID', 'approved verified Auth links', 'isolated full Auth/device matrix', 'dependency security review', 'owner-controlled signing', 'tester acceptance'],
}, null, 2) + '\n');
console.log('Bundled practice assets stamped for source ' + source + '; publication remains gated.');
