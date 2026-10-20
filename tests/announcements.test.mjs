import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnnouncement} from '../lib/announcements.js';
const input={title:'  Title  ',message:' Body ',type:'special',is_active:false,priority:'10',link_url:'/Games',expires_at:''};
test('announcement content normalizes only approved fields without actor or revision writes',()=>{
 assert.deepEqual(normalizeAnnouncement({...input,created_by:'forged',revision:99,role:'admin'}),{title:'Title',message:'Body',type:'special',is_active:false,priority:10,link_url:'/Games',expires_at:null});
});
test('announcement URLs reject script schemes, protocol-relative hosts, credentials and backslashes',()=>{
 for(const link_url of ['javascript:alert(1)','//evil.example','/\\evil.example','https://user:pass@example.com','data:text/html,hello']){
  assert.throws(()=>normalizeAnnouncement({...input,link_url}),/HTTPS/);
 }
 assert.equal(normalizeAnnouncement({...input,link_url:'https://example.com/path?q=1'}).link_url,'https://example.com/path?q=1');
});
test('announcement malformed fields and expiry fail before any database mutation',()=>{
 for(const patch of [{title:''},{message:''},{type:'unknown'},{is_active:'true'},{priority:1001},{priority:0.5},{expires_at:'not-a-date'}])assert.throws(()=>normalizeAnnouncement({...input,...patch}));
});
