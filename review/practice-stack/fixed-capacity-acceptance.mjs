import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Actual synthetic Auth/Edge/browser phase; no direct seat or outcome writes.
export async function fixedCapacityAcceptance({run,users,call,db,browser,record}) {
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1'||db.run!==run)throw Error('approved isolated run required');
 const players=users.filter(u=>u.kind.startsWith('player-'));assert.equal(players.length,9);
 const evidence=[];
 for(const capacity of [2,4,6,8,9]) {
  const owner=players[0],context=await browser.newContext();let tableId,snapshot,renderState,fallbackVerified=false,started=false;
  try {
   await context.route('**/*',r=>['http://127.0.0.1:4173','http://127.0.0.1:54321'].includes(new URL(r.request().url()).origin)?r.continue():r.abort());
   const page=await context.newPage();await page.goto('http://127.0.0.1:4173/login');
   await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(owner.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.pathname!=='/login');
   await page.goto('http://127.0.0.1:4173/PlayPoker');
   await page.getByRole('button',{name:capacity===2?'Heads up':`${capacity}-seat table`,exact:true}).click();
   const pending=page.waitForResponse(r=>{try{return r.request().method()==='POST'&&r.url()==='http://127.0.0.1:54321/functions/v1/poker-table-v1'&&r.request().postDataJSON().action==='create';}catch{return false;}});void pending.catch(()=>{});
   await page.getByRole('button',{name:`Create ${capacity}-seat Hold’em table`,exact:true}).click();
   const response=await pending;assert.equal(response.status(),200);assert.equal(response.request().postDataJSON().seatCapacity,capacity);
   const created=await response.json();tableId=created.tableId;assert.match(tableId,/^[a-f0-9-]{36}$/i);assert.equal(created.seatCapacity,capacity);
   await page.waitForURL(u=>u.pathname==='/PlayPoker'&&u.searchParams.get('tableId')===tableId);
   for(const u of players.slice(1,capacity))await call(u,'poker-table-v1',{action:'join',tableId});
   snapshot=await call(owner,'poker-table-v1',{action:'snapshot',tableId});
   assert.equal(snapshot.table.seatCapacity,capacity);assert.equal(snapshot.seats.length,capacity);
   assert.deepEqual(snapshot.seats.map(s=>s.seat_no).sort((a,b)=>a-b),Array.from({length:capacity},(_,i)=>i));
   await page.getByRole('button',{name:'Refresh',exact:true}).click();
   await page.waitForFunction(n=>document.querySelectorAll('button.ig-poker-seat').length===n,capacity);
   const scene=page.locator('[data-renderstate]');await scene.waitFor();
   await page.waitForFunction(()=>['ready','fallback'].includes(document.querySelector('[data-renderstate]')?.dataset.renderstate),null,{timeout:30000});
   renderState=await scene.getAttribute('data-renderstate');assert.equal(await page.locator('.ig-poker-seat').count(),capacity);
   assert.equal(await page.locator('.ig-poker-hole-center').count(),0,'no empty private-card panel before deal');
   const frame=await scene.boundingBox();assert.ok(frame?.width>100&&frame.height>100);
   const shot=name=>page.screenshot({path:new URL(`../../../approved-runtime-evidence/${run}/${name}.png`,import.meta.url).pathname,fullPage:true});
   await shot(`format-${capacity}`);
   await page.setViewportSize({width:390,height:844});
   const boxes=await page.locator('.ig-poker-seat').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();const s=getComputedStyle(n);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,transform:s.transform,translate:s.translate,transitionProperty:s.transitionProperty};}));
   await page.evaluate(()=>window.scrollTo(0,0));
   await shot(`format-${capacity}-mobile`);record('format-'+capacity+'-mobile-layout',{boxes,viewport:390,document:await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,containers:[...document.querySelectorAll('.ig-poker-screen,.ig-poker-shell,.ig-poker-live,.ig-poker-table-area,.ig-poker-seat-ring')].map(n=>({className:n.className,width:n.getBoundingClientRect().width,left:n.getBoundingClientRect().left,display:getComputedStyle(n).display}))}))});
   const visual=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};return {wallet:rect('[aria-label="Player wallet toolbar"]'),header:rect('.ig-poker-header'),board:rect('.ig-poker-board-center'),model:rect('.ig-approved-model')};});
   assert.ok(visual.wallet.bottom<=visual.header.top,'wallet toolbar must not cover poker header');assert.ok(visual.board.bottom<=visual.model.top,'cards must not obscure approved model');assert.ok(visual.model.height>=180&&visual.model.height<=300,'bounded phone model viewport');record('format-'+capacity+'-mobile-visual',visual);
   assert.equal(boxes.length,capacity);for(const [i,a]of boxes.entries()){assert.ok(a.left>=0&&a.right<=390);for(const b of boxes.slice(i+1))assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'mobile seats must not overlap');}
   if(capacity===9){for(const width of [360,430]){await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0));await shot(`format-9-mobile-${width}`);const sizes=await page.locator('.ig-poker-seat').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));for(const [i,a]of sizes.entries()){assert.ok(a.left>=0&&a.right<=width);for(const b of sizes.slice(i+1))assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);}record('format-9-width-'+width,{width,boxes:sizes});}await page.setViewportSize({width:390,height:844});}
   await shot(`format-${capacity}-mobile`);await page.getByRole('heading',{name:'Table controls',exact:true}).scrollIntoViewIfNeeded();
   if(capacity===2){
    await page.route('**/poker-tables/*.glb',r=>r.abort());await page.reload();
    await page.waitForFunction(()=>document.querySelector('[data-renderstate]')?.dataset.renderstate==='fallback',null,{timeout:30000});
    assert.equal(await page.locator('.ig-poker-seat').count(),capacity);await shot('format-2-model-fallback');fallbackVerified=true;
   }
   if(capacity===9){await call(owner,'poker-table-v1',{action:'start',tableId});started=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ig-hole-card').length===2);await page.evaluate(()=>window.scrollTo(0,0));await shot('format-9-mobile-playing');record('format-9-live-private-cards',{ownCards:await page.locator('.ig-hole-card').count(),capacity:9,actualDeal:true,clientSnapshotAccepted:true});}
  } finally {await context.close();}
  if(!started)await call(owner,'poker-table-v1',{action:'start',tableId});snapshot=await call(owner,'poker-table-v1',{action:'snapshot',tableId});
  assert.equal(snapshot.deckProof.dealAssignments.length,capacity);let folded=0;
  while(snapshot.table.status==='playing'&&folded<capacity) {
   const actor=players.find(u=>snapshot.seats.some(s=>s.user_id===u.id&&s.seat_no===snapshot.table.turnIndex));assert.ok(actor);
   const body={action:'act',tableId,actionId:randomUUID(),version:snapshot.table.version,move:'fold',amount:0};
   await call(actor,'poker-table-v1',body);await call(actor,'poker-table-v1',body);snapshot=await call(owner,'poker-table-v1',{action:'snapshot',tableId});folded++;
  }
  assert.equal(snapshot.table.status,'complete');assert.equal(snapshot.seats.reduce((n,s)=>n+Number(s.stack)+Number(s.committed),0),capacity*1000);
  const result={capacity,occupants:capacity,renderState,actualHttp:true,browserSelectedCreate:true,mobileRosterNoOverlap:true,mobileModelUnobscured:true,mobileWalletNoOverlap:true,liveNinePrivateCardsVerified:capacity===9,modelFallbackVerified:fallbackVerified,dealAssignments:capacity,completed:true,chipTotal:capacity*1000};evidence.push(result);record('format-'+capacity,result);
 }
 for(const seatCapacity of [1,3,5,7,10])await call(players[0],'poker-table-v1',{action:'create',variant:'holdem',seatCapacity},400);
 return {formats:evidence,configuredSevenRejected:true,visualReviewPending:true};
}
