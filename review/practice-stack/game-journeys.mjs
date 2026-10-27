import assert from 'node:assert/strict';
import {assertLocal} from './policy.mjs';
const games=[
 {route:'PlayPoker',slug:'poker-table-v1',poker:'holdem',join:'Join open seat',bet:'Fold',action:'act'},
 {route:'PlayOmaha',slug:'poker-table-v1',poker:'omaha',join:'Join open seat',bet:'Fold',action:'act'},
 {route:'PlayBlackjack',slug:'ig-blackjack-practice',join:'Sit at Blackjack table',bet:/MAIN HAND/,action:'bet'},
 {route:'PlayBaccarat',slug:'ig-shared-event-practice',join:'Join table',bet:/Place practice bet on Player/i,action:'bet'},
 {route:'PlayCraps',slug:'ig-multiplayer-practice',join:/Join as Shooter/,bet:/Place practice chips on FIELD/i,action:'bet'},
 {route:'PlayRoulette',slug:'ig-multiplayer-practice',join:'Join practice table',bet:/Place practice chips on Red/i,action:'bet'},
 {route:'PlayCrash',slug:'ig-crash-v2',join:'Join practice table',bet:'Place practice bet',action:'bet'},
 {route:'PlayTrenball',slug:'ig-crash-v2',join:'Join practice table',bet:'Place practice bet',action:'bet'}
];
async function login(context,user){
 assert.ok(user.email.endsWith('@example.invalid'));const page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/login');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.pathname!=='/login');return page;
}
function responseFor(page,slug,action,scope={}){const pending=page.waitForResponse(r=>{if(r.url()!==`http://127.0.0.1:54321/functions/v1/${slug}`||r.request().method()!=='POST')return false;try{const b=r.request().postDataJSON();return b?.action===action&&Object.entries(scope).every(([k,v])=>b[k]===v);}catch{return false;}},{timeout:45000});void pending.catch(()=>{});return pending;}
async function clickAction(page,game,label,action){const waiting=responseFor(page,game.slug,action);await page.getByRole('button',{name:label}).first().click({timeout:40000});const r=await waiting;assert.equal(r.status(),200,`${game.route} ${action} status`);return r;}
export async function verifyEightGames({browser,players,pokerTables,record=()=>{},observeWager,prepareGame}){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('runtime approval interlock missing');assertLocal('http://127.0.0.1:4173');assert.equal(players.length,2);
 const evidence=[];
 for(const g of games){const contexts=[],pages=[];try{
  for(const u of players){const c=await browser.newContext();contexts.push(c);await c.route('**/*',r=>['http://127.0.0.1:4173','http://127.0.0.1:54321'].includes(new URL(r.request().url()).origin)?r.continue():r.abort());pages.push(await login(c,u));}
  if(prepareGame)await prepareGame(g);
  const scope=g.poker?{tableId:pokerTables?.[g.poker]}:['PlayCraps','PlayRoulette','PlayBaccarat'].includes(g.route)?{game:g.route.slice(4).toLowerCase()}:{};const suffix=g.poker?'?tableId='+pokerTables?.[g.poker]:'';if(g.poker)assert.match(pokerTables?.[g.poker]??'',/^[a-f0-9-]{36}$/i);
  for(const [index,p] of pages.entries()){
   const initial=responseFor(p,g.slug,g.poker?'snapshot':'state',scope);await p.goto('http://127.0.0.1:4173/'+g.route+suffix);const r=await initial;
   if(g.poker&&index===1){assert.equal(r.status(),403,'nonmember snapshot must be denied');await clickAction(p,g,g.join,'join');const snapshot=responseFor(p,g.slug,'snapshot',scope);await p.getByRole('button',{name:'Refresh',exact:true}).click();const joined=await snapshot;assert.equal(joined.status(),200,'seated owner snapshot');const d=await joined.json();assert.ok(d.seats.some(x=>x.user_id===players[index].id));}
   else{assert.equal(r.status(),200,`${g.route} initial state`);const data=await r.json();const already=g.poker?Array.isArray(data.seats)&&data.seats.some(x=>players[index].id===x.user_id):data.state?.joined===true;if(!already)await clickAction(p,g,g.route==='PlayCraps'&&index===1?/Join the Action/:g.join,'join');}
  }
  if(g.poker){await clickAction(pages[0],g,/Deal hand/, 'start');}
  if(['PlayRoulette','PlayCraps'].includes(g.route))await pages[0].getByLabel('Table renderer').selectOption('felt');
  let actor=0;if(g.poker){await Promise.race(pages.map((p,i)=>p.getByRole('button',{name:'Fold',exact:true}).waitFor({state:'visible',timeout:20000}).then(()=>{actor=i;})));}
  if(g.route==='PlayCraps')await pages[actor].getByRole('button',{name:g.bet}).first().click({timeout:40000});
  const response=await clickAction(pages[actor],g,g.route==='PlayCraps'?/Place [\d,]+ chips on FIELD/i:g.bet,g.action);const body=response.request().postDataJSON();assert.ok(body.requestId||body.actionId,'durable original key required');
  if(typeof observeWager!=='function')throw Error('actual browser ledger observer required');const ledgerBefore=await observeWager(g,players[actor],body);
  const headers=await response.request().allHeaders();
  const replay=await contexts[actor].request.post(response.url(),{headers:Object.fromEntries(['authorization','apikey','content-type'].filter(k=>headers[k]).map(k=>[k,headers[k]])),data:body});assert.equal(replay.status(),200,'exact original request replay');const ledgerAfter=await observeWager(g,players[actor],body);assert.deepEqual(ledgerAfter,ledgerBefore,'browser retry posted twice');
  await contexts[actor].setOffline(true);await pages[actor].waitForTimeout(100);await contexts[actor].setOffline(false);const read=responseFor(pages[actor],g.slug,g.poker?'snapshot':'state',scope);await pages[actor].reload();const rr=await read;assert.equal(rr.status(),200);const state=await rr.json();assert.ok(g.poker?Array.isArray(state.seats):state.state&&Number.isFinite(Number(state.state.chips)),'usable authoritative state after reconnect');
  let continuedHand=false,secondLedger=null;
  if(g.poker){
   let beforeRead=responseFor(pages[0],g.slug,'snapshot',scope);await pages[0].getByRole('button',{name:'Refresh',exact:true}).click();const before=await(await beforeRead).json();assert.equal(before.table.status,'complete');
   await clickAction(pages[0],g,/Deal hand/,'start');const dealt=responseFor(pages[0],g.slug,'snapshot',scope);await pages[0].getByRole('button',{name:'Refresh',exact:true}).click();const next=await(await dealt).json();assert.equal(next.table.handNo,before.table.handNo+1);assert.notEqual(next.table.deckCommitment,before.table.deckCommitment);
   const nextActor=players.findIndex(u=>next.seats.some(x=>x.user_id===u.id&&x.seat_no===next.table.turnIndex));assert.ok(nextActor>=0);
   const action=await clickAction(pages[nextActor],g,'Fold','act');const nextBody=action.request().postDataJSON();assert.notEqual(nextBody.actionId,body.actionId,'resolved hand gets a distinct new action');secondLedger=await observeWager(g,players[nextActor],nextBody);
   const nextHeaders=await action.request().allHeaders();const again=await contexts[nextActor].request.post(action.url(),{headers:Object.fromEntries(['authorization','apikey','content-type'].filter(k=>nextHeaders[k]).map(k=>[k,nextHeaders[k]])),data:nextBody});assert.equal(again.status(),200);assert.deepEqual(await observeWager(g,players[nextActor],nextBody),secondLedger);continuedHand=true;
  }
  const passed={route:g.route,realEdgeResponse:true,joined:true,practiceAction:true,exactReplay:true,reconnected:true,requestLedgerAndRetryVerified:true,ledger:ledgerAfter,continuedHand,secondLedger,settlementAndLedgerVerified:false};evidence.push(passed);record('game-'+g.route,passed);
 }catch(error){const diagnostics=[];for(const p of pages){try{diagnostics.push({url:p.url(),buttons:await p.getByRole('button').evaluateAll(xs=>xs.filter(x=>x.getBoundingClientRect().width).slice(0,80).map(x=>({label:x.textContent?.trim().slice(0,120),disabled:x.disabled}))),alerts:await p.getByRole('alert').allTextContents()});}catch{}}record('failure-'+g.route,{message:error.message,diagnostics});throw error;}finally{for(const c of contexts)await c.close();}}
 return evidence;
}
export {games,clickAction};
