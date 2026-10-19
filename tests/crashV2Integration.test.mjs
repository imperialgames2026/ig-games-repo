import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('combined Crash routes use server-timed v2 with committed-result cashout limit',()=>{
 const ui=read('components/games/CrashPracticeV2.jsx');
 const api=read('supabase/functions/ig-crash-v2/index.ts');
 const sql=read('supabase/migrations/20261018235300_crash_v2_prevent_early_auto_cashout_beyond_committed_result.sql');
 for (const name of ['PlayCrash','PlayTrenball']) assert.match(read('pages/'+name+'.jsx'), /CrashPracticeV2/);
 assert.match(ui,/ig-crash-v2/);
 assert.match(ui,/realMoneyEnabled!==false/);
 assert.doesNotMatch(ui,/base44|UserWallet\.update|Transaction\.create/);
 assert.match(api,/p_actor: user.id/);
 assert.match(api,/client.auth.getUser\(token\)/);
 assert.match(sql,/target<=x and target<=v.crash_point/);
});
