import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('unsigned npm path explicitly bypasses owner signing properties', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts['android:release:unsigned'], /gradlew -PimperialUnsignedRelease=true assembleRelease bundleRelease/);
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  assert.match(gradle, /if \(!unsignedReleaseRequested && signingPropertiesFile\.exists\(\)\) \{/);
  assert.match(gradle, /def releaseSigningReady = false/);
  assert.equal((gradle.match(/releaseSigningReady = true/g) || []).length, 1);
  assert.match(gradle, /if \(releaseSigningReady\) \{\s*signingConfig signingConfigs\.release/);
});
