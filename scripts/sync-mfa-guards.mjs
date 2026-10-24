// Keep reviewed Edge bundles self-contained, as required by the deployment
// manifest. Tests compare every generated copy to this single source of truth.
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('supabase/backend-manifest.json', root)));
const guard = readFileSync(new URL('lib/serverMfa.js', root), 'utf8').replace('export function', 'function');
for (const fn of manifest.functions) {
  if (fn.name === 'ig-fireblocks-sandbox-webhook') continue; // Signed machine webhook; no customer session.
  const path = new URL(`supabase/functions/${fn.name}/index.ts`, root);
  const source = readFileSync(path, 'utf8');
  const marker = /\/\/ BEGIN GENERATED MFA GUARD\n[\s\S]*?\/\/ END GENERATED MFA GUARD\n/;
  const block = `// BEGIN GENERATED MFA GUARD\n${guard}// END GENERATED MFA GUARD\n`;
  if (!source.includes('hasCompletedMfa(')) throw Error(`Missing enforcement call in ${fn.name}`);
  writeFileSync(path, marker.test(source) ? source.replace(marker, block) : source + '\n' + block);
}
