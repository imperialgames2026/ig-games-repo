import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {chessModelTemplateKey} from '../lib/chessModelPieces.mjs';
test('actual approved GLB supplies both colours of every piece after loader name sanitizing',async()=>{
 const bytes=readFileSync(new URL('../public/pvp3d-models/Chess.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const keys=new Set(),pieces=[];gltf.scene.traverse(node=>{const key=chessModelTemplateKey(node);if(key){keys.add(key);pieces.push(key);}});
 assert.equal(pieces.length,32);assert.deepEqual([...keys].sort(),['bB','bK','bN','bP','bQ','bR','wB','wK','wN','wP','wQ','wR']);
});
test('Blender duplicate suffixes never become piece kinds; unrelated nodes are ignored',()=>{
 for(const name of ['Piece_N.002','Piece_N002','Piece_N_002'])assert.equal(chessModelTemplateKey({name,position:{z:-1}}),'bN');
 assert.equal(chessModelTemplateKey({name:'Knight mesh',position:{z:0}}),null);
});
