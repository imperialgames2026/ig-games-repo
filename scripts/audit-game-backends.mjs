#!/usr/bin/env node
// Inventory and enforce the staging game migration release boundary.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const approved = new Set(['PlayDice', 'PlayCraps', 'PlayRoulette', 'PlayCrash', 'PlayTrenball', 'PlayBaccarat', 'PlayPoker', 'PlayOmaha', 'PlayBlackjack', 'PlayMultiplayerBlackjack', 'PlayCoinFlip', 'PlayHashDice', 'PlayLimbo', 'PlayPlinko', 'PlayWheel', 'PlayMines', 'PlayDarts', 'PlayDiceZone', 'PlayHiLo', 'PlayRocket', 'PlayTowers']);
const scope = JSON.parse(readFileSync('config/game-migration-scope.json', 'utf8'));
const pending = new Set(scope.approvedForMigration.filter(page=>!approved.has(page)));
const nonMigration = new Set(scope.nonMigration);
const app = readFileSync('App.jsx', 'utf8');
const pages = readdirSync('pages').filter(f => /^Play[A-Z][A-Za-z0-9]*\.jsx$/.test(f));
const rows = [];
let bad = false;
if (new Set(scope.approvedForMigration).size !== scope.approvedForMigration.length || nonMigration.size !== scope.nonMigration.length ||
    [...pending].some(page => nonMigration.has(page)) ||
    [...nonMigration].some(page => approved.has(page))) bad = true;

for (const filename of pages) {
  const page = filename.replace(/\.jsx$/, '');
  const code = readFileSync(join('pages',filename), 'utf8');
  const invocations = [...code.matchAll(/base44\.functions\.invoke\(\s*['"`]([^'"`]+)/g)].map(m => m[1]);
  const directWalletMutation = /base44\.entities\.(?:UserWallet|Transaction|WithdrawalRequest)\.(?:create|update|delete)\s*\(/.test(code);
  const approvedInApp = app.includes("'" + page + "'") && approved.has(page);
  if (approved.has(page)) {
    if (!approvedInApp || invocations.length || directWalletMutation) bad = true;
    if (!/FinalPracticeGame|VerifiedMinesGame|VerifiedOriginalsGame|CrashPracticeV2|MultiplayerPracticeTable|SharedEventPracticeTable|BlackjackPracticeTable|HoldemPracticeTable|verifyPracticeDice/.test(code)) bad = true;
  }
  const status = approved.has(page) ? 'practice_backend' : pending.has(page) ? 'approved_pending_migration' : nonMigration.has(page) ? 'non_migration_on_hold' : 'unclassified';
  if (status === 'unclassified') bad = true;
  rows.push({page, status,
    legacyFunctions: invocations, containsLegacyFinancialMutation: directWalletMutation});
}
for (const page of approved) if (!pages.includes(page+'.jsx')) bad = true;
for (const page of [...pending, ...nonMigration]) if (!pages.includes(page+'.jsx')) bad = true;
if (!app.includes('/^Play[A-Z]/.test(path)') || !/!verifiedPracticeGames\.has\(path\)/.test(app) ||
    !/GameUnavailable game=\{path\}/.test(app)) bad = true;

const report = {generatedAt:new Date().toISOString(),total:rows.length,approved:rows.filter(r=>r.status==='practice_backend').length,
  blocked:rows.filter(r=>r.status!=='practice_backend').length,
  approvedForMigration:rows.filter(r=>r.status==='approved_pending_migration').length,
  nonMigration:rows.filter(r=>r.status==='non_migration_on_hold').length,rows};
writeFileSync('game-migration-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log('Game route migration inventory:',report.total,'routes;',report.approved,'practice-backed;',report.approvedForMigration,'approved for migration;',report.nonMigration,'on the non-migration list');
if (bad) {
  console.error('Game audit failed: unsafe release boundary or missing/conflicting migration scope.');
  process.exitCode=1;
}
