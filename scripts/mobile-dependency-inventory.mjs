import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Inventory only: dev/production installation is NOT proof of bundle reachability.
// No finding is waived here; a successful collection is not security acceptance.
export function inventory(audit, lock, source) {
  if (audit?.error || !audit?.metadata?.vulnerabilities || !audit?.vulnerabilities || !lock?.packages) {
    throw new Error('Incomplete dependency audit: no security conclusion can be drawn.');
  }
  if (!/^[0-9a-f]{40}$/.test(source)) throw new Error('Exact source SHA required.');
  const counts = audit.metadata.vulnerabilities;
  for (const severity of ['low', 'moderate', 'high', 'critical', 'total']) {
    if (!Number.isInteger(counts[severity]) || counts[severity] < 0) throw new Error('Invalid audit severity counts.');
  }
  const rows = Object.entries(audit.vulnerabilities).map(([name, item]) => {
    const nodes = (item.nodes ?? []).map(path => ({
      path,
      version: lock.packages[path]?.version ?? null,
      installation: !lock.packages[path] ? 'unknown' : lock.packages[path].dev === true ? 'development' : 'production',
    }));
    return {
      name, severity: item.severity, direct: item.isDirect === true,
      vulnerable_range: item.range, nodes, fix_available: item.fixAvailable ?? false,
      advisories: (item.via ?? []).filter(v => typeof v === 'object').map(v => ({
        id: v.source, title: v.title, url: v.url, range: v.range, severity: v.severity,
      })),
      dependency_causes: (item.via ?? []).filter(v => typeof v === 'string'),
      affected_dependents: item.effects ?? [],
      reachability: 'not evaluated', disposition: 'unresolved; no waiver',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    source_commit: source,
    scope: 'npm dependency inventory; not native Auth, gameplay or release acceptance',
    counts,
    critical_or_high_present: counts.critical > 0 || counts.high > 0,
    security_release_approved: false,
    findings: rows,
  };
}

export function collect(outputDirectory) {
  const out = resolve(outputDirectory);
  mkdirSync(out, { recursive: true });
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const lockText = readFileSync('package-lock.json', 'utf8');
  const run = spawnSync('npm', ['audit', '--json', '--package-lock-only'], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(resolve(out, 'npm-audit.json'), run.stdout ?? '');
  if (run.error || ![0, 1].includes(run.status)) throw new Error('npm audit could not complete; no clean audit is claimed.');
  let audit;
  try { audit = JSON.parse(run.stdout); } catch { throw new Error('npm audit returned invalid JSON.'); }
  const report = inventory(audit, JSON.parse(lockText), source);
  report.package_lock_sha256 = createHash('sha256').update(lockText).digest('hex');
  report.collected_at = new Date().toISOString();
  report.npm_version = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  writeFileSync(resolve(out, 'dependency-inventory.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ source_commit: source, counts: report.counts, security_release_approved: false }));
  if (report.critical_or_high_present) console.warn('High/critical dependency findings remain unresolved. Collection success is NOT a security pass.');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/mobile-dependency-inventory.mjs OUTPUT_DIRECTORY');
  collect(process.argv[2]);
}
