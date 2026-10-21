import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { LAB_SUPABASE_URL, validateLabConfiguration } from '../config/test-lab.js';
import { resolveTestLabHostingEnvironment } from '../config/test-lab-hosting.js';

const action = process.argv[2];
if (!['build', 'dev'].includes(action) || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/run-test-lab.mjs [build|dev]');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const environment = resolveTestLabHostingEnvironment(loadEnv('lab', root, 'VITE_'));
// The non-secret URL is fixed here; a key must be supplied for this project.
environment.VITE_SUPABASE_URL ??= LAB_SUPABASE_URL;
validateLabConfiguration(environment);
const args = action === 'build'
  ? ['build', '--mode', 'lab', '--outDir', 'dist-lab']
  : ['--mode', 'lab', '--host', '127.0.0.1', '--port', '5173', '--strictPort'];
const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), ...args], {
  cwd: root, env: { ...process.env, ...environment }, stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
