import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeImperialViewport } from '../lib/imperialViewportModel.js';

test('Razr-like native portrait viewport scales the site and game canvas down', () => {
  const layout = computeImperialViewport({ width: 412, height: 915, pixelRatio: 2.625, isNative: true });
  assert.equal(layout.deviceClass, 'phone');
  assert.equal(layout.orientation, 'portrait');
  assert.equal(layout.isPhone, true);
  assert.equal(layout.uiScale, 0.86);
  assert.equal(layout.gameScale, 0.8);
});

test('compact native phones scale more aggressively than standard phones', () => {
  const compact = computeImperialViewport({ width: 360, height: 800, isNative: true });
  const standard = computeImperialViewport({ width: 412, height: 915, isNative: true });
  assert.equal(compact.deviceClass, 'compact-phone');
  assert.ok(compact.uiScale < standard.uiScale);
  assert.ok(compact.gameScale < standard.gameScale);
});

test('landscape phones reduce game canvas further for limited vertical space', () => {
  const portrait = computeImperialViewport({ width: 412, height: 915, isNative: true });
  const landscape = computeImperialViewport({ width: 915, height: 412, isNative: true });
  assert.equal(landscape.orientation, 'landscape');
  assert.ok(landscape.gameScale < portrait.gameScale);
});

test('tablets retain substantially more UI density than phones', () => {
  const phone = computeImperialViewport({ width: 412, height: 915, isNative: true });
  const tablet = computeImperialViewport({ width: 800, height: 1280, isNative: true });
  assert.equal(tablet.deviceClass, 'tablet');
  assert.ok(tablet.uiScale > phone.uiScale);
  assert.ok(tablet.gameScale > phone.gameScale);
});

test('ordinary web browsers are not globally rescaled', () => {
  const web = computeImperialViewport({ width: 412, height: 915, isNative: false });
  assert.equal(web.uiScale, 1);
  assert.equal(web.gameScale, 1);
});

test('adaptive viewport is wired through the app and every Play route layout', () => {
  const app = readFileSync('App.jsx', 'utf8');
  const layout = readFileSync('Layout.jsx', 'utf8');
  const css = readFileSync('index.css', 'utf8');
  assert.match(app, /ImperialViewportProvider/);
  assert.match(layout, /AdaptiveGameViewport/);
  assert.match(layout, /isPlayPage/);
  assert.match(css, /ig-adaptive-game-viewport/);
  assert.match(css, /data-ig-native/);
});
