import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
test('migration versions are unique and hand archive follows its referenced table',()=>{
 const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql'));
 const versions=files.map(n=>n.split('_')[0]);
 assert.equal(new Set(versions).size,versions.length,'duplicate versions make db push ambiguous');
 assert.ok(files.find(n=>n.endsWith('_hand_review_credits.sql')) < files.find(n=>n.endsWith('_completed_hands_archive.sql')));
});
