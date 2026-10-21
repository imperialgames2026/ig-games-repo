import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual candidate server implementations, including the bot lab's
// duplicate helper, without provisioning bots or invoking a remote service.
function load(name) {
  const source = readFileSync(new URL(`../supabase/pending-functions/${name}/index.ts`, import.meta.url), 'utf8');
  const helpers = source.slice(source.indexOf('type C='), source.indexOf('Deno.serve('));
  const js = ts.transpileModule(helpers, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None}}).outputText;
  const isolated = {};
  vm.runInNewContext(js + '\nthis.payout = awards;', isolated, {timeout: 2000});
  return (seats, board, button) => JSON.parse(JSON.stringify(isolated.payout(seats, board, button, 'holdem')));
}
const cards = value => value.split(' ').map(card => ({
  rank: ({A:14,K:13,Q:12,J:11,T:10})[card[0]] || Number(card[0]), suit:card[1],
}));
const seat = (seat_no, committed, private_hole, folded=false) => ({seat_no, committed, private_hole:cards(private_hole), folded});
const amounts = awards => awards.reduce((out, award) => ({...out, [award.seat]:(out[award.seat] || 0) + award.chips}), {});

for (const name of ['poker-table-v1', 'ig-poker-bot-lab']) {
  const payout = load(name);
  test(name + ': odd chips go clockwise after the button across seats 7 and 0', () => {
    const result = payout([
      seat(7,5,'2c 3c'), seat(0,5,'4d 5d'), seat(3,5,'6s 7s',true),
    ], cards('Ah Kh Qh Jh Th'), 6);
    assert.deepEqual(amounts(result), {7:8,0:7});
  });

  test(name + ': short-stack winner receives the main pot, a different winner gets the side pot', () => {
    const result = payout([
      seat(7,30,'As Ad'), seat(0,100,'Ks Kd'), seat(6,100,'Qs Qd'),
    ], cards('2c 3d 7h 9s Tc'), 6);
    assert.deepEqual(amounts(result), {7:90,0:140});
    assert.equal(result.reduce((sum,row)=>sum+row.chips,0), 230);
  });

  test(name + ': an uncalled excess returns to its contributor', () => {
    const result = payout([seat(0,100,'As Ad'),seat(7,30,'Ks Kd')], cards('2c 3d 7h 9s Tc'), 6);
    assert.deepEqual(amounts(result), {0:130});
  });

  test(name + ': tied side pots conserve every whole chip and never award a folded seat', () => {
    const board = cards('Ah Kh Qh Jh Th');
    for (let value=1; value<=25; value++) {
      const players = [seat(0,value,'2c 3c'),seat(3,value+7,'4d 5d',true),
        seat(6,value+13,'6c 7c'),seat(7,value+13,'8s 9s')];
      const result = payout(players, board, 6);
      assert.equal(result.reduce((sum,row)=>sum+row.chips,0), players.reduce((sum,row)=>sum+row.committed,0));
      assert.ok(result.every(row=>Number.isSafeInteger(row.chips)&&row.chips>=0&&row.seat!==3));
    }
  });
}
