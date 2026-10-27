import assert from 'node:assert/strict';
export async function verifyFreeRegistration({page,eventId,eventName}){
 if(process.env.IG_SYNTHETIC_STACK_APPROVED!=='1')throw Error('runtime approval interlock missing');
 assert.match(eventId,/^[a-f0-9-]{36}$/i);assert.ok(eventName.startsWith('Synthetic '));
 if(new URL(page.url()).origin!=='http://127.0.0.1:4173')throw Error('nonlocal page');
 await page.goto('http://127.0.0.1:4173/PokerTournaments');
 const card=page.getByRole('button').filter({hasText:eventName});
 await card.first().waitFor({state:'visible',timeout:15000});
 assert.equal(await card.count(),1,'unique synthetic event card');await card.click();
 const waiting=page.waitForResponse(r=>{try{return r.url()==='http://127.0.0.1:54321/functions/v1/poker-events-v1'&&r.request().postDataJSON()?.action==='register'&&r.request().postDataJSON()?.eventId===eventId;}catch{return false;}});
 void waiting.catch(()=>{});
 await page.getByRole('button',{name:'Register free (practice)',exact:true}).click();const response=await waiting;assert.equal(response.status(),200);
 const headers=await response.request().allHeaders();const repeated=await page.context().request.post(response.url(),{headers:Object.fromEntries(['authorization','apikey','content-type'].filter(k=>headers[k]).map(k=>[k,headers[k]])),data:{action:'register',eventId}});assert.equal(repeated.status(),200);assert.equal((await repeated.json()).alreadyRegistered,true);
 await page.reload();await page.getByText('You are in the tournament pool.',{exact:false}).waitFor();
 return {freeRegistration:true,repeatNoNewEntry:true,reloadRestored:true,seatingPlayingSettlementVerified:false};
}
