// Synthetic iframe and visibility: no Unity binary, backend or device.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 for(const game of ['roulette','craps'])for(const auto of [false,true]){
  const page=await browser.newPage();
  const origin=new URL(process.env.LAB_URL||'http://127.0.0.1:4191/practice-lab.html').origin;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/unity-practice-frame.html')return route.fulfill({contentType:'text/html',body:`<script>
    window.outcomes=[];addEventListener('message',e=>{if(e.origin!==location.origin)return;
    if(e.data.command==='Hello')parent.postMessage({channel:'imperial-practice-event',type:'ready'},location.origin);
    if(e.data.command==='PresentOutcome')outcomes.push(JSON.parse(e.data.value));});
   </script>`});
   return route.continue();
  });
  await page.goto(origin+'/practice-lab.html');await page.getByText('Unity ready',{exact:true}).waitFor();
  if(game==='craps')await page.getByRole('button',{name:'Craps',exact:true}).click();
  const frame=page.frames().find(f=>f.url().endsWith('/unity-practice-frame.html'));
  await frame.evaluate(selection=>parent.postMessage({channel:'imperial-practice-event',type:'bet',selection},location.origin),game==='craps'?'pass':'red');
  await page.getByRole('button',{name:/^(Spin|Roll dice) · 10 chips$/}).waitFor();
  await page.clock.install();
  const visibility=async hidden=>page.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'));},hidden);
  if(auto){await page.getByLabel('Automatic rounds').check();await page.clock.runFor(1400);}else await page.getByRole('button',{name:/^(Spin|Roll dice) · 10 chips$/}).click();
  await page.waitForFunction(()=>document.querySelector('.action-dock button.action').disabled);
  const balance=await page.locator('.chip-balance strong').innerText();
  await visibility(true);await page.clock.runFor(60000);
  assert.equal(await page.locator('.round-history li').count(),0,`${game} auto=${auto}: hidden round settled`);
  assert.equal(await page.locator('.chip-balance strong').innerText(),balance);
  assert.equal(await frame.evaluate(()=>outcomes.length),1,'no unseen restart');
  await frame.evaluate(()=>parent.postMessage({channel:'imperial-practice-event',type:'complete',roundId:outcomes[0].roundId},location.origin));
  assert.equal(await page.locator('.round-history li').count(),0,'hidden completion deferred');
  await visibility(false);await page.waitForFunction(()=>document.querySelectorAll('.round-history li').length===1);
  if(auto){
   await page.clock.runFor(1000);await visibility(true);await page.clock.runFor(35000);await visibility(false);
   await page.clock.runFor(1399);assert.equal(await frame.evaluate(()=>outcomes.length),1);
   await page.clock.runFor(1);await page.waitForFunction(()=>document.querySelector('.action-dock button.action').disabled);
   assert.equal(await frame.evaluate(()=>outcomes.length),2);
  }else{await page.clock.runFor(60000);assert.equal(await frame.evaluate(()=>outcomes.length),1);}
  await page.close();console.log(`PASS synthetic browser ${game} auto=${auto}: hidden balance/history preserved, deferred completion, no catch-up`);
 }
} finally {await browser.close();}
