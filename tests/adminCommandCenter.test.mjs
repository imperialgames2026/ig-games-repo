import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=load('supabase/functions/ig-admin-command-center/index.ts');
const app=load('App.jsx');
const admin=load('pages/Admin.jsx');
const layout=load('components/admin/CommandCenterLayout.jsx');
const users=load('pages/AdminUsers.jsx');
const wallets=load('pages/AdminWallets.jsx');
const support=load('pages/AdminSupport.jsx');
const kyc=load('pages/AdminKYC.jsx');
const treasury=load('pages/AdminTreasury.jsx');
test('command center requires real JWT, server-side privileged role and eligibility',()=>{
 assert.match(api,/auth\.getUser\(bearer\)/);
 assert.match(api,/\["admin","superadmin"\]/);
 assert.match(api,/profileCheck\.data\?\.is_excluded!==false/);
 assert.match(api,/PROJECT="qonqemhljgxlwpghkxhn"/);
 assert.match(api,/Staging operator service unavailable/);
 assert.match(api,/Unsupported read-only view/);
 assert.doesNotMatch(api,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(api,/financialActionsEnabled:false/);
});
test('admin routes are protected and render dedicated operator shell',()=>{
 assert.match(app,/adminPages\.has\(currentPageName\)/);
 assert.match(app,/<CommandCenterLayout>/);
 assert.match(app,/AdminTreasury/);
 assert.match(app,/path==='SuperadminPokerTournaments' \? \['superadmin'\]/);
 assert.match(layout,/role==='superadmin'/);
 assert.match(layout,/aria-current/);
 assert.match(layout,/lg:translate-x-0/);
});
test('dashboard uses Supabase rather than unsafe legacy Base44 mutating managers',()=>{
 assert.doesNotMatch(admin,/base44|entities\.Game|entities\.TokenPack/);
 assert.match(admin,/ig-admin-command-center/);
 assert.match(admin,/result\?\.error/);
 assert.match(admin,/incomplete/);
 assert.match(admin,/Uncredited deposit observations/);
 assert.match(admin,/Pending withdrawal requests/);
});
test('financial modules are read-only and Support uses separately authorized ticket operations',()=>{
 for(const page of [users,wallets,kyc,treasury]){
  assert.match(page,/CommandCenterDataView/);
  assert.doesNotMatch(page,/base44|private[_-]?key|signTransaction|\.rpc\(/i);
 }
 assert.match(wallets,/unverified accounting units/);
 assert.match(treasury,/not real funded wallets/);
 assert.match(support,/ig-support-v1/);
 assert.match(support,/ig-support-supervisor/);
 assert.match(support,/support\('post'/);
 assert.match(support,/support\('messages'/);
 assert.doesNotMatch(support,/base44|signTransaction|\.rpc\(/i);
});
