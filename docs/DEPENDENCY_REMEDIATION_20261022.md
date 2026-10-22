# Dependency remediation — 2026-10-22

Base source: `9afecfbb3fbaa80b23b9c3707474ad4cf60146b9`, the owner-confirmed `llc.imperialgaming.games` Android identity snapshot.

## Result

A fresh `npm audit --json` after remediation reports:

- critical: 0
- high: 0
- moderate: 0
- low: 0
- total: 0

This resolves the 33 findings previously reported by the same registry audit path. It is dependency-audit evidence, not a blanket application-security guarantee.

## Changes

- lodash 4.18.1
- moment 2.31.0
- react-router-dom 7.18.4
- postcss 8.5.31
- vite 6.4.4
- baseline-browser-mapping 2.11.30
- Tailwind CSS 3 -> 4.3.3 using `@tailwindcss/postcss`
- replaced `tailwindcss-animate` with `tw-animate-css` 1.4.0
- xcode's CLI-only uuid dependency is overridden to uuid 11.1.1 to remove the vulnerable uuid 7 chain while retaining Capacitor 8.5.3.

The Tailwind configuration is now `tailwind.config.cjs` and the root stylesheet loads it explicitly with Tailwind 4's `@config` directive.

## Validation

- mobile Node regression suite: 79 passed, 0 failed/skipped
- application/backend Node suite: 150 passed, 0 failed/skipped
- production Vite build: passed
- Capacitor Android sync: passed
- Gradle `assembleDebug assembleRelease testDebugUnitTest lintDebug`: passed

The first Tailwind 4 build attempt correctly failed because the old animation plugin was still referenced. That stale config reference was removed and the complete build then passed.

No signing key, password, hosted Auth/database configuration, wallet-redemption state or distribution setting was changed. The verified signed `9afecfb` directory was preserved untouched; remediation occurred in a separate clone.
