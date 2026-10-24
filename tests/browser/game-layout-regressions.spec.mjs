import {test, expect} from '@playwright/test';
const id='11111111-1111-4111-8111-111111111111';const user={id,email:'fixture@example.invalid',role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
for(const width of [412,915])for(const game of ['Craps','Roulette','Poker','Omaha']) test(`${game} controls remain usable at ${width}px`,async({browser})=>{const height=width===412?915:412;const untrustedAvatarRequests=[];const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
await page.addInitScript(user=>{localStorage.setItem('ig-poker-settings-v1',JSON.stringify({tableColor:'purple',cardBack:3,gameSound:false,actionVoice:'None'}));localStorage.setItem('sb-qonqemhljgxlwpghkxhn-auth-token',JSON.stringify({access_token:'e30.'+btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}))+'.fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user}));},user);
await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin==='http://127.0.0.1:4180')return r.continue();if(u.hostname!=='qonqemhljgxlwpghkxhn.supabase.co'){if(u.hostname==='avatar-fixture.example.invalid')untrustedAvatarRequests.push(u.href);return r.abort();}let data=[];const p=u.pathname;
if(p.includes('/auth/'))data=user;else if(p.includes('user_roles'))data=[{role:'player'}];else if(p.includes('profiles'))data=[{id,is_excluded:false}];else if(p.includes('wallets'))data=[{user_id:id,cent_balance:100,igt_balance:100}];else if(p.includes('ig-multiplayer-practice'))data={state:{game:game.toLowerCase(),revision:1,round:1,joined:true,chips:1000,betsOpen:true,bettingClosesAt:new Date(Date.now()+60000).toISOString(),serverTime:new Date().toISOString(),players:[],myBets:[],publicBets:[],history:[]}};else if(p.includes('poker-table-v1')&&r.request().postDataJSON()?.action==='playerStats')data={currentSession:{hands:12},career:{hands:42,wtsd:25,wsd:60}};else if(p.includes('poker-table-v1'))data={table:{variant:game==='Omaha'?'omaha':'holdem',status:'playing',turnIndex:0,currentBet:20,handNo:1,version:1,board:['A♠','K♥','2♦']},seats:Array.from({length:game==='Omaha'?6:8},(_,i)=>({seat_no:i,user_id:i===0?id:'fixture-'+i,displayName:'Fixture '+i,avatarUrl:'https://avatar-fixture.example.invalid/avatar.png',stack:1000,committed:20,street_bet:0})),holeCards:game==='Omaha'?['Q♠','J♠','3♦','4♣']:['Q♠','J♠']};await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
await page.goto('http://127.0.0.1:4180/Play'+game+(['Poker','Omaha'].includes(game)?'?tableId=22222222-2222-4222-8222-222222222222':''));await page.waitForTimeout(1000);
const measure=()=>page.evaluate(game=>{const box=s=>{const e=document.querySelector(s);return e?{...e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display}:null};return{url:location.pathname,invite:box('.ig-poker-invite'),hole:box('.ig-poker-hole-center'),bottomSeat:box(game==='Omaha'?'.ig-poker-seat:nth-child(4)':'.ig-poker-seat:nth-child(5)'),screen:box('.ig-game-screen'),grid:box('.ig-cockpit-grid'),rows:document.querySelector('.ig-cockpit-shell')?getComputedStyle(document.querySelector('.ig-cockpit-shell')).gridTemplateRows:null,notices:[...document.querySelectorAll('[role=status]')].map(e=>e.textContent),roulette:[...document.querySelectorAll('.ig-roulette-number-grid button')].slice(0,3).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}},game);
if(['Craps','Roulette'].includes(game))await page.getByLabel('Table renderer',{exact:true}).selectOption('felt');
const result={width,game,before:await measure()};if(game==='Craps'){const c=page.getByRole('button',{name:'Drag 10 practice chip onto craps table or tap to select',exact:true});await c.scrollIntoViewIfNeeded();const b=await c.boundingBox();if(b){await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(3,70,{steps:12});await page.mouse.up();await page.waitForTimeout(150);}result.after=await measure();}
if(['Poker','Omaha'].includes(game)) {
 expect(result.before.invite.display).not.toBe('none');
 const a=result.before.hole,b=result.before.bottomSeat;
 expect(Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))).toBe(0);
 const trigger=page.locator('.ig-poker-seat').first();await trigger.click();
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('Hands this table',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Career',exact:true}).click();await expect(page.getByText('Verified career hands',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Showdown',exact:true}).click();await expect(page.getByText('60.0%',{exact:true})).toBeVisible();expect(untrustedAvatarRequests).toEqual([]);
 expect(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]'))).toBe(true);
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]'))).toBe(true);}
 await expect(page.getByLabel('Player Actions',{exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
 const opponent=page.locator('.ig-poker-seat').nth(1);await opponent.click();await expect(page.getByLabel('Player Actions',{exact:true})).toBeEnabled();await page.getByLabel('Player Actions',{exact:true}).selectOption('cheers');await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();await page.keyboard.press('Escape');await expect(opponent).toBeFocused();
 await expect(page.locator('.ig-poker-felt-shell')).toHaveCSS('background-color','rgb(74, 32, 128)');
 await expect(page.locator('.ig-board-card').last()).toHaveText('💎');
 await page.getByRole('button',{name:'⚙ Table',exact:true}).click();await expect(page.getByText('Table Color',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ig-poker-settings-v1')).gameSound)).toBe(false);
} else if(game==='Roulette') {
 expect(result.before.roulette.length).toBeGreaterThan(0);
 for(const c of result.before.roulette){expect(c.w).toBeGreaterThanOrEqual(44);expect(c.h).toBeGreaterThanOrEqual(44);}
 const wrap=page.locator('.ig-roulette-board-wrap');
 expect(await wrap.evaluate(e=>{e.scrollLeft=200;return e.scrollLeft})).toBeGreaterThan(0);
} else {
 const notice=page.getByText('Chip not placed. Drop it onto an available betting area.',{exact:true});await expect(notice).toBeVisible();
 const n=await notice.boundingBox();expect(n.height).toBeGreaterThan(0);expect(n.y+n.height).toBeLessThanOrEqual(result.after.grid.top+1);
 expect(result.after.grid.bottom).toBeLessThanOrEqual(result.after.screen.bottom+1);
}
await page.close();
});
