# Casino ZIP integration staging

Source: `imperialgames2026/casino-zip`, `ig-games.zip` (uploaded separately for review).
Target: `imperialgames2026/ig-games-repo`, based on `migration/supabase-foundation`.

## Integration rules

- Keep the Supabase migration branch as the application baseline.
- The source archive has a `src/` React app and `base44/` backend. The target repo uses root-level React files and Supabase backend functions. Do not copy `src/` wholesale into the root.
- Do not reintroduce Base44 authentication, credentials, or backend calls that bypass Supabase policies.
- Do not overwrite Supabase migrations, environment configuration, or protected routes.
- Exclude the separately uploaded Android APK and AAB.
- Review `public/robots.txt` and `public/sitemap.xml` before importing: they contain the older `imperialhouse.online` domain and may include private routes in the sitemap.
- Compare feature files and import only genuinely missing or improved implementations; verify imports, route registration, and backend compatibility.
- Run `npm ci`, `npm run build`, and role-based authorization tests before merging.
- Never merge into `main` without review.

This branch stages the integration work. The ZIP contents have not yet been fully merged.
