import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadMobileEnvironment } from './mobile-client-config.mjs';

// One-time source generation. CI commits only package manifests and android/ to
// the isolated feature branch; no keystores, APKs, AABs, dist or local.properties.
if (existsSync('android/app/build.gradle')) {
  console.log('Committed Android project found; dependency installation remains npm ci.');
  process.exit(0);
}
const run = (command, args, env = process.env) => execFileSync(command, args, { stdio: 'inherit', env });
run('npm', ['install', '--save-exact', '@capacitor/core@8.5.3', '@capacitor/android@8.5.3', '@capacitor/app@8.1.2']);
run('npm', ['install', '--save-dev', '--save-exact', '@capacitor/cli@8.5.3']);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.scripts['android:assets'] = 'node scripts/build-mobile-assets.mjs';
pkg.scripts['android:sync'] = 'npm run android:assets && cap sync android';
pkg.scripts['android:debug'] = 'npm run android:sync && cd android && ./gradlew assembleDebug';
pkg.scripts['android:release:unsigned'] = 'npm run android:sync && cd android && ./gradlew assembleRelease bundleRelease';
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const env = await loadMobileEnvironment();
env.GITHUB_SHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
run('npm', ['run', 'build'], env);
run('npx', ['--no-install', 'cap', 'add', 'android'], env);
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestPath, 'utf8');
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
if (!manifest.includes('android:usesCleartextTraffic=')) manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="false"');
if (!manifest.includes('android:windowSoftInputMode=')) manifest = manifest.replace('<activity', '<activity android:windowSoftInputMode="adjustResize"');
writeFileSync(manifestPath, manifest);
const gradlePath = 'android/app/build.gradle';
writeFileSync(gradlePath, readFileSync(gradlePath, 'utf8').replace('versionName "1.0"', 'versionName "0.1.0-practice"'));
console.log('Native source generated. Release identity remains provisional; no production signing configured.');
