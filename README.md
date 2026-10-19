# Imperial Games

Original React/Vite app with Supabase Auth, server-authoritative practice games, player pages and operator tools.

Read [current integration status](docs/INTEGRATION_STATUS_20261019.md) before deployment. Branch consolidation is not completion of the financial or production migration.

## Develop

Use Node.js 22, run `npm ci`, copy `.env.example` to `.env.local`, and configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never use a service-role key in the browser. Current practice handlers target the dedicated staging project.

Run `npm run dev` or `npm run build`. The build does not deploy the website. GitHub Actions verifies migration contracts and builds the app. Archived Base44 source is preserved for reference; do not restore its SDK or client-side balance writes.

## Repositories

This repository is the full application baseline. `casino-zip` preserves the ZIP and its independently migrated source and test scaffold. Newer migrated account screens, Crash v2 and the poker lab have been integrated here without replacing the full app with that scaffold.
