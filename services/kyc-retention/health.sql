-- Read-only, aggregate-only operator query after authorized migration rollout.
-- Execute with an already authorized service/database role; never expose as a
-- browser RPC. Does not read names, images, object keys, tokens or customer IDs.
with due as (
 select evidence_deleted_at,
  greatest(expires_at, coalesce(upload_valid_until,expires_at),
           coalesce(evidence_recheck_at,expires_at)) as due_at
 from public.ig_kyc_submissions
 where expires_at<=now()
  and (upload_valid_until is null or upload_valid_until<=now())
  and (evidence_recheck_at is null or evidence_recheck_at<=now())
)
select count(*) as due_count,
 count(*) filter (where evidence_deleted_at is null) as first_deletion_due,
 count(*) filter (where evidence_deleted_at is not null) as recheck_due,
 coalesce(extract(epoch from now()-min(due_at)),0) as oldest_due_seconds
from due;
