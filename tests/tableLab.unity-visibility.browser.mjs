// Actual bundled Unity WASM; synthetic document visibility, real elapsed time.
// This is not OS backgrounding or physical-device acceptance.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const origin=new URL(process.env.LAB_URL||'http://127.0.0.1:4191/practice-lab.html').origin;
try {
 for(const game of ['roulette','craps'])for(const auto of [false,true]) {
  console.log('START actual Unity',game,auto);
  const page=await browser.newPage({viewport:{width:640,height:480}});
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.addInitScript(()=>{window.practiceEvents=[];window.presented=[];addEventListener('message',e=>{
   if(e.origin!==location.origin)return;
   if(e.data?.channel==='imperial-practice-event')practiceEvents.push(e.data);
   if(e.data?.command==='PresentOutcome')presented.push(JSON.parse(e.data.value));
  });});
  page.setDefaultTimeout(30000);
  await page.goto(origin+'/practice-lab.html');await page.getByText('Unity ready',{exact:true}).waitFor({timeout:120000});
  console.log('READY actual Unity',game,auto);
  if(game==='craps')await page.getByRole('button',{name:'Craps',exact:true}).click();
  await page.getByLabel('Camera',{exact:true}).selectOption('overhead');
  await page.waitForFunction(g=>practiceEvents.some(e=>e.type==='layout'&&e.game===g),game);
  await page.locator('.action-stage').scrollIntoViewIfNeeded();await page.waitForTimeout(350);
  const frame=page.frames().find(f=>f.url().endsWith('/unity-practice-frame.html'));
  await frame.evaluate(selection=>parent.postMessage({channel:'imperial-practice-event',type:'bet',selection},location.origin),game==='craps'?'pass':'red');
  await page.getByRole('button',{name:/^(Spin|Roll dice) · 10 chips$/}).waitFor();
  const visibility=async hidden=>{for(const f of [page,frame])await f.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'));},hidden);};
  if(auto)await page.getByLabel('Automatic rounds').check();else await page.getByRole('button',{name:/^(Spin|Roll dice) · 10 chips$/}).click();
  await frame.waitForFunction(()=>presented.length===1);
  await page.waitForTimeout(800);await visibility(true);await page.waitForTimeout(250);
  const chips=await page.locator('.chip-balance strong').innerText();
  const motions=await page.evaluate(()=>practiceEvents.filter(e=>e.type==='motion').length);
  await page.waitForTimeout(35000);
  assert.equal(await page.locator('.round-history li').count(),0);
  assert.equal(await page.locator('.chip-balance strong').innerText(),chips);
  assert.equal(await frame.evaluate(()=>presented.length),1);
  assert.equal(await page.evaluate(()=>practiceEvents.filter(e=>e.type==='motion').length),motions,'actual Unity motion must pause');
  await visibility(false);await page.waitForFunction(()=>document.querySelectorAll('.round-history li').length===1,{},{timeout:35000});
  const completions=await page.evaluate(()=>practiceEvents.filter(e=>e.type==='complete'));
  assert.equal(completions.length,1,'actual Unity completion, not watchdog-only success');
  if(auto){
   await visibility(true);await page.waitForTimeout(3500);assert.equal(await frame.evaluate(()=>presented.length),1);
   await visibility(false);await page.waitForTimeout(700);assert.equal(await frame.evaluate(()=>presented.length),1);
   await frame.waitForFunction(()=>presented.length===2);await page.getByLabel('Automatic rounds').uncheck();
  }else{await page.waitForTimeout(1700);assert.equal(await frame.evaluate(()=>presented.length),1);}
  await page.close();console.log(`PASS actual Unity ${game} auto=${auto}: 35s synthetic hidden state pauses motion/settlement; actual completion resumes once; no hidden restart`);
 }
}finally{await browser.close();}
