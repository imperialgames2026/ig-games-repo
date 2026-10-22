-- Private, authenticated KYC intake. All writes go through the service-only RPC.
-- Face comparison is advisory; only a different human reviewer can approve.
create table public.ig_kyc_submissions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 status text not null default 'draft' check(status in ('draft','submitted','needs_changes','escalated','approved','rejected','cancelled','expired')),
 revision integer not null default 0,
 full_name text not null check(length(full_name) between 2 and 120),
 birth_date date not null, country text not null check(country ~ '^[A-Z]{2}$'),
 document_type text not null check(document_type in ('passport','driver_license','national_id')),
 consent_version text not null check(consent_version='2026-10-22'),
 face_consent boolean not null default false,
 evidence jsonb not null default '{}'::jsonb,
 face_result jsonb, face_lease uuid, face_lease_until timestamptz, face_attempts integer not null default 0,
 reviewer_id uuid references auth.users(id), review_reason text, customer_message text,
 submitted_at timestamptz, reviewed_at timestamptz, evidence_deleted_at timestamptz,
 expires_at timestamptz not null default now()+interval '30 days',
 upload_valid_until timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index ig_kyc_one_open on public.ig_kyc_submissions(user_id) where status in ('draft','submitted','escalated');
create index ig_kyc_queue on public.ig_kyc_submissions(status,created_at);
create index ig_kyc_expiry on public.ig_kyc_submissions(expires_at) where evidence_deleted_at is null;
create table public.ig_kyc_audit (
 id bigint generated always as identity primary key, submission_id uuid not null references public.ig_kyc_submissions(id),
 actor_id uuid, action text not null, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index ig_kyc_audit_submission on public.ig_kyc_audit(submission_id,created_at);
create table public.ig_kyc_workers (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), name text not null,
 enabled boolean not null default true, expires_at timestamptz not null, last_seen_at timestamptz
);
-- No direct Data API access even for administrative browser sessions. Edge revalidates roles.
alter table public.ig_kyc_submissions enable row level security;
alter table public.ig_kyc_audit enable row level security;
alter table public.ig_kyc_workers enable row level security;
revoke all on public.ig_kyc_submissions, public.ig_kyc_audit, public.ig_kyc_workers from public,anon,authenticated;
grant all on public.ig_kyc_submissions, public.ig_kyc_audit, public.ig_kyc_workers to service_role;
grant usage,select on sequence public.ig_kyc_audit_id_seq to service_role;
create policy kyc_backend_only on public.ig_kyc_submissions for all to anon,authenticated using(false) with check(false);
create policy kyc_audit_backend_only on public.ig_kyc_audit for all to anon,authenticated using(false) with check(false);
create policy kyc_worker_backend_only on public.ig_kyc_workers for all to anon,authenticated using(false) with check(false);
-- A dedicated bucket avoids changing the existing legacy KYC bucket or its data.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ig-kyc-evidence','ig-kyc-evidence',false,8388608,array['image/jpeg','image/png','image/webp']);
-- No client storage policies. Short-lived URLs are issued only by the authorized Edge handler.

