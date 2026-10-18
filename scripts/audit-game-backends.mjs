#!/usr/bin/env node
// Inventory and enforce the staging game migration release boundary.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const approved = new Set(['PlayDice', 'PlayCraps', 'PlayRoulette', 'PlayCrash', 'PlayTrenball', 'PlayBaccarat']);
const app = readFileSync('App.jsx', 'utf8');
const pages = readdirSync('pages').filter(f => /^Play[A-Za-z0-9]+\.jsx$/.test(f));
const rows = [];
let bad = false;

for (const filename of pages) {
  const page = filename.replace(/\.jsx$/, '');
  const code = readFileSync(join('pages',filename), 'utf8');
  const invocations = [...code.matchAll(/base44\.functions\.invoke\(\s*['"`]([^'"`]+)/g)].map(m => m[1]);
  const directWalletMutation = /base44\.entities\.(?:UserWallet|Transaction|WithdrawalRequest)\.(?:create|update|delete)\s*\(/.test(code);
  const approvedInApp = app.includes("'" + page + "'") && approved.has(page);
  if (approved.has(page)) {
    if (!approvedInApp || invocations.length || directWalletMutation) bad = true;
    if (!/MultiplayerPracticeTable|SharedEventPracticeTable|verifyPracticeDice/.test(code)) bad = true;
  }
  rows.push({page, status: approved.has(page) ? 'practice_backend' : 'blocked_pending_migration',
    legacyFunctions: invocations, containsLegacyFinancialMutation: directWalletMutation});
}
for (const page of approved) if (!pages.includes(page+'.jsx')) bad = true;
if (!/!verifiedPracticeGames\.has\(path\)/.test(app) ||
    !/GameUnavailable game=\{path\}/.test(app)) bad = true;

const report = {generatedAt:new Date().toISOString(),total:rows.length,approved:rows.filter(r=>r.status==='practice_backend').length,
  blocked:rows.filter(r=>r.status==='blocked_pending_migration').length,rows};
writeFileSync('game-migration-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log('Game route migration inventory:',report.total,'routes;',report.approved,'practice-backed;',report.blocked,'blocked');
if (bad) {
  console.error('Staging game safety regression: a practice-approved game has unsafe legacy calls, or an unverified game route is not gated.');
  process.exitCode=1;
}
