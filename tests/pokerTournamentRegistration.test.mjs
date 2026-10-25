import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const playerApi=read('supabase/functions/poker-events-v1/index.ts');
const adminApi=read('supabase/functions/admin-poker-events/index.ts');
const page=read('pages/PokerTournaments.jsx');
const adminPage=read('pages/SuperadminPokerTournaments.jsx');
const lobby=read('pages/PokerLobby.jsx');

test('published practice events expose configuration and the signed-in player entry',()=>{
 assert.match(playerApi,/\.in\("status",\["registration","running","paused","finished"\]\)/);
 assert.match(playerApi,/levels:e\.config\?\.levels/);
 assert.match(playerApi,/myEntry:own\.get\(e\.id\)/);
 assert.match(playerApi,/practiceOnly:true,realValueEnabled:false/);
 assert.match(playerApi,/e\.config\?\.practiceOnly===true/);
 assert.match(playerApi,/Number\(e\.config\?\.buyInUnits\?\?0\)===0/);
 assert.match(page,/Blind schedule/);
 assert.match(page,/View tournament details/);
});

test('players can free-register to the pre-start pool and open a table after seating',()=>{
 assert.match(playerApi,/input\.action==="register"/);
 assert.match(playerApi,/input\.action==="tables"/);
 assert.match(page,/action:'register'/);
 assert.match(page,/You are in the tournament pool/);
 assert.match(page,/PlayPoker\?tableId=/);
 assert.match(page,/Late registration into a running event is not enabled/);
 assert.match(page,/No account transaction or payment approval is requested/);
});

test('superadmins can publish draft events and start registration events',()=>{
 assert.match(adminApi,/input\.action==="publish"\|\|input\.action==="start"/);
 assert.match(adminApi,/Access-Control-Allow-Headers.*x-client-info,x-supabase-api-version/);
 assert.match(adminApi,/poker_event_publish_v1/);
 assert.match(adminApi,/poker_event_start_v1/);
 assert.match(adminPage,/Publish to tournaments/);
 assert.match(adminPage,/Start and seat players/);
 assert.match(lobby,/to="\/PokerTournaments"/);
});

test('player tournament functions accept Supabase browser preflight headers',()=>{
 assert.match(playerApi,/access-control-allow-methods.*POST, OPTIONS/);
 assert.match(playerApi,/access-control-allow-headers.*x-client-info,x-supabase-api-version/);
});
