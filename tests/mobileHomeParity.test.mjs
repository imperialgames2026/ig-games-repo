import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('pages/Home.jsx', 'utf8');
const login = readFileSync('pages/Login.jsx', 'utf8');

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
