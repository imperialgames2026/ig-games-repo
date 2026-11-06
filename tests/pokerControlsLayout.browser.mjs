import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {createGame, playerView, applyGame} from '../supabase/functions/pvp-games-review/runtime/engine.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.POKER_LAYOUT_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'ig-poker-controls-'));
fs.mkdirSync(output,{recursive:true});
const games=['poker2','poker4','poker6','poker8','poker9','omaha2','omaha4','omaha6','omaha8','omaha9','draw5','triple27'];
const states={},snapshots={};
for(const game of games){
  const state=createGame(game,1),seats=Array.from({length:state.players},(_,i)=>'synthetic-'+i);
  const room={id:'layout-'+game,game,state,seats,names:{},owner:seats[0],version:1};
  const viewerId=seats[state.turn];
  states[game]=state;
  snapshots[game]={roomId:room.id,viewerId,revision:1,view:playerView(room,viewerId)};
}
const files=['qa-poker-controls.html','qa-poker-controls.jsx'];
for(const file of files)assert.equal(fs.existsSync(path.join(root,file)),false);
let server,browser;
const checks=[],errors=[];
try{
  fs.writeFileSync(path.join(root,files[0]),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/qa-poker-controls.jsx"></script></body></html>');
  fs.writeFileSync(path.join(root,files[1]),`
import React from 'react';import{createRoot}from'react-dom/client';
import {gameView} from './review/pvp-runtime/dist/view.js';import style from './review/pvp-runtime/game-style.mjs';import './index.css';
function Controls({snapshot,context}){const root=React.useRef(null);React.useLayoutEffect(()=>{const ui={cards:new Set(),rack:new Set(),draft:[],busy:false};root.current.replaceChildren(gameView(snapshot.view,ui,a=>window.sentActions.push(a),()=>{}));},[snapshot]);return <section className={'ig-pvp-game '+(context==='standalone'?'poker-room':'')}><style>{style}</style><div ref={root}/></section>;}
const fixtures=${JSON.stringify(snapshots)};
window.renderPoker=(game,context,units='chips')=>{
 localStorage.setItem('imperial-poker-table-options',JSON.stringify({units}));window.sentActions=[];
 const snapshot=fixtures[game];
 window.pokerRoot??=createRoot(document.getElementById('root'));
 window.pokerRoot.render(<main data-pvp-room data-layout={game+context+units} className={'mx-auto w-full min-w-0 max-w-6xl p-4 '+(context==='standalone'?'poker-room':'')}>
 <Controls key={game+context+units} snapshot={snapshot} context={context}/></main>);
};`);
  server=await createServer({root,server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const origin=server.resolvedUrls.local[0];
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(origin).origin?route.continue():route.abort());
  await page.goto(origin+files[0]);
  await page.waitForFunction(()=>typeof window.renderPoker==='function');
  for(const context of ['private','standalone'])for(const game of games)for(const width of [320,360,390,430,1280]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(({game,context})=>window.renderPoker(game,context),{game,context});
    await page.waitForFunction(key=>document.querySelector('main')?.dataset.layout===key,game+context+'chips');
    const amount=page.getByRole('spinbutton',{name:'Raise to total chips',exact:true});
    await amount.waitFor();
    const geometry=await page.locator('.poker-raise-adjust').evaluate(row=>{
      const bounds=row.getBoundingClientRect();
      return {row:bounds.toJSON(),controls:[...row.children].map(n=>({tag:n.tagName,label:n.getAttribute('aria-label')||n.textContent,rect:n.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(n).minWidth,display:getComputedStyle(row).display}))};
    });
    checks.push({game,context,width,...geometry});
    for(const c of geometry.controls){
      assert.ok(c.rect.left>=geometry.row.left-.5&&c.rect.right<=geometry.row.right+.5,`${context} ${game} ${width}: ${c.label} exceeds row: ${JSON.stringify(geometry)}`);
      assert.ok(c.rect.left>=0&&c.rect.right<=width,`${context} ${game} ${width}: ${c.label} exceeds viewport`);
    }
    for(const c of geometry.controls){
      assert.ok(c.rect.width>=44&&c.rect.height>=44,`${context} ${game} ${width}: ${c.label} below 44px target`);
    }
    assert.ok(await amount.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=16),'amount text must be legible');
    const minimum=Number(await amount.getAttribute('min'));
    await amount.fill(String(minimum+1));
    await page.locator('.poker-raise-adjust button').last().click();
    assert.equal(Number(await amount.inputValue()),minimum+2);
    await page.locator('.poker-raise-adjust button').first().click();
    assert.equal(Number(await amount.inputValue()),minimum+1);
    await page.getByRole('slider',{name:'Bet or raise amount',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(Number(await amount.inputValue()),minimum+2);
    await page.locator('.poker-decision-buttons button').last().click();
    const actions=await page.evaluate(()=>window.sentActions);
    assert.deepEqual(actions,[{type:'raise',to:minimum+2}]);
    assert.doesNotThrow(()=>applyGame(game,states[game],{...actions[0],player:states[game].turn}));
    if(game==='poker8'&&[320,390,1280].includes(width))await page.screenshot({path:path.join(output,`${context}-${game}-${width}.png`),fullPage:true});
  }
  // BB mode uses the same number input, with amounts scaled back to table chips.
  await page.evaluate(()=>window.renderPoker('omaha8','private','bb'));
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.layout==='omaha8privatebb');
  const bb=page.getByRole('spinbutton',{name:'Raise to total BB',exact:true});await bb.waitFor();
  const bbMin=Number(await bb.getAttribute('min'));await bb.fill(String(bbMin+1));
  await page.locator('.poker-decision-buttons button').last().click();
  assert.deepEqual(await page.evaluate(()=>window.sentActions),[{type:'raise',to:(bbMin+1)*states.omaha8.bigBlind}]);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${checks.length} game/context/width combinations: contained controls, 44px targets, readable amount, number/step/slider interaction and legal raise; BB scaling; zero page errors. Evidence: ${output}`);
}finally{
  fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify({checks,errors},null,2));
  await browser?.close();await server?.close();
  for(const file of files)fs.rmSync(path.join(root,file),{force:true});
}
