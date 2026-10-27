import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const id='11111111-1111-4111-8111-111111111111',user={id,email:'fixture@example.invalid',role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const base=process.env.LAB_URL||'http://127.0.0.1:4193';
const browser=await chromium.launch({headless:true,...(process.env.LAB_CHROME?{executablePath:process.env.LAB_CHROME}:{}),args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try{for(const game of ['roulette','craps']){
 const page=await browser.newPage({viewport:{width:412,height:915},hasTouch:true}),requests=[],errors=[];
 let autoReady=false;let state={game,revision:1,round:1,point:0,joined:true,chips:1000,betsOpen:true,bettingClosesAt:new Date(Date.now()+120000).toISOString(),serverTime:new Date().toISOString(),shooterId:id,players:[{id,shooter:true,active:true}],myBets:[],publicBets:[],myRecent:[],lastResult:null};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(user=>{window.mpEvents=[];window.mpCommands=[];addEventListener('message',e=>{if(e.data?.channel==='imperial-practice-event')window.mpEvents.push(e.data);if(e.data?.channel==='imperial-practice-command')window.mpCommands.push(e.data);});localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify({access_token:'e30.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}))+'.fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user}));},user);
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin===new URL(base).origin)return route.continue();if(u.hostname!=='qonqemhljgxlwpghkxhn.supabase.co')return route.abort();let data=[];
  if(u.pathname.includes('/auth/'))data=user;else if(u.pathname.includes('user_roles'))data=[{role:'player'}];else if(u.pathname.includes('profiles'))data=[{id,is_excluded:false}];else if(u.pathname.includes('wallets'))data=[{user_id:id,cent_balance:100,igt_balance:100}];
  else if(u.pathname.includes('ig-multiplayer-practice')){
   const b=route.request().postDataJSON();requests.push(b);
   if(b.action==='bet'){assert.equal(b.target,game==='craps'?'pass':'red');assert.equal(b.units,5);state={...state,revision:2,chips:995,betsOpen:false,bettingClosesAt:new Date(0).toISOString(),publicBets:[{target:b.target,units:5,count:1}],myBets:[{id:'bet-1',target:b.target,units:5,placedRound:1}]};}
   if(b.action==='spin')throw Error('Client must not spin the house wheel');
   if(b.action==='roll'||(game==='roulette'&&b.action==='state'&&autoReady)){if(game==='craps')assert.equal(b.expectedRound,1);autoReady=false;state={...state,revision:3,round:2,point:game==='craps'?6:0,chips:game==='craps'?995:1005,betsOpen:true,bettingClosesAt:new Date(Date.now()+120000).toISOString(),lastResult:game==='craps'?{game,round:1,dice:[2,4],total:6,pointAfter:6}:{game,round:1,number:3,color:'red'},publicBets:game==='craps'?state.publicBets:[],myBets:game==='craps'?state.myBets:[]};}
   data={state:{...state,serverTime:new Date().toISOString()}};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(base+'/Play'+(game==='craps'?'Craps':'Roulette'));
 await page.getByText(/Unity ready · Shared server round/).waitFor({timeout:120000});
 await page.getByLabel('Shared table camera',{exact:true}).selectOption('overhead');
 await page.getByRole('button',{name:'Expand table',exact:true}).click();assert.equal(await page.locator('.ig-unity-expanded').count(),1);await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
 await page.locator('iframe.table-scene').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 const selection=game==='craps'?'pass':'red';
 await page.waitForFunction(g=>window.mpEvents.some(e=>e.type==='layout'&&e.game===g),game);
 const p=await page.evaluate(({game,selection})=>window.mpEvents.filter(e=>e.type==='layout'&&e.game===game).at(-1).spots.find(s=>s.selection===selection),{game,selection}),rect=await page.locator('iframe.table-scene').boundingBox();
 for(const button of ['right','middle'])await page.mouse.click(rect.x+p.x*rect.width,rect.y+(1-p.y)*rect.height,{button});
 await page.waitForTimeout(300);
 assert.equal(requests.filter(r=>r.action==='bet').length,0,'secondary mouse buttons must not request a wager');
 assert.equal(await page.evaluate(()=>window.mpEvents.filter(e=>e.type==='bet').length),0,'secondary buttons must not emit a bet');
 await page.touchscreen.tap(rect.x+p.x*rect.width,rect.y+(1-p.y)*rect.height);
 await page.getByText('Wager confirmed by server.',{exact:true}).waitFor();
 await page.waitForFunction(()=>window.mpEvents.some(e=>e.type==='betPlacement'&&e.amount===5));
 // Advance the controlled house clock only after observing the confirmed wager,
 // so a racing state poll cannot skip this assertion by already settling it.
 if(game==='roulette')autoReady=true;
 if(game==='craps')await page.getByRole('button',{name:'SHOOT THE DICE',exact:true}).click();else assert.equal(await page.getByRole('button',{name:'SPIN THE WHEEL',exact:true}).count(),0);
 await page.locator('iframe.table-scene').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.mpEvents.some(e=>e.type==='complete'),{},{timeout:45000});
 const frame=page.frames().find(f=>f.url().includes('unity-practice-frame'));const commands=await frame.evaluate(()=>window.mpCommands.filter(c=>c.command==='PresentOutcome').map(c=>JSON.parse(c.value)));
 assert.equal(commands.length,1);assert.deepEqual(commands[0].values,game==='craps'?[2,4]:[3]);
 await page.getByRole('button',{name:'Refresh table',exact:true}).click();await page.waitForTimeout(1000);
 assert.equal(await frame.evaluate(()=>window.mpCommands.filter(c=>c.command==='PresentOutcome').length),1);
 assert.equal(requests.filter(r=>r.action==='bet').length,1);assert.equal(requests.filter(r=>['spin','roll'].includes(r.action)).length,game==='craps'?1:0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.getByLabel('Table renderer',{exact:true}).selectOption('felt');assert.equal(await page.locator(game==='craps'?'.ig-craps-table':'.ig-roulette-board').count(),1);
 console.log(game+': server-confirmed native tap/markers, exact shared outcome, no duplicate bet/round on replay, 2D fallback PASS');await page.close();
}}finally{await browser.close();}
