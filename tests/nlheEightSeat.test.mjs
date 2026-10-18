import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=file('supabase/migrations/20261017210000_nlhe_eight_seats.sql');
const edge=file('supabase/functions/poker-table-v1/index.ts');
const ui=file('components/games/HoldemPracticeTable.jsx');
test('NLHE joins seats 0 through 7; Omaha stays capped at 6',()=>{
 assert.match(sql,/case when t\.variant='holdem' then 8 else 6 end/);
 assert.match(sql,/generate_series\(0,seat_limit-1\)/);
 assert.match(sql,/players<2 or players>8/);
 assert.match(ui,/length:isOmaha\?6:8/);
});
test('button, blinds and first actor rotate clockwise across 8 seat numbers',()=>{
 const rotations=sql.match(/\+8\)%8/g)||[];
 assert.ok(rotations.length>=5,'missing 8-seat clockwise ordering in '+rotations.length+' clauses');
 assert.match(sql,/dealt_count=players/);
 assert.match(sql,/p_deck->\(idx\+players\)/);
});
test('side-pot tie remainder follows 8-seat button order',()=>{
 assert.match(edge,/a\.seat_no-button-1\+8\)%8/);
 assert.match(edge,/b\.seat_no-button-1\+8\)%8/);
 assert.doesNotMatch(edge,/seat_no-button-1\+6\)%6/);
});
