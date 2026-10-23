import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPublishedRelease} from '../scripts/verify-published-release.mjs';
const sha='a'.repeat(40);
function fixture(patch={},broken){return async url=>{
 const path=url.pathname;
 if(path==='/release.json')return new Response(JSON.stringify({commit:sha,release_mode:'practice',backend_url:'https://qonqemhljgxlwpghkxhn.supabase.co',legacy_operations_enabled:false,held_game_count:10,...patch}));
 if(path===broken)return new Response('Not found',{status:404});
 if(path==='/assets/app.js')return new Response('const url="https://qonqemhljgxlwpghkxhn.supabase.co";');
 return new Response('<div id="root"></div><script type="module" src="/assets/app.js"></script>');
};}
test('published verification checks exact commit, backend, practice scope, deep links and bundle',async()=>{
 assert.equal((await verifyPublishedRelease('https://imperialgaming.llc',sha,{fetcher:fixture()})).routes,6);
 for(const patch of [{commit:'b'.repeat(40)},{legacy_operations_enabled:true},{held_game_count:0},{backend_url:'https://other.supabase.co'}])await assert.rejects(verifyPublishedRelease('https://imperialgaming.llc',sha,{fetcher:fixture(patch)}));
 await assert.rejects(verifyPublishedRelease('https://imperialgaming.llc',sha,{fetcher:fixture({},'/PrizeClaims')}),/HTTP 404/);
});
