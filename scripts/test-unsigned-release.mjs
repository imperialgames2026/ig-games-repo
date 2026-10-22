// Evaluate the actual pre-Android signing configuration with Gradle, in disposable
// fixture roots. No Android plugin, signing task, real properties or key is used.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const source = readFileSync('android/app/build.gradle', 'utf8');
assert.ok(source.startsWith("apply plugin: 'com.android.application'\n"));
const policy = source.slice(source.indexOf('\n') + 1, source.indexOf('\nandroid {'));
assert.ok(policy.includes('signingProperties.load'));
const fixtures = mkdtempSync(join(tmpdir(), 'ig-unsigned-fixtures-'));
const gradleHome = process.env.IG_FIXTURE_GRADLE_HOME || join(tmpdir(), 'ig-unsigned-gradle-cache');
let passed = 0;
try {
  for (const scenario of ['unreadable-unsigned', 'valid-unsigned', 'valid-owner-path', 'invalid-option']) {
    const dir = join(fixtures, scenario); mkdirSync(dir);
    writeFileSync(join(dir, 'settings.gradle'), "rootProject.name = 'synthetic-signing-policy'\n");
    if (scenario === 'unreadable-unsigned') {
      // Opening this directory as a properties file would fail. Unsigned must not open it.
      mkdirSync(join(dir, 'key.properties'));
    } else {
      writeFileSync(join(dir, 'fixture-not-a-key.txt'), 'SYNTHETIC NON-KEY FIXTURE');
      writeFileSync(join(dir, 'key.properties'), 'storeFile=fixture-not-a-key.txt\nstorePassword=synthetic\nkeyAlias=synthetic\nkeyPassword=synthetic\n');
    }
    const expectedReady = scenario === 'valid-owner-path';
    writeFileSync(join(dir, 'build.gradle'), policy + `
 tasks.register('verifyPolicy') {
   doLast {
     assert releaseSigningReady == ${expectedReady}
     assert signingProperties.isEmpty() == ${!expectedReady}
     println('SYNTHETIC_POLICY_PASS')
   }
 }
`);
    const args = ['-p', dir, '-g', gradleHome, '--no-daemon', '--console=plain', 'verifyPolicy'];
    if (scenario !== 'valid-owner-path') args.push('-PimperialUnsignedRelease=' + (scenario === 'invalid-option' ? 'false' : 'true'));
    const result = spawnSync(process.env.IG_FIXTURE_GRADLE_EXECUTABLE || resolve(root, 'android/gradlew'), args, { encoding: 'utf8', timeout: 180000, env: { ...process.env, GRADLE_USER_HOME: gradleHome } });
    assert.ifError(result.error);
    if (scenario === 'invalid-option') {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /imperialUnsignedRelease accepts only true/);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /SYNTHETIC_POLICY_PASS/);
    }
    console.log(`PASS: ${scenario}`); passed++;
  }
  console.log(`${passed} synthetic Gradle policy scenarios passed; no signing task or APK produced.`);
} finally { rmSync(fixtures, { recursive: true, force: true }); }
