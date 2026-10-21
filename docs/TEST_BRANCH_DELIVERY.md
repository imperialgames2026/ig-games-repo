# Tester website on the GitHub test branch

The owner authorized pushing the checked website draft to GitHub branch `test`
on October 21, 2026. This authorization is limited to the test branch and its
preview. It does not authorize merging to `main`, changing the production site,
applying hosted SQL, deploying functions or provisioning bots.

Branch: https://github.com/imperialgames2026/ig-games-repo/tree/test

Cloudflare branch-preview alias: https://test.ig-games-repo.pages.dev
This preview is protected by the existing Cloudflare Access sign-in. Check the
latest branch deployment status before treating an older successful build as current.

The branch preserves the validated tester-chip working application and its
consolidation references, tests and separately prepared backend candidates.
It is based on the reviewed working-draft baseline `c0d1d10`; the current
production branch's later VIP work is not silently merged into this lab draft.

## Preview configuration

`vercel.json` on this branch selects `npm run build:lab` and output `dist-lab`.
The build validates project `jvyzpxjqmymafjapprpp` (**IG network lab tests**).
`config/test-lab-public.json` intentionally contains that lab's public URL and
publishable browser key. These settings are delivered to browsers; no account,
secret or service-role credentials are included. Hosted `test` builds pin these
values rather than inheriting the hosting dashboard's production backend.
Invalid pinned settings intentionally block the build.

Vite selects these settings whenever Cloudflare or Vercel identifies the branch
as `test`. This covers a hosting dashboard that calls the generic build command
instead of the repository's lab command. Other branches and deliberate local
browser fixtures retain their own configuration. Existing Cloudflare Access
protection is preserved; a successful preview may require the owner's sign-in.

A GitHub branch URL is a source link. A working hosted preview URL is only
reported after the hosting integration supplies and successfully builds one.
This website branch does not itself make missing lab functions available.

## Checks

The reviewed frontend passed 187 offline checks, 100 desktop/mobile checks,
17 browser contracts, lint and a real lab build. Thirty-two distinct authenticated
checks were also verified against disposable local services; see
[website completion](WEBSITE_FRONTEND_COMPLETION_20261021.md) for their exact scope.
Three additional hosting-isolation regressions bring the test branch's offline
suite to **190 passing checks**. Cloudflare/Vercel-style builds pin the selected
lab even with inherited production settings. These builds and lint
also pass locally. The initial GitHub test-branch workflow succeeded; subsequent
commit checks are visible under the branch's Actions runs.

The branch-specific `Tester website checks` workflow runs on pushes and PRs to
`test`. It runs offline regressions, lint, browser-fixture compilation,
desktop/mobile checks and profile/game contracts. Its deliberately local
connection is a test fixture; it neither requires hosted credentials nor proves
hosted lab readiness. It does not run financial preparation flows, apply schema,
deploy functions or publish a website.

Earlier readiness reports describe their observation times. They are retained
as evidence and are not declarations that the current test branch is production-ready.
