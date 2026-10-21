import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAnnouncement,createAnnouncements} from '../lib/announcements.js';
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
test('announcement limits count Unicode code points like PostgreSQL',()=>{
 assert.equal([...normalizeAnnouncement({...input,title:'🎲'.repeat(160),message:'🎲'.repeat(3000)}).title].length,160);
 assert.throws(()=>normalizeAnnouncement({...input,title:'🎲'.repeat(161)}));
 assert.throws(()=>normalizeAnnouncement({...input,message:'🎲'.repeat(3001)}));
});
test('URL authority validation rejects malformed hosts and matches bounded HTTPS hostname policy',()=>{
 for(const link_url of ['https://?x','https://#x','https://user@example.com','https://a..com','https://-a.com','https://a.com:65536','https://a.com:','https://a.com:abc','https://a.com/\u00a0x','https://127.0.0.1','https://[::1]'])
  assert.throws(()=>normalizeAnnouncement({...input,link_url}));
 for(const link_url of ['https://example.com','https://localhost:443/path','https://a-b.example/x?q=🎲#x','/','/Games?q=🎲'])
  assert.equal(normalizeAnnouncement({...input,link_url}).link_url,link_url);
});

test('public expiry uses server time and admin listing requests deterministic pages',async()=>{
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'actor',email:'fixture@example.invalid'}}})},from(table){
  const q={select(){return q;},eq(){return q;},order(field){calls.push(['order',field]);return q;},or(filter){calls.push(['or',filter]);return q;},
   limit(n){calls.push(['limit',n]);return Promise.resolve({data:[]});},range(a,b){calls.push(['range',a,b]);return Promise.resolve({data:[]});},
   maybeSingle:async()=>({data:table==='profiles'?{id:'actor',is_excluded:false}:{role:'admin'}})};
  return q;
 }};
 const service=createAnnouncements(client);
 await service.list();assert.deepEqual(calls.find(c=>c[0]==='or'),['or','expires_at.is.null,expires_at.gt.now']);
 calls.length=0;await service.list({admin:true,page:1});
 assert.deepEqual(calls.find(c=>c[0]==='range'),['range',100,199]);
 assert.deepEqual(calls.filter(c=>c[0]==='order').map(c=>c[1]),['priority','created_at','id']);
});
