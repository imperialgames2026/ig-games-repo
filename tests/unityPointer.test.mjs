import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Execute the actual frame handlers without loading WASM or contacting a server.
async function frame() {
  const handlers = {}, windowHandlers = {}, messages = [];
  const canvas = { style: {}, addEventListener: (name, fn) => handlers[name] = fn,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }) };
  const parent = { postMessage: message => messages.push(message) };
  const source = readFileSync(new URL('../components/practice/unity-frame.mjs', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, {
    window: { parent, addEventListener: (name, fn) => windowHandlers[name] = fn },
    document: { getElementById: () => canvas, addEventListener() {} },
    location: { origin: 'http://local.test' }, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    loadUnity: async () => ({ SendMessage() {}, Quit() {} }),
    selectionAtScreen: () => 'red', validBet: () => true, validateOutcome: () => true,
  });
  await Promise.resolve();
  windowHandlers['imperial-unity-practice']({ detail: { version: 1, type: 'ready' } });
  windowHandlers.message({ origin: 'http://local.test', source: parent,
    data: { channel: 'imperial-practice-command', command: 'SetBet', value: '{"locked":false}' } });
  return { send: (type, overrides = {}) => handlers[type]({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100, ...overrides }),
    bets: () => messages.filter(m => m.type === 'bet'), gestures: () => messages.filter(m => m.type === 'gesture') };
}
for (const button of [1, 2]) test(`button ${button} cannot wager, including mismatched release`, async () => {
  const f = await frame();
  f.send('pointerdown', { button }); f.send('pointerup', { button });
  f.send('pointerdown', { button }); f.send('pointerup');
  f.send('pointerdown'); f.send('pointerup', { button });
  assert.equal(f.bets().length, 0);
  f.send('pointerdown'); f.send('pointerup');
  assert.equal(f.bets().length, 1, 'subsequent primary click recovers');
});
for (const pointerType of ['mouse', 'touch', 'pen']) test(`${pointerType} primary tap preserved`, async () => {
  const f = await frame(); f.send('pointerdown', { pointerType }); f.send('pointerup', { pointerType });
  assert.equal(f.bets().length, 1);
});
test('drag and cancelled input do not bet', async () => {
  const f = await frame(); f.send('pointerdown'); f.send('pointermove', { clientX: 150 }); f.send('pointerup', { clientX: 150 });
  f.send('pointerdown'); f.send('pointercancel'); f.send('pointerup');
  assert.equal(f.bets().length, 0);
});
test('two-finger pinch preserved and cannot become a tap', async () => {
  const f = await frame(); const touch = { pointerType: 'touch' };
  f.send('pointerdown', touch); f.send('pointerdown', { ...touch, pointerId: 2, clientX: 200 });
  f.send('pointermove', { ...touch, pointerId: 2, clientX: 220 });
  f.send('pointerup', touch); f.send('pointerup', { ...touch, pointerId: 2, clientX: 220 });
  assert.equal(f.gestures().length, 1); assert.equal(f.bets().length, 0);
});
