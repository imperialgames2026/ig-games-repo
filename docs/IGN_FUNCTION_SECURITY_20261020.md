# IGN function access boundary — 2026-10-20

Staging project: `qonqemhljgxlwpghkxhn`. Recorded migration:
`20261020223222_private_ign_action_boundary.sql`.

The security advisor flagged `public.ign_action(text,numeric,uuid,boolean)` because
it was an authenticated-callable SECURITY DEFINER in an API schema. The existing
staking Edge Function intentionally calls this RPC with the user's JWT.

The migration moves the unchanged actor-bound implementation to `internal`, sets
its search path to empty, and creates a public SECURITY INVOKER wrapper with the
same arguments/defaults and result. Both functions revoke PUBLIC/anonymous
execution; authenticated/service_role execution is explicit. Authenticated users
receive no new table write grants. The private implementation still binds every
operation to `auth.uid()` and checks canonical roles, exclusion and receipt payloads
before replay. `internal` must remain outside the exposed API schemas.

Hosted staging verification:

- `ign_invoker_boundary_rollback.sql` passed under the actual authenticated SQL
  role: successful grant/stake/retry, changed-payload rejection, actor isolation,
  anonymous denial, missing identity denial and tester/exclusion replay denial.
- `canonical_signup_ign_replay_rollback.sql` also passed after the move.
- Both suites roll back their generated fixture accounts and IGN entries.
- A fresh security advisor read showed zero authenticated SECURITY DEFINER
  executable findings. The separate leaked-password-protection warning remains;
  56 RLS-enabled/no-policy informational findings remain for private tables.
- The existing Edge Function call contract and implementation are unchanged.

The reviewed package now contains 93 recorded migrations and 30 functions. The
new SQL suite is included in the isolated database CI runner (15 suites total).
No customer data migration or production cutover was performed.

[Supabase advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
