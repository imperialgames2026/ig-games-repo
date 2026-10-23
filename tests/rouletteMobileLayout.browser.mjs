// Render the real roulette felt with production CSS and tall controls, reproducing
// the phone layout without needing an authenticated multiplayer server session.
import fs from 'node:fs';
import {parse} from '@babel/parser';
import {transform} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const source=fs.readFileSync('components/games/MultiplayerPracticeTable.jsx','utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const functions=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&['rouletteColor','RouletteFelt','BetZone'].includes(n.id.name)).map(n=>source.slice(n.start,n.end));
const code=(await transform(functions.join('\n'),{loader:'jsx',jsxFactory:'React.createElement'})).code;
const Felt=new Function('React','REDS','chip',code+';return RouletteFelt;')(React,new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),String);
const felt=renderToStaticMarkup(React.createElement(Felt,{table:{publicBets:[],round:1},choose:()=>{},canBet:true}));
const css=fs.readdirSync('dist/assets').filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync('dist/assets/'+n,'utf8')).join('\n');
const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><main class="ig-game-screen ig-mp-screen"><div class="ig-cockpit-shell"><div class="ig-cockpit-topbar">All games</div><div class="ig-cockpit-status">Bets open</div><div class="ig-cockpit-grid"><div class="ig-cockpit-main">'+felt+'<section class="ig-round-controls" style="height:420px">Wager / Spin / Leave / Refresh</section></div><aside class="ig-cockpit-rail">Practice bets</aside></div></div></main>';
const browser=await chromium.launch({headless:true,...(process.env.LAB_CHROME?{executablePath:process.env.LAB_CHROME}:{}),args:['--no-sandbox']});
try{
 for(const viewport of [{width:412,height:915},{width:915,height:412}]){
  const page=await browser.newPage({viewport});await page.setContent(html);
  const sizes=await page.evaluate(()=>{
   const felt=document.querySelector('.ig-table-stage').getBoundingClientRect(),board=document.querySelector('.ig-roulette-board-wrap').getBoundingClientRect(),controls=document.querySelector('.ig-round-controls').getBoundingClientRect();
   return {felt:felt.height,board:board.height,controlsTop:controls.top,feltBottom:felt.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.ok(sizes.felt>=420,JSON.stringify(sizes));assert.ok(sizes.board>=240);assert.ok(sizes.controlsTop>=sizes.feltBottom);assert.equal(sizes.overflow,false);
  console.log(JSON.stringify({viewport,...sizes,status:'passed'}));await page.close();
 }
}finally{await browser.close();}
