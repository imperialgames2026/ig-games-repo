# Mobile dependency inventory — October 21, 2026

## Exact evidence, not a security sign-off

Collected by run `39634834695` at source `6b859b619c4c19098130fd733e2a65abb4fbc91b` using `npm audit --json --package-lock-only`. Lock SHA-256: `8fd06f8d0482263dbcb183288d43b1862a6355853b0895d0cfe4866587e7f111`.

Artifact `12359439767` archive SHA-256 `1d03f447a1be616fdbf5c05cd17e71d0ce15cd37bb257802743a99092c0fe817` was downloaded and verified. It contains raw `npm-audit.json` and structured `dependency-inventory.json`.

Fresh result: **33 findings: 0 critical, 22 high, 10 moderate, 1 low.** The owner's checklist and original PR35 recorded 32 high/62 total historically. Preserve those historical numbers; registry responses/counts are not an immutable baseline. Do not attribute the difference to further fixes: this inventory uses the same imported PR35 lock. Zero critical does NOT mean the release passes security review.

## Initial engineering triage — all unresolved

1. Prioritize application routing and lodash review: `@remix-run/router`, `react-router`, `react-router-dom`, `lodash`. Inspect actual imports and untrusted redirect/template inputs, select supported patched versions, regenerate the lock, and run native/browser/Auth regressions. No runtime reachability or exploitability claim is made yet.
2. Review build/CLI/parser chains: `brace-expansion`, `braces`, `browserslist`, `chokidar`, `fast-glob`, `flatted`, `glob`, `js-yaml`, `micromatch`, `minimatch`, `nanoid`, `picomatch`, `postcss`, `rollup`, `source-map-js`, `tailwindcss`, `tailwindcss-animate`, `vite`. Lockfile dev flags describe installation, not whether code ships in the bundle. Build-tool attacks also require assessment; do not dismiss them merely as dev dependencies.
3. The registry reports no automatic fix for the `braces` / `micromatch` / `chokidar` / Tailwind chain. This needs a reviewed upgrade, removal, mitigation or evidence-backed nonapplicability decision, not `npm audit fix --force` or a blanket waiver.

Primary advisory references in the captured report include React Router `GHSA-2w69-qvjg-hvjx`, lodash `GHSA-r5fr-rjxr-66jc`, braces `GHSA-vfj7-8cjw-p6xm`, and Vite `GHSA-p9ff-h696-f583`. The raw artifact preserves all advisory URLs, affected versions, dependent chains and registry fix hints for follow-up verification.

No additional dependency upgrade, waiver or security acceptance is claimed in this triage. October 27's no-unresolved-critical/high-blocker gate remains open.

## Concurrent PR35 refresh

While integration was being prepared, PR35 advanced to `b650de2545fccfeac91f856ba88beeadbd8599f1` by reconciling PR34's newer isolation fixes. Its change list relative to the original PR35 contains those already-preserved PR34 changes. The refreshed workflow exactly matches the integrated workflow after excluding the newly added inventory job and its six tests (Git blob `9a1b36bde151c00767124657072893eb0eae35cc`). Preserve the refreshed history as a merge parent rather than overwriting either working section.

This documentation/ancestry update changes no packaged application code or lockfile, but exact-source native evidence must still be recorded for the final integration commit. Main remains unchanged; reward-credit scope must be reconciled before a shared release freeze.
