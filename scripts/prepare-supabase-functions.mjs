import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

const archive =
  process.env.IG_GAMES_ARCHIVE ||
  path.join(root, 'ig-games.zip');

const work = path.join(root, '.migration-work');
const source = path.join(work, 'source');
const out = path.join(root, 'supabase', 'functions');

console.log('Starting Base44 → Supabase function migration');
console.log(`Archive: ${archive}`);

fs.rmSync(work, {
  recursive: true,
  force: true
});

fs.mkdirSync(source, {
  recursive: true
});

console.log('Extracting archive...');

execFileSync(
  'unzip',
  ['-q', archive, '-d', source],
  { stdio: 'inherit' }
);

const possibleRoots = [
  path.join(source, 'base44', 'functions'),
  path.join(source, 'functions'),
  path.join(source, 'app', 'functions')
];

let fnRoot = null;

for (const candidate of possibleRoots) {
  if (fs.existsSync(candidate)) {
    fnRoot = candidate;
    break;
  }
}

if (!fnRoot) {
  console.error('Could not locate Base44 functions directory.');
  console.error('Searched:');
  possibleRoots.forEach(p => console.error(` - ${p}`));
  process.exit(1);
}

console.log(`Functions found at: ${fnRoot}`);

fs.mkdirSync(out, {
  recursive: true
});

let prepared = 0;

for (const name of fs.readdirSync(fnRoot)) {
  const functionPath = path.join(fnRoot, name);

  if (!fs.statSync(functionPath).isDirectory()) {
    continue;
  }

  const entryCandidates = [
    path.join(functionPath, 'entry.ts'),
    path.join(functionPath, 'index.ts'),
    path.join(functionPath, 'main.ts')
  ];

  const entry = entryCandidates.find(file =>
    fs.existsSync(file)
  );

  if (!entry) {
    console.log(`Skipping ${name}: no entry file`);
    continue;
  }

  const targetDir = path.join(out, name);

  fs.mkdirSync(targetDir, {
    recursive: true
  });

  let code = fs.readFileSync(entry, 'utf8');

  // Replace Base44 SDK import safely without regex parsing issues
  code = code
    .split('npm:@base44/sdk')
    .join('../_shared/base44Compat.ts');

  code = code.replace(
    /from\s+['"][^'"]*base44Compat\.ts['"]/g,
    "from '../_shared/base44Compat.ts'"
  );

  fs.writeFileSync(
    path.join(targetDir, 'index.ts'),
    code
  );

  prepared++;

  console.log(`Prepared: ${name}`);
}

console.log(
  `Prepared ${prepared} Supabase Edge Functions.`
);

if (prepared < 1) {
  console.error('No functions were prepared.');
  process.exit(1);
}
