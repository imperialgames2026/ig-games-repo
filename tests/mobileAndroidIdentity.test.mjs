import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const permanentId = 'llc.imperialgaming.games';

test('Android permanent identity is consistent and provisional ID is gone', () => {
  const cap = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  const strings = readFileSync('android/app/src/main/res/values/strings.xml', 'utf8');
  const activity = readFileSync('android/app/src/main/java/llc/imperialgaming/games/MainActivity.java', 'utf8');
  assert.equal(cap.appId, permanentId);
  assert.equal(cap.appName, 'Imperial Games');
  assert.match(gradle, /applicationId "llc\.imperialgaming\.games"/);
  assert.match(gradle, /namespace = "llc\.imperialgaming\.games"/);
  assert.match(strings, /llc\.imperialgaming\.games/);
  assert.match(activity, /package llc\.imperialgaming\.games;/);
  for (const content of [JSON.stringify(cap), gradle, strings, activity]) {
    assert.doesNotMatch(content, /com\.imperialgaming\.practice\.dev/);
  }
  assert.equal(existsSync('android/app/src/main/java/com/imperialgaming/practice/dev/MainActivity.java'), false);
});

test('release signing is owner-local and never required in CI', () => {
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  const ignore = readFileSync('.gitignore', 'utf8');
  const example = readFileSync('android/key.properties.example', 'utf8');
  assert.match(ignore, /android\/key\.properties/);
  assert.match(ignore, /\*\.jks/);
  assert.match(gradle, /rootProject\.file\('key\.properties'\)/);
  assert.match(gradle, /if \(releaseSigningReady\)/);
  assert.match(example, /storeFile=\/absolute\/path\/to\/ImperialGames-release\.jks/);
  assert.doesNotMatch(example, /sb_secret_|service_role|BEGIN PRIVATE KEY/);
});
