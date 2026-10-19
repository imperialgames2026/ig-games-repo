-- REVIEW PROPOSAL ONLY: excluded from backend-manifest.json and deployment.
-- Before promotion: classify imported ownerless entities and publish any public
-- catalog through an explicit, minimal-data view/endpoint. Never infer public
-- visibility merely from missing ownership. Preserve existing administrator reads.
drop policy if exists "app records read own" on public.app_records;
