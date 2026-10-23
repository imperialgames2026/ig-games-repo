import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
export async function checkTables(renderer){
 const browser=await chromium.launch({headless:true,...(process.env.LAB_CHROME?{executablePath:process.env.LAB_CHROME}:{}),args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.practiceEvents=[];addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.channel==='imperial-practice-event')window.practiceEvents.push(e.data);});});
  await page.goto(process.env.LAB_URL||'http://127.0.0.1:4191/practice-lab.html');
  if(renderer==='web')await page.getByLabel('Renderer',{exact:true}).selectOption('web');else await page.getByText('Unity ready',{exact:true}).waitFor({timeout:120000});
  await page.getByLabel('Camera',{exact:true}).selectOption('overhead');
  async function tap(game,selection){
   await page.waitForFunction(g=>window.practiceEvents.some(e=>e.type==='layout'&&e.game===g),game);
   await page.locator('.action-stage').scrollIntoViewIfNeeded();await page.waitForTimeout(350);
   const p=await page.evaluate(({game,selection})=>window.practiceEvents.filter(e=>e.type==='layout'&&e.game===game).at(-1).spots.find(p=>p.selection===selection),{game,selection});
   const surface=page.locator(renderer==='unity'?'iframe.table-scene':'.table-scene canvas'),rect=await surface.boundingBox();
   assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1,JSON.stringify(p));await page.mouse.click(rect.x+p.x*rect.width,rect.y+(1-p.y)*rect.height);
  }
  await page.getByLabel('Wager amount',{exact:true}).fill('125');await tap('roulette','red');
  await page.waitForFunction(()=>document.querySelector('.chip-balance strong').textContent==='875');
  await page.getByLabel('Wager amount',{exact:true}).fill('25');await tap('roulette','0');
  await page.waitForFunction(()=>document.querySelector('.chip-balance strong').textContent==='850');
  await page.getByRole('button',{name:'Back / Undo',exact:true}).click();assert.equal(await page.locator('.chip-balance strong').innerText(),'875');
  await page.getByLabel('Wager amount',{exact:true}).fill('10');await tap('roulette','black');
  await page.getByRole('button',{name:'Spin · 135 chips',exact:true}).click();
  await page.waitForTimeout(1200);await page.locator('.action-stage').screenshot({path:`/tmp/${renderer}-wheel-moving.png`});
  await page.waitForFunction(()=>document.querySelectorAll('.round-history li').length===1);
  if(renderer==='unity'){
   await page.waitForFunction(()=>window.practiceEvents.filter(e=>e.type==='motion'&&e.game==='roulette').length>=3);
   const a=await page.evaluate(()=>window.practiceEvents.filter(e=>e.type==='motion'&&e.game==='roulette').map(e=>e.wheelAngle));assert.ok(new Set(a).size>=3);
   assert.ok(await page.evaluate(()=>window.practiceEvents.some(e=>e.type==='betPlacement'&&e.selection==='0'&&e.amount===25)));
  }
  assert.match(await page.getByLabel('Placed bets').innerText(),/red: 125/i);
  await page.getByRole('button',{name:'Clear bets',exact:true}).click();await page.getByRole('button',{name:'Craps',exact:true}).click();
  await tap('craps','pass');await page.getByRole('button',{name:'Roll dice · 10 chips',exact:true}).click();
  await page.waitForTimeout(1200);await page.locator('.action-stage').screenshot({path:`/tmp/${renderer}-dice-moving.png`});
  await page.waitForFunction(()=>document.querySelectorAll('.round-history li').length===2);
  if(renderer==='unity'){
   await page.waitForFunction(()=>window.practiceEvents.filter(e=>e.type==='motion'&&e.game==='craps').length>=3);
   const a=await page.evaluate(()=>window.practiceEvents.filter(e=>e.type==='motion'&&e.game==='craps').map(e=>e.diceX));assert.ok(new Set(a).size>=3);
  }
  await page.setViewportSize({width:412,height:915});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/tmp/${renderer}-table-mobile.png`,fullPage:true});assert.deepEqual(errors,[]);
  console.log(`${renderer}: native felt taps, exact amounts, multiple bets, green zero, undo, clear, recurring bets, wheel/dice action, mobile layout passed`);
 }finally{await browser.close();}
}