create function public.ig_kyc_action(p_actor uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 s public.ig_kyc_submissions; actor_role text; staff boolean:=false; result jsonb;
 sid uuid; outcome text; expected integer; evidence_kind text; event_detail jsonb:='{}';
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service only' using errcode='42501';end if;
 if p_action like 'worker_%' then
  if not exists(select 1 from public.ig_kyc_workers where token_hash=p_payload->>'token_hash' and enabled and expires_at>now()) then
   raise exception 'Worker denied' using errcode='42501';
  end if;
  update public.ig_kyc_workers set last_seen_at=now() where token_hash=p_payload->>'token_hash';
  if p_action='worker_claim' then
   select * into s from public.ig_kyc_submissions where face_consent and status in ('submitted','escalated')
    and evidence_deleted_at is null and expires_at>now() and face_result is null and face_attempts<3
    and (face_lease_until is null or face_lease_until<now()) order by created_at for update skip locked limit 1;
   if not found then return null;end if;
   update public.ig_kyc_submissions set face_lease=gen_random_uuid(),face_lease_until=now()+interval '5 minutes',face_attempts=face_attempts+1 where id=s.id returning * into s;
   return jsonb_build_object('id',s.id,'lease',s.face_lease,'evidence',s.evidence);
  elsif p_action='worker_finish' then
   select * into s from public.ig_kyc_submissions where id=(p_payload->>'id')::uuid for update;
   if not found or s.face_lease is distinct from (p_payload->>'lease')::uuid or s.face_lease_until<now()
      or s.expires_at<=now() or s.status not in ('submitted','escalated') then raise exception 'Lease expired' using errcode='40001';end if;
   update public.ig_kyc_submissions set face_result=p_payload->'result',face_lease=null,face_lease_until=null,updated_at=now() where id=s.id;
   insert into public.ig_kyc_audit(submission_id,action) values(s.id,'advisory_comparison');
   return jsonb_build_object('saved',true);
  elsif p_action='worker_expired' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',id,'evidence',evidence)) from
    (select id,evidence from public.ig_kyc_submissions where evidence_deleted_at is null and expires_at<=now() and (upload_valid_until is null or upload_valid_until<=now()) order by expires_at limit 10) x),'[]');
  elsif p_action='worker_purged' then
   select * into s from public.ig_kyc_submissions where id=(p_payload->>'id')::uuid and expires_at<=now() and (upload_valid_until is null or upload_valid_until<=now()) for update;
   if not found then raise exception 'Not expired' using errcode='22023';end if;
   update public.ig_kyc_submissions set evidence='{}',face_result=null,full_name='Deleted',birth_date='1900-01-01',
    review_reason=null,customer_message=null,evidence_deleted_at=now(),face_lease=null,face_lease_until=null,
    status=case when status in ('draft','submitted','escalated') then 'expired' else status end,updated_at=now() where id=s.id;
   insert into public.ig_kyc_audit(submission_id,action) values(s.id,'evidence_deleted');
   return jsonb_build_object('deleted',true);
  end if;
  raise exception 'Unknown worker action' using errcode='22023';
 end if;
 select r.role into actor_role from public.user_roles r join public.profiles p on p.id=r.user_id
  where r.user_id=p_actor and p.is_excluded=false;
 if actor_role is null or actor_role='tester' then raise exception 'Account ineligible' using errcode='42501';end if;
 staff:=actor_role in ('admin','superadmin');
 if p_action='mine' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,status,revision,document_type,country,face_consent,created_at,submitted_at,reviewed_at,expires_at,customer_message,evidence_deleted_at from public.ig_kyc_submissions where user_id=p_actor order by created_at desc limit 20) x),'[]');
 elsif p_action='queue' then
  if not staff then raise exception 'Reviewer required' using errcode='42501';end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,user_id,status,revision,document_type,country,created_at,submitted_at,reviewed_at,expires_at,evidence_deleted_at from public.ig_kyc_submissions order by created_at desc limit 100) x),'[]');
 elsif p_action='begin' then
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,825));
  if exists(select 1 from public.ig_kyc_submissions where user_id=p_actor and status in ('draft','submitted','escalated')) then raise exception 'Open submission exists' using errcode='23505';end if;
  if (select count(*) from public.ig_kyc_submissions where user_id=p_actor and created_at>now()-interval '24 hours')>=3 then raise exception 'Daily limit reached' using errcode='54000';end if;
  if p_payload->>'consent_version' is distinct from '2026-10-22' or (p_payload->>'consent')::boolean is distinct from true
    or (p_payload->>'birth_date')::date>current_date or (p_payload->>'birth_date')::date<current_date-interval '125 years' then raise exception 'Invalid consent or birth date' using errcode='22023';end if;
  insert into public.ig_kyc_submissions(user_id,full_name,birth_date,country,document_type,consent_version,face_consent)
  values(p_actor,btrim(p_payload->>'full_name'),(p_payload->>'birth_date')::date,p_payload->>'country',p_payload->>'document_type',p_payload->>'consent_version',coalesce((p_payload->>'face_consent')::boolean,false)) returning * into s;
  insert into public.ig_kyc_audit(submission_id,actor_id,action) values(s.id,p_actor,'created');
  return jsonb_build_object('id',s.id,'status',s.status,'revision',s.revision,'document_type',s.document_type,'expires_at',s.expires_at);
 end if;
 sid:=(p_payload->>'id')::uuid;
 select * into s from public.ig_kyc_submissions where id=sid for update;
 if not found or (s.user_id<>p_actor and not staff) then raise exception 'Submission unavailable' using errcode='P0002';end if;
 if p_action='detail' then
  if not staff then raise exception 'Reviewer required' using errcode='42501';end if;
  insert into public.ig_kyc_audit(submission_id,actor_id,action) values(s.id,p_actor,'review_opened');
  return to_jsonb(s)-array['face_lease','face_lease_until'] || jsonb_build_object('audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select actor_id,action,detail,created_at from public.ig_kyc_audit where submission_id=s.id order by created_at desc limit 50) a),'[]'));
 elsif p_action='evidence' then
  if s.expires_at<=now() or s.evidence_deleted_at is not null or not staff or s.status='draft' then raise exception 'Evidence unavailable' using errcode='42501';end if;
  evidence_kind:=p_payload->>'kind';
  if not s.evidence ? evidence_kind then raise exception 'Evidence missing' using errcode='P0002';end if;
  insert into public.ig_kyc_audit(submission_id,actor_id,action,detail) values(s.id,p_actor,'evidence_viewed',jsonb_build_object('kind',evidence_kind));
  return s.evidence->evidence_kind;
 elsif p_action='upload' then
  if s.user_id<>p_actor or s.status<>'draft' or s.expires_at<=now() then raise exception 'Upload denied' using errcode='42501';end if;
  if s.created_at<now()-interval '24 hours' then raise exception 'Draft expired' using errcode='22023';end if;
  -- Signed upload URLs last two hours. Delay physical deletion until every
  -- issued upload token has expired, so cancelled drafts cannot be recreated.
  update public.ig_kyc_submissions set upload_valid_until=greatest(coalesce(upload_valid_until,now()),now()+interval '121 minutes') where id=s.id;
  return jsonb_build_object('id',s.id,'user_id',s.user_id,'document_type',s.document_type);
 elsif p_action='submit' then
  if s.user_id<>p_actor or s.status<>'draft' or s.expires_at<=now() then raise exception 'Submit denied' using errcode='42501';end if;
  if not (p_payload->'evidence' ?& array['id_front','selfie']) or (s.document_type<>'passport' and not (p_payload->'evidence' ? 'id_back')) then raise exception 'Missing evidence' using errcode='22023';end if;
  update public.ig_kyc_submissions set evidence=p_payload->'evidence',status='submitted',submitted_at=now(),updated_at=now(),revision=revision+1 where id=s.id returning * into s;
  insert into public.ig_kyc_audit(submission_id,actor_id,action) values(s.id,p_actor,'submitted');
 elsif p_action='cancel' then
  if s.user_id<>p_actor or s.status not in ('draft','submitted','escalated') then raise exception 'Cancel denied' using errcode='42501';end if;
  update public.ig_kyc_submissions set status='cancelled',expires_at=now(),updated_at=now(),revision=revision+1 where id=s.id returning * into s;
  insert into public.ig_kyc_audit(submission_id,actor_id,action) values(s.id,p_actor,'cancelled');
 elsif p_action='review' then
  if not staff or s.user_id=p_actor then raise exception 'Independent reviewer required' using errcode='42501';end if;
  if s.status not in ('submitted','escalated') or s.expires_at<=now() or s.evidence_deleted_at is not null then raise exception 'Submission cannot be reviewed' using errcode='22023';end if;
  if s.revision is distinct from (p_payload->>'revision')::integer then raise exception 'Review changed' using errcode='40001';end if;
  outcome:=p_payload->>'outcome';
  if outcome not in ('approved','rejected','needs_changes','escalated') or length(btrim(coalesce(p_payload->>'reason',''))) not between 10 and 1000 then raise exception 'Review reason required' using errcode='22023';end if;
  if outcome='approved' and (p_payload->'checks' is null or not (p_payload->'checks' @> '{"document_authenticity":true,"selfie_match":true,"age_review":true,"liveness_review":true}')) then raise exception 'Independent checks required' using errcode='22023';end if;
  update public.ig_kyc_submissions set status=outcome,reviewer_id=p_actor,review_reason=p_payload->>'reason',customer_message=left(p_payload->>'customer_message',500),reviewed_at=now(),updated_at=now(),revision=revision+1 where id=s.id returning * into s;
  insert into public.ig_kyc_audit(submission_id,actor_id,action,detail) values(s.id,p_actor,'review_'||outcome,jsonb_build_object('checks',p_payload->'checks','revision',s.revision));
  -- Manual identity verification does not authorize settlements, payments or exports.
  insert into public.kyc_verifications(user_id,provider,external_session_id,status,document_verified,selfie_verified,provider_updated_at)
  values(s.user_id,'imperial_manual_review',s.id::text,case when outcome='approved' then 'verified' when outcome='rejected' then 'rejected' else 'needs_review' end,outcome='approved',outcome='approved',now())
  on conflict(user_id) do update set provider=excluded.provider,external_session_id=excluded.external_session_id,status=excluded.status,document_verified=excluded.document_verified,selfie_verified=excluded.selfie_verified,provider_updated_at=now(),updated_at=now();
  update public.profiles set kyc_status=case when outcome='approved' then 'approved' when outcome='rejected' then 'rejected' else 'pending_review' end where id=s.user_id;
 else raise exception 'Unknown action' using errcode='22023';
 end if;
 return jsonb_build_object('id',s.id,'status',s.status,'revision',s.revision);
end $$;
revoke all on function public.ig_kyc_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ig_kyc_action(uuid,text,jsonb) to service_role;
comment on table public.ig_kyc_submissions is 'Private human-reviewed identity intake. Evidence expires after 30 days; comparisons are advisory. No financial authorization or external export.';