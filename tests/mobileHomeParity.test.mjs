import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('pages/Home.jsx', 'utf8');
const login = readFileSync('pages/Login.jsx', 'utf8');
const css = readFileSync('index.css', 'utf8');

test('Android/web home uses production-style Imperial Games shell without legacy mutations', () => {
  assert.match(home, /IMPERIAL/);
  assert.match(home, /Featured Games/);
  assert.match(home, /\/imperial-gaming\.png/);
  assert.match(home, /approvedPracticeGames/);
  assert.match(home, /readApprovedPracticeGames/);
  assert.doesNotMatch(home, /Practice preview/);
  assert.doesNotMatch(home, /base44/);
  assert.doesNotMatch(home, /UserWallet\.(create|update)/);
  assert.doesNotMatch(home, /DailyReward|BonusActivator|DailyQuests|WeeklyQuests/);
});

test('login keeps native auth behavior while sharing Imperial Games branding', () => {
  assert.match(login, /window\.Capacitor\?\.isNativePlatform/);
  assert.match(login, /supabase\.auth\.signInWithPassword/);
  assert.match(login, /\/imperial-gaming\.png/);
});

test('Tailwind 4 scans the application source before Android bundling', () => {
  assert.match(css, /@import "tailwindcss";/);
  assert.match(css, /@config "\.\/tailwind\.config\.cjs";/);
  assert.match(css, /@source "\.\/";/);
  assert.ok(css.indexOf('@import "tailwindcss";') < css.indexOf('@config "./tailwind.config.cjs";'));
});
