# Practice storefront, promotions and operator controls

The October 22 review found live controls whose Base44 mutation paths were already blocked by the compatibility client. The referral page promised 500 IC and lifetime commissions; quest cards synthesized objectives and prizes; the store advertised Base44 checkout, purchase bonuses and a placeholder mail address. The old operator route mounted disabled mutation forms. These are not functioning migrated programs.

This frontend change makes their current availability explicit:

- Referrals has a status message, practice-game link and support link. It does not read or share unbound referral codes or present commissions as earned.
- Store explains that purchases and purchase bonuses are unavailable. It does not fetch token packs or promise a price, promotional currency, payment method or delivery address.
- Bonuses retains the existing authoritative VIP wheel, earned spins, receipt history and paused-pool behavior. Unsupported daily/weekly quests and periodic/deposit/wager bonuses have status messages instead of fallback progress, balances or claim controls.
- AdminLegacyTools becomes a directory of current role-protected VIP, wheel, wallet review, poker, audit, announcement and support modules. Poker links appear only for superadmins. Unavailable legacy programs are listed as backlog items rather than actionable forms.

No SQL, Edge Function, Auth configuration, reward configuration, game allowlist or financial execution setting changes. The programs remain in the full-app backlog; marking a control unavailable does not complete its backend migration. Existing implementation history is preserved in Git, with prior UI at `76eb7ac94d3c5caaa8127ed03744e5908e9ef845`.

## Acceptance

`tests/browser/launch-controls.spec.mjs` covers stale wallet promotion flags, unsupported claim/checkout/code controls, saved VIP spins with three paused wheels, mobile overflow, current operator links and player/tester route denial. The real Supabase client uses intercepted fixtures; no hosted accounts, messages, payments or reward mutations are created. Existing build, SQL, Auth and browser CI remains required before merge.

## Remaining work

Referrals, quests, bonus issuance and financial features still need approved amounts, currencies, eligibility, expiry and funding rules plus dedicated authorized handlers and behavioral tests. SendGrid remains paused at the owner's request. Public email delivery and mobile callback acceptance remain launch gates.

Mini-Imp now has a separate current-source checkout at `/home/imperialist85/Projects/imperial-games-main-site`. The older Base44 export, Android checkouts and Unity resources were not modified. This workstation runs Ubuntu 26.04.1 and Node 22.22.1; browser CI remains on the previously verified Ubuntu 24.04 runner.
