import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs from the consolidated checkout alone. An optional source checkout verifies
// the provenance snapshot, but it is never an application/runtime dependency.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/repository-consolidation.json'), 'utf8'));
const errors = [];
const checksum = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function checkedPath(base, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('Invalid manifest path');
  const file = resolve(base, path);
  const rel = relative(base, file);
  if (rel.startsWith('..') || !rel) throw new Error('Manifest path escapes checkout: ' + path);
  if (!existsSync(file)) { errors.push('Missing ' + path); return null; }
  const real = relative(realpathSync(base), realpathSync(file));
  if (real.startsWith('..') || isAbsolute(real)) throw new Error('Manifest symlink escapes checkout: ' + path);
  return file;
}
function verifyHash(base, path, expected) {
  const file = checkedPath(base, path);
  if (file && checksum(file) !== expected) errors.push('Checksum mismatch: ' + path);
}
if (manifest.schema_version !== 1 || manifest.application_root !== '.') throw new Error('Unsupported consolidation manifest');
if (process.argv.length > 4 || (process.argv.length > 2 && process.argv[2] !== '--source') ||
    (process.argv[2] === '--source' && !process.argv[3])) {
  throw new Error('Usage: node scripts/audit-repository-consolidation.mjs [--source /path/to/casino-zip]');
}
verifyHash(root, manifest.archive.target, manifest.archive.sha256);
for (const ref of manifest.references) verifyHash(root, ref.target, ref.sha256);
for (const entry of manifest.frontend) for (const target of entry.targets) checkedPath(root, target);
for (const entry of manifest.functions) if (entry.target) checkedPath(root, entry.target);
for (const entry of manifest.migrations) for (const target of entry.targets || []) checkedPath(root, target);

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.dev?.includes('vite') || !pkg.scripts?.build?.includes('vite build')) errors.push('Main application build entrypoints missing');
if (pkg.dependencies?.['@base44/sdk']) errors.push('Legacy provider SDK reintroduced into the main application');
for (const file of ['App.jsx', 'Layout.jsx', 'main.jsx', 'index.html', 'lib/AuthContext.jsx', 'lib/supabaseClient.js']) checkedPath(root, file);

if (process.argv[2] === '--source') {
  const source = resolve(process.argv[3]);
  verifyHash(source, manifest.archive.source, manifest.archive.sha256);
  for (const ref of manifest.references) verifyHash(source, ref.source, ref.sha256);
  for (const entry of [...manifest.frontend, ...manifest.functions, ...manifest.migrations]) {
    verifyHash(source, entry.source, entry.source_sha256);
  }
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  const count = (items, key) => Object.fromEntries([...new Set(items.map(item => item[key]))].sort().map(value => [value, items.filter(item => item[key] === value).length]));
  console.log(JSON.stringify({
    status: 'pass',
    application: 'ig-games-repo',
    sourceCommit: manifest.source_commit,
    referenceDocuments: manifest.references.length,
    frontendFiles: manifest.frontend.length,
    frontendMapping: count(manifest.frontend, 'disposition'),
    sourceFunctions: count(manifest.functions, 'disposition'),
    sourceMigrations: count(manifest.migrations, 'disposition'),
    sourceCheckoutVerified: process.argv[2] === '--source',
    scope: 'Source consolidation and provenance; runtime/backend readiness is checked separately.',
  }, null, 2));
}
