import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),output=fs.mkdtempSync(join(tmpdir(),'ig-table-fairness-')),fixture=join(output,'fixtures.json');
execFileSync(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run','tests/table-fairness.test.js'],{cwd:root,env:{...process.env,IG_FAIRNESS_FIXTURE_PATH:fixture},stdio:'inherit',timeout:90000});
const fixtures=JSON.parse(fs.readFileSync(fixture,'utf8'));
const mock=`const fixtures=${JSON.stringify(fixtures)};
export const supabase={channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:async()=>{},functions:{invoke:async(name,{body})=>{
 const game=name==='ig-blackjack-practice'?'blackjack':body.game;const f=fixtures[game];if(!f)return {error:Error('Unexpected game')};
 const state=structuredClone(window.__qaPhase==='ended'||window.__qaPhase==='bad'?f.ended:f.committed);
 if(window.__qaPhase==='bad')state.fairnessHistory[0].serverSeed='00'.repeat(32);
 return {data:{state}};
}}};export const requireSupabase=()=>supabase;`;
const files=['qa-table-fairness.html','qa-table-fairness.jsx'];for(const f of files)assert.equal(fs.existsSync(join(root,f)),false);
fs.writeFileSync(join(root,files[0]),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/qa-table-fairness.jsx"></script></body></html>');
fs.writeFileSync(join(root,files[1]),`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Blackjack from './components/games/BlackjackPracticeTable';import Shared from './components/games/SharedEventPracticeTable';import Multiplayer from './components/games/MultiplayerPracticeTable';import './index.css';const game=new URLSearchParams(location.search).get('game');createRoot(document.getElementById('root')).render(<BrowserRouter>{game==='blackjack'?<Blackjack/>:game==='baccarat'?<Shared mode="baccarat"/>:<Multiplayer game={game}/>}</BrowserRouter>);`);
let server,browser;
try{
 server=await createServer({root,configFile:join(root,'vite.config.js'),plugins:[{name:'qa-table-fairness',enforce:'pre',transform(code,id){if(id.endsWith('/lib/supabaseClient.js'))return mock;if(id.endsWith('/lib/AuthContext.jsx'))return `export const useAuth=()=>({user:{id:${JSON.stringify(fixtures.blackjack.committed.players[0].id)},role:'player',is_excluded:false},isAuthenticated:true});`;}}],server:{host:'127.0.0.1',port:54674,strictPort:false}});await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 const errors=[];
 for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(sessionStorage.getItem('qa-ended'))window.__qaPhase='ended';});
  for(const game of ['blackjack','baccarat','craps','roulette']){
   await page.goto(origin+'/qa-table-fairness.html?game='+game);
   await page.getByText('Current round #'+fixtures[game].committed.round+' commitment:',{exact:false}).waitFor();
   if(game==='craps'||game==='roulette')await page.getByLabel('Table renderer',{exact:true}).selectOption('felt');
   await page.evaluate(()=>window.__qaPhase='ended');await page.getByRole('button',{name:/^Refresh(?: table)?$/,exact:true}).click();
   const verify=page.getByRole('button',{name:'Verify selected round',exact:true});await verify.waitFor();await verify.click();
   await page.getByRole('status').filter({hasText:'saved pre-deal commitment and reconstructed outcome match'}).waitFor();
   await page.evaluate(()=>sessionStorage.setItem('qa-ended','yes'));await page.reload({waitUntil:'domcontentloaded'});
   if(game==='craps'||game==='roulette')await page.getByLabel('Table renderer',{exact:true}).selectOption('felt');
   await page.getByRole('button',{name:'Verify selected round',exact:true}).click();await page.getByRole('status').filter({hasText:'saved pre-deal commitment and reconstructed outcome match'}).waitFor();
   await page.evaluate(()=>window.__qaPhase='bad');await page.getByRole('button',{name:/^Refresh(?: table)?$/,exact:true}).click();await page.getByRole('alert').filter({hasText:/proof mismatch|commitment changed/}).waitFor();
   await page.evaluate(()=>{sessionStorage.removeItem('qa-ended');window.__qaPhase=undefined;});
   console.log('PASS browser '+game+' '+viewport.width+'px: saved commitment, verification, reload, tampered-proof rejection');
  }
  await context.close();
 }
 const context=await browser.newContext();await context.addInitScript(()=>window.__qaPhase='ended');const page=await context.newPage();await page.goto(origin+'/qa-table-fairness.html?game=roulette');await page.getByRole('button',{name:'Verify selected round',exact:true}).click();await page.getByRole('status').filter({hasText:'did not save a pre-deal commitment'}).waitFor();await context.close();
 assert.deepEqual(errors,[]);console.log('PASS unwitnessed history is labeled honestly; no browser runtime errors');
}finally{await browser?.close();await server?.close();for(const f of files)fs.rmSync(join(root,f),{force:true});fs.rmSync(output,{recursive:true,force:true});}
