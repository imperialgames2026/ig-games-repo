import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const archive = process.env.IG_GAMES_ARCHIVE || path.join(root, 'ig-games.zip');
const work = path.join(root, '.migration-work');
const source = path.join(work, 'source');
const out = path.join(root, 'supabase', 'functions');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(source, { recursive: true });
execFileSync('unzip', ['-q', archive, '-d', source]);
const fnRoot = path.join(source, 'base44', 'functions');
if (!fs.existsSync(fnRoot)) throw new Error(`Missing base44/functions in ${archive}`);
for (const name of fs.readdirSync(fnRoot)) {
  const entry = path.join(fnRoot, name, 'entry.ts');
  if (!fs.existsSync(entry)) continue;
  const targetDir = path.join(out, name);
  fs.mkdirSync(targetDir, { recursive: true });
  let code = fs.readFileSync(entry, 'utf8');
  code = code.replace(
  /import\s+\{\s*createClientFromRequest\s*\}\s+from\s+['"]npm:@base44\/sdk[^'"]+[];?/g,
  "import { createClientFromRequest } from '../_shared/base44Compat.ts';"
);
  fs.writeFileSync(path.join(targetDir, 'index.ts'), code);
}
console.log(`Prepared ${fs.readdirSync(fnRoot).length} Supabase Edge Functions.`);
