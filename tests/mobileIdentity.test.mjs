import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TEST_PACKAGE } from '../scripts/android-isolation.mjs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('permanent identity agrees across bundled app, Android and native test targeting', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.appId, 'llc.imperialgaming.games');
  assert.equal(config.appName, 'Imperial Games');
  assert.equal(TEST_PACKAGE, config.appId);
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /namespace = "llc\.imperialgaming\.games"/);
  assert.match(gradle, /applicationId "llc\.imperialgaming\.games"/);
  assert.match(read('android/app/src/main/java/llc/imperialgaming/games/MainActivity.java'), /^package llc\.imperialgaming\.games;/);
  assert.equal(existsSync(new URL('../android/app/src/main/java/com/imperialgaming/practice/dev/MainActivity.java', import.meta.url)), false);
  const strings = read('android/app/src/main/res/values/strings.xml');
  for (const name of ['app_name', 'title_activity_main']) assert.ok(strings.includes(`<string name="${name}">Imperial Games</string>`));
  for (const name of ['package_name', 'custom_url_scheme']) assert.ok(strings.includes(`<string name="${name}">llc.imperialgaming.games</string>`));
  assert.match(read('scripts/android-webview-transport.mjs'), /const PACKAGE = 'llc\.imperialgaming\.games'/);
});

test('connected instrumentation checks the permanent target application identity', () => {
  const instrumentation = read('android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java');
  assert.match(instrumentation, /getInstrumentation\(\)\.getTargetContext\(\)/);
  assert.match(instrumentation, /assertEquals\("llc\.imperialgaming\.games", appContext\.getPackageName\(\)\)/);
  assert.doesNotMatch(instrumentation, /com\.getcapacitor\.app/);
});
