import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assets = join(process.cwd(), 'dist', 'assets');
const cssFile = readdirSync(assets).find(name => /^index-.*\.css$/.test(name));
if (!cssFile) throw new Error('Built Tailwind stylesheet was not found.');
const path = join(assets, cssFile);
const css = readFileSync(path, 'utf8');
const required = ['.flex{', '.w-10{', '.max-w-7xl{', '.overflow-x-hidden{'];
for (const token of required) {
  if (!css.includes(token)) throw new Error('Built stylesheet is missing required utility: ' + token);
}
if (statSync(path).size < 100000) {
  throw new Error('Built stylesheet is unexpectedly small; Tailwind source scanning may be disabled.');
}
console.log('Tailwind bundle verified:', cssFile, statSync(path).size, 'bytes');
