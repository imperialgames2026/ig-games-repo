import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {createHostedPvpService,canonical} from '../supabase/functions/pvp-games-review/service.mjs';
import {modules} from '../supabase/functions/pvp-games-review/runtime/engine.mjs';
import {actors,fixture,call,room} from './helpers/pvpHostedFixture.mjs';
const mutate=(s,n,b)=>call(s,n,{...b,requestId:randomUUID()});
test('hosted SQL storage persists exact receipts, binds payloads and denies direct client access',async()=>{
 const f=await fixture();try{const input={op:'create',game:'chess',requestId:randomUUID()},a=await call(f.service,0,input),b=await call(f.service,0,input);assert.equal(a.snapshot.roomId,b.snapshot.roomId);assert.deepEqual(a.receipt,b.receipt);await assert.rejects(call(f.service,0,{...input,game:'rummy'}),/REQUEST_PAYLOAD_CONFLICT/);
 await assert.rejects(call(f.service,1,{op:'snapshot',roomId:a.snapshot.roomId}),/ROOM_MEMBERSHIP_REQUIRED/);
 await f.db.exec('set role authenticated');await assert.rejects(f.db.query('select * from public.ig_pvp_review_rooms'),/permission denied/);await assert.rejects(f.db.query('select ig_pvp_review_read($1,$2,null)',[actors[0].id,a.snapshot.roomId]),/permission denied/);await f.db.exec('reset role');
 await f.db.query('update profiles set is_excluded=true where id=$1',[actors[0].id]);await assert.rejects(call(f.service,0,input),/ACCOUNT_NOT_ELIGIBLE/);
 }finally{await f.db.close();}
});
test('SQL compare-and-swap rejects stale concurrent room updates and canonical roles override actor claims',async()=>{
 const f=await fixture();try{const a=await room(f.service,'chess');const results=await Promise.allSettled([mutate(f.service,0,{op:'invite',roomId:a.roomId,expectedVersion:a.revision,targetId:actors[2].id}),mutate(f.service,0,{op:'invite',roomId:a.roomId,expectedVersion:a.revision,targetId:actors[3].id})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/ROOM_VERSION_CONFLICT/);
 await assert.rejects(mutate(f.service,0,{op:'create',game:'chess',actorId:actors[1].id}),/INVALID_REQUEST_FIELDS/);
 await f.db.query("update user_roles set role='tester' where user_id=$1",[actors[0].id]);await assert.rejects(mutate(f.service,0,{op:'create',game:'chess'}),/READ_ONLY_ROLE/);
 }finally{await f.db.close();}
});
test('six authored variants enforce human seats, turn ownership and private projections through hosted persistence',async()=>{
 const f=await fixture();try{for(const [game,count]of Object.entries({chess:2,rummy:2,rummy6:6,spades:4,battleship:2,battleship6:2})){
  let s=await room(f.service,game,count),n=0;
  for(let step=0;step<8;step++){
   const internal=(await f.store.read(actors[0].id,s.roomId,null)).room;
   const state=internal.state;if(state.over)break;
   n=game.startsWith('battleship')&&state.phase==='placement'?state.ready.findIndex(x=>!x):state.turn;
   let action;
   if(game.startsWith('battleship')&&state.phase==='placement')action=state.ships[n].length<(state.fleetSize??5)?{type:'auto'}:{type:'ready'};
   else action=modules[game].bot(structuredClone(state),n);
   if(!action)break;delete action.player;
   const result=await mutate(f.service,n,{op:'action',roomId:s.roomId,expectedVersion:s.revision,action});s=result.snapshot;
   const other=await call(f.service,(n+1)%count,{op:'snapshot',roomId:s.roomId});assert.equal(other.snapshot.viewerId,actors[(n+1)%count].id);
   if(!s.view.state.over&&s.view.state.hands){for(let seat=0;seat<count;seat++)if(seat!==s.view.seat)assert.equal(s.view.state.hands[seat],null,game+' private hand');}
   if(game.startsWith('battleship')&&!s.view.state.over){assert.deepEqual(s.view.state.ships[1-n],[]);for(const proof of s.view.state.fleetProofs||[])if(proof){assert.equal(proof.nonce,undefined);assert.equal(proof.payload,undefined);}}
  }
  assert.ok(s.revision>count*2-1,game+' accepted actual rule actions');
 }
 }finally{await f.db.close();}
});
test('hosted write quota rejects excess fresh actions while exact retries remain available',async()=>{const f=await fixture();try{const input={op:'create',game:'chess',requestId:randomUUID()},created=await call(f.service,0,input);await f.db.query("insert into ig_pvp_review_receipts(actor_id,request_id,room_id,payload,receipt) select $1,gen_random_uuid(),$2,'{}','{}' from generate_series(1,240)",[actors[0].id,created.snapshot.roomId]);await assert.rejects(mutate(f.service,0,{op:'invite',roomId:created.snapshot.roomId,expectedVersion:1,targetId:actors[1].id}),/ACTION_LIMIT_REACHED/);assert.deepEqual((await call(f.service,0,input)).receipt,created.receipt);}finally{await f.db.close();}});
test('hosted card shuffles do not expose a reproducible 32-bit initial-seed deck',()=>{assert.notDeepEqual(modules.rummy.create(1).hands,modules.rummy.create(1).hands);});
