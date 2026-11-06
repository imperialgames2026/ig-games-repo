import test from 'node:test';import assert from 'node:assert/strict';import config from '../vite.config.js';
test('parked source fixtures build only with isolated local test backend',()=>{
 const prior=process.env.VITE_SUPABASE_URL;
 try{for(const [mode,url,expected] of [['production','http://127.0.0.1:54321',false],['test','https://qonqemhljgxlwpghkxhn.supabase.co',false],['test','http://127.0.0.1:54321',true]]){process.env.VITE_SUPABASE_URL=url;assert.equal(Object.hasOwn(config({mode}).build.rollupOptions.input,'parkedSource'),expected,mode+' '+url);}}finally{if(prior===undefined)delete process.env.VITE_SUPABASE_URL;else process.env.VITE_SUPABASE_URL=prior;}
});
