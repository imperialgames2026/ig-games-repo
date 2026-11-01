import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{createHash}from'node:crypto';
import{cueFor}from'../review/game-collection/static/runtime/game-audio.js';
const base=new URL('../review/game-collection/static/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('../review/game-collection/PROVENANCE.json',import.meta.url)));
test('review payload is pinned; all original models/rules/Unity/audio bytes are preserved',()=>{
 assert.equal(manifest.handoffSHA256,'3cf3951bec22ce8fa6b42dee866426a555276908662d3ff1f1c9fb634e09d635');
 for(const f of manifest.files){const data=readFileSync(new URL(f.path,base));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,f.path);assert.ok(data.length<=25*1024*1024);if(/^(assets\/|runtime\/games\/)/.test(f.path)||f.path.startsWith('unity/')&&!f.adapted)assert.equal(f.sha256,f.sourceSHA256,f.path);}
 assert.equal(manifest.files.filter(f=>f.path.endsWith('.wav')).length,7);
});
test('server, accounts, simulated custody and market quote APIs are absent',()=>{
 for(const name of manifest.excluded)assert.equal(existsSync(new URL(name,base)),false,name);
 for(const f of manifest.files.filter(f=>f.path.endsWith('.js')&&!f.path.startsWith('unity/'))){const s=readFileSync(new URL(f.path,base),'utf8');assert.doesNotMatch(s,/fetch\(['"]\/api|new EventSource\(|new WebSocket\(/,f.path);assert.doesNotMatch(s,/from\s+['"]node:/,f.path);}
 const roulette=readFileSync(new URL('runtime/roulette-view.js',base),'utf8');assert.doesNotMatch(roulette,/fetch\(|roulette-quote|Equivalent currency/);assert.match(roulette,/demo chips/);
});
test('original audio cue selection handles actual Fleet hit log and ignores repaints',()=>{
 const before={id:'demo',version:1,over:false,round:0,turn:0},room={id:'demo',version:2,seat:0,state:{over:false,round:0,turn:1,log:['South fires A1: hit.']}};
 assert.equal(cueFor(before,room),'hit');assert.equal(cueFor({...before,version:2},room),null);assert.equal(cueFor(null,room),null);
});

test('transport parts reassemble exact frozen Unity runtime',()=>{const data=Buffer.concat(manifest.reassembledWasm.parts.map(p=>readFileSync(new URL(p,base))));assert.equal(data.length,manifest.reassembledWasm.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),manifest.reassembledWasm.sha256);});
