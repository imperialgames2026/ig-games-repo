import test from 'node:test';
import assert from 'node:assert/strict';
import { safePokerAvatar } from '../lib/pokerAvatar.js';
const owner='11111111-1111-4111-8111-111111111111';
const good=`https://qonqemhljgxlwpghkxhn.supabase.co/storage/v1/object/public/profile-avatars/${owner}/22222222-2222-4222-8222-222222222222.png`;
test('only exact owned storage avatar URLs are rendered',()=>{
 assert.equal(safePokerAvatar(good,owner),good);
 for(const bad of ['https://tracker.example/avatar.png',good+'?redirect=elsewhere',good+'#fragment',good.replace('/public/','/sign/'),good.replace(owner,'33333333-3333-4333-8333-333333333333'),good.replace('.png','.svg'),good.replace('https:','http:'),null])assert.equal(safePokerAvatar(bad,owner),null);
});
