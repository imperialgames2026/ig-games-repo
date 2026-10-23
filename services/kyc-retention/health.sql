-- Aggregate-only operator query. No evidence, names, keys, tokens or IDs.
with eligible as (
 select evidence_deleted_at,cleanup_retry_at,
  greatest(expires_at,upload_valid_until,evidence_recheck_at) as base_due_at,
  greatest(expires_at,upload_valid_until,evidence_recheck_at,cleanup_retry_at) as due_at
 from public.ig_kyc_submissions
 where expires_at<=now()
  and (upload_valid_until is null or upload_valid_until<=now())
  and (evidence_recheck_at is null or evidence_recheck_at<=now())
), due as (select * from eligible where cleanup_retry_at is null or cleanup_retry_at<=now()),
waiting as (select * from eligible where cleanup_retry_at>now())
select count(*) as due_count,
 count(*) filter (where evidence_deleted_at is null) as first_deletion_due,
 count(*) filter (where evidence_deleted_at is not null) as recheck_due,
 coalesce(extract(epoch from now()-min(due_at)),0) as oldest_due_seconds,
 (select count(*) from waiting) as retry_waiting,
 (select coalesce(extract(epoch from now()-min(base_due_at)),0) from waiting) as oldest_waiting_seconds
from due;
