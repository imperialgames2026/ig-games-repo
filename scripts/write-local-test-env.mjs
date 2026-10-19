import {readFileSync,writeFileSync} from 'node:fs';
const c=JSON.parse(readFileSync('/tmp/ig-local-runtime.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(c.API_URL)||!c.ANON_KEY)throw Error('Local test environment required');
writeFileSync('.env.test.local','VITE_SUPABASE_URL='+c.API_URL+'\nVITE_SUPABASE_PUBLISHABLE_KEY='+c.ANON_KEY+'\nVITE_ENABLE_LEGACY_EDGE_FUNCTIONS=false\n',{mode:0o600});
console.log('Configured public local test connection');
