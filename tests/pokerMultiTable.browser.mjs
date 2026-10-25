import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fs.mkdtempSync(join(tmpdir(),'ig-poker-multitable-'));
const fixture=process.env.POKER_MULTITABLE_FIXTURE||join(output,'fixtures.json');
if(!process.env.POKER_MULTITABLE_FIXTURE)execFileSync(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run','tests/poker-hand-ledger.test.js','-t','keeps six interleaved tables'],{cwd:root,env:{...process.env,POKER_MULTITABLE_FIXTURE:fixture},stdio:'inherit',timeout:60000});
const tables=JSON.parse(fs.readFileSync(fixture,'utf8')).filter(t=>t.variant==='holdem');
const mock=`const tables=${JSON.stringify(tables)};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export const supabase={functions:{invoke:async(name,{body})=>{
 const t=tables.find(t=>t.id===body.tableId);if(!t)return {error:Error('Unknown table')};
 if(body.action==='history')return {data:{hands:[...t.proofs].reverse().map(p=>({handNo:p.handNo,root:p.root,createdAt:JSON.parse(p.steps[0].canonical).recordedAt}))}};
 if(body.action==='replay'){await pause(body.handNo===1?550:body.handNo===2?30:100);const p=t.proofs.find(p=>p.handNo===body.handNo);return {data:{...p,steps:p.steps.slice(body.from||0,(body.from||0)+100)}};}
 const p=t.proofs.at(-1),head=JSON.parse(p.head.canonical),openings=new Map(p.openings.map(o=>[o.position,o.card]));
 return {data:{table:{id:t.id,variant:t.variant,handNo:p.handNo,status:head.status,version:head.version,board:head.board,ownerId:'synthetic-viewer',smallBlind:5,bigBlind:10,currentBet:0},deckProof:p,holeCards:p.myPositions.map(n=>openings.get(n)),socialEvents:[],seats:head.seats.map(s=>({seat_no:s.seatNo,user_id:s.seatNo===p.mySeat?'synthetic-viewer':'other-'+s.seatNo,stack:s.stack,committed:s.committed,folded:s.folded,all_in:s.allIn}))}};
}}};export const requireSupabase=()=>supabase;`;
const qaFiles=['qa-multitable.html','qa-multitable.jsx'];
for(const file of qaFiles)assert.equal(fs.existsSync(join(root,file)),false,'QA file already exists: '+file);
fs.writeFileSync(root+'/'+qaFiles[0],'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#0a0612;color:white"><div id="root"></div><script type="module" src="/qa-multitable.jsx"></script></body></html>');
fs.writeFileSync(root+'/'+qaFiles[1],`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Desk from './pages/PokerMultiTable';import Table from './components/games/HoldemPracticeTable';import Fairness from './pages/FairnessManifesto';import './index.css';const Component=location.pathname==='/PlayPoker'?Table:location.pathname==='/FairnessManifesto'?Fairness:Desk;createRoot(document.getElementById('root')).render(<BrowserRouter><Component/></BrowserRouter>);`);
let server,browser;
try{
 server=await createServer({root,configFile:root+'/vite.config.js',plugins:[{name:'qa-multitable',enforce:'pre',configureServer(s){s.middlewares.use((req,res,next)=>{if(['/PlayPoker','/PokerMultiTable','/FairnessManifesto'].some(p=>req.url?.split('?')[0]===p))req.url='/qa-multitable.html'+(req.url.includes('?')?'?'+req.url.split('?')[1]:'');next();});},transform(code,id){if(id.endsWith('/lib/supabaseClient.js'))return mock;if(id.endsWith('/lib/AuthContext.jsx'))return "export const useAuth=()=>({user:{id:'synthetic-viewer'},isAuthenticated:true});";}}],server:{host:'127.0.0.1',port:54673,strictPort:false}});await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1800,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/PokerMultiTable');
 for(const t of tables){await page.getByRole('textbox',{name:'Table ID',exact:true}).fill(t.id);await page.getByRole('button',{name:/Add table/}).click();}
 const frames=tables.map((t,i)=>page.frameLocator(`iframe[title="Poker table ${i+1}"]`));
 await Promise.all(frames.map(async(frame,i)=>{
  await frame.getByText('Locked deck and visible cards verified.',{exact:true}).waitFor();
  await frame.getByRole('button',{name:'Hand history & replay',exact:true}).click();
  const dialog=frame.getByRole('dialog');await dialog.getByRole('button',{name:/Hand #2/}).click();
  await dialog.getByText('Locked deck: '+tables[i].proofs[1].root,{exact:true}).waitFor({state:'attached'});
  await dialog.getByRole('button',{name:'Next step',exact:true}).click();await dialog.getByText('Step 2 of '+tables[i].proofs[1].steps.length,{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Play replay',exact:true}).click();await dialog.getByRole('button',{name:'Pause',exact:true}).click();
  await dialog.getByRole('slider',{name:'Replay step'}).fill(String(tables[i].proofs[1].lastStep));
  const proofs=JSON.parse(await dialog.locator('details pre').textContent());assert.deepEqual(proofs,tables[i].proofs[1].openings);
  await dialog.getByRole('button',{name:/Hand #1/}).click();await dialog.getByRole('button',{name:/Hand #3/}).click();
  await dialog.getByText('Locked deck: '+tables[i].proofs[2].root,{exact:true}).waitFor({state:'attached'});
 }));
 await new Promise(resolve=>setTimeout(resolve,800));
 for(let i=0;i<3;i++){
  const dialog=frames[i].getByRole('dialog');assert.deepEqual(JSON.parse(await dialog.locator('details pre').textContent()),tables[i].proofs[2].openings);
  assert.equal(await dialog.getByRole('alert').count(),0);
 }
 const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('imperial-poker-deck-v1:')&&!k.endsWith(':head')));
 for(const t of tables)assert.ok(keys.includes('imperial-poker-deck-v1:'+t.id+':2')&&keys.includes('imperial-poker-deck-v1:'+t.id+':3'));
 await page.screenshot({path:join(output,'three-tables-replay.png'),fullPage:true});
 await page.goto(origin+'/FairnessManifesto');
 await page.getByRole('heading',{name:'Your security and fair play are our #1 priority.'}).waitFor();
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.getByText('For players who want the technical details',{exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:join(output,'ssrcr-literature-'+width+'.png'),fullPage:true});
  await page.getByText('For players who want the technical details',{exact:true}).click();
 }
 assert.deepEqual(errors,[]);console.log('Browser QA images: '+output);console.log('PASS three concurrent iframe table views: separate cards, roots, histories, proof pins and playback; delayed old hand response rejected in every view. SSRCR literature rendered at desktop/mobile sizes without overflow.');
}finally{await browser?.close();await server?.close();for(const file of qaFiles)fs.rmSync(root+'/'+file,{force:true});}
