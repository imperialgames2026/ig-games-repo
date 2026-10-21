# Imperial Games — Application Blueprint

## Sources

### NotebookLM design references

These notebooks are reference inputs for future application design and implementation. Their contents have not yet been independently reviewed; do not treat them as verified specifications until exported or accessible.

1. [NotebookLM reference 1](https://notebooklm.link.google/9LMINVRmcjuI)
2. [NotebookLM reference 2](https://notebooklm.link.google/4FjLswXvznF9)
3. [NotebookLM reference 3](https://notebooklm.link.google/5uQsVqpU2xRG)

## Implementation context

- Project: Imperial Games application.
- Planned backend: Supabase authentication, database, and secure Edge Functions.
- Security priorities: server-side game settlement, wallet transactions, payment operations, and role-based access control.
- Roles under consideration: superadmin, admin, and read-only tester.
- Integration work must be tested and verified before merging into `main`.

## Next review

Extract design requirements and feature descriptions from the three notebooks, compare them with existing application code, and turn confirmed requirements into tracked implementation tasks.
