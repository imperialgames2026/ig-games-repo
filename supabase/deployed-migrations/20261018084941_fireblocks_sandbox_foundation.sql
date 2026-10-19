-- Fireblocks Developer Sandbox connector. Never writes real wallet balances or enables financial rails.
-- Separate tables avoid treating an observed provider notification as settlement or as a player credit.
create table if not exists public.ig_fb_sandbox_vaults(
 user_id uuid primary key references auth.users(id),
 idempotency_key uuid not null unique default gen_random_uuid(),
 vault_id text unique,
 status text not null default 'reserved' check(status in ('reserved','provisioned','needs_reconciliation')),
 provisioned_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint sandbox_vault_id_present check(status<>'provisioned' or vault_id is not null)
);
create table if not exists public.ig_fb_sandbox_asset_wallets(
 user_id uuid not null references public.ig_fb_sandbox_vaults(user_id),
 asset_id text not null check(asset_id ~ '^[A-Z0-9_]{2,40}$'),
 idempotency_key uuid not null unique default gen_random_uuid(),
 vault_id text not null,
 deposit_address text,
 destination_tag text,
 status text not null default 'reserved' check(status in ('reserved','provisioned','awaiting_address_verification','needs_reconciliation')),
 requested_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,asset_id)
);
create table if not exists public.ig_fb_sandbox_webhook_inbox(
 notification_id uuid primary key,
 workspace_id text not null,
 event_type text not null,
 resource_id text,
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 verified_event jsonb not null,
 received_at timestamptz not null default clock_timestamp(),
 processing_status text not null default 'quarantined' check(processing_status='quarantined'),
 credited boolean not null default false check(credited=false),
 network_transfer_approved boolean not null default false check(network_transfer_approved=false)
);
create index if not exists ig_fb_sandbox_inbox_received_idx on public.ig_fb_sandbox_webhook_inbox(received_at desc);
create table if not exists public.ig_fb_sandbox_ops_audit(
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 subject_user_id uuid references auth.users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default clock_timestamp()
);
do $$
declare x text;
begin
 foreach x in array array['ig_fb_sandbox_vaults','ig_fb_sandbox_asset_wallets','ig_fb_sandbox_webhook_inbox','ig_fb_sandbox_ops_audit'] loop
 execute format('alter table public.%I enable row level security',x);
 execute format('revoke all on public.%I from public, anon, authenticated',x);
 execute format('grant select,insert,update on public.%I to service_role',x);
 end loop;
end $$;
grant usage,select on sequence public.ig_fb_sandbox_ops_audit_id_seq to service_role;

-- Single-row reservation; conflicts cannot create an additional vault / duplicate API request.
-- Only eligible Superadmins may initiate sandbox vault provisioning.
create or replace function public.ig_fb_reserve_sandbox_vault(
 p_actor uuid,p_subject uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_enabled boolean; v_row public.ig_fb_sandbox_vaults%rowtype; v_new boolean:=false;
begin
 select ur.role::text into v_role from public.user_roles ur join public.profiles p on p.id=ur.user_id
 where ur.user_id=p_actor and p.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 select not p.is_excluded into v_enabled from public.profiles p where p.id=p_subject;
 if v_enabled is distinct from true then raise exception 'PLAYER_NOT_ELIGIBLE' using errcode='22023';end if;
 insert into public.ig_fb_sandbox_vaults(user_id,provisioned_by)
 values(p_subject,p_actor)
 on conflict(user_id) do nothing returning * into v_row;
 if found then v_new:=true;
 else
 select * into v_row from public.ig_fb_sandbox_vaults where user_id=p_subject;
 end if;
 insert into public.ig_fb_sandbox_ops_audit(actor_id,subject_user_id,action,details)
 values(p_actor,p_subject,case when v_new then 'vault_reserved' else 'vault_existing' end,
 jsonb_build_object('status',v_row.status));
 return jsonb_build_object('newReservation',v_new,'status',v_row.status,
 'idempotencyKey',v_row.idempotency_key,'vaultId',v_row.vault_id);
end $$;

create or replace function public.ig_fb_reserve_sandbox_wallet(
 p_actor uuid,p_subject uuid,p_asset text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text; v_vault text; v_row public.ig_fb_sandbox_asset_wallets%rowtype; v_new boolean:=false;
begin
 select ur.role::text into v_role from public.user_roles ur join public.profiles p on p.id=ur.user_id
 where ur.user_id=p_actor and p.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 if p_asset is null or p_asset !~ '^[A-Z0-9_]{2,40}$' then raise exception 'INVALID_ASSET_ID' using errcode='22023';end if;
 select vault_id into v_vault from public.ig_fb_sandbox_vaults
 where user_id=p_subject and status='provisioned';
 if v_vault is null then raise exception 'SANDBOX_VAULT_NOT_PROVISIONED' using errcode='22023';end if;
 insert into public.ig_fb_sandbox_asset_wallets(user_id,asset_id,vault_id,requested_by)
 values(p_subject,p_asset,v_vault,p_actor)
 on conflict(user_id,asset_id) do nothing returning * into v_row;
 if found then v_new:=true;
 else
 select * into v_row from public.ig_fb_sandbox_asset_wallets where user_id=p_subject and asset_id=p_asset;
 end if;
 insert into public.ig_fb_sandbox_ops_audit(actor_id,subject_user_id,action,details)
 values(p_actor,p_subject,case when v_new then 'asset_wallet_reserved' else 'asset_wallet_existing' end,
 jsonb_build_object('assetId',p_asset,'status',v_row.status));
 return jsonb_build_object('newReservation',v_new,'status',v_row.status,'vaultId',v_row.vault_id,
 'idempotencyKey',v_row.idempotency_key,'depositAddress',v_row.deposit_address,'destinationTag',v_row.destination_tag);
end $$;

revoke all on function public.ig_fb_reserve_sandbox_vault(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ig_fb_reserve_sandbox_wallet(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ig_fb_reserve_sandbox_vault(uuid,uuid) to service_role;
grant execute on function public.ig_fb_reserve_sandbox_wallet(uuid,uuid,text) to service_role;

-- No grants to clients; no link to public.wallets or any deposit-credit/withdrawal-transaction procedure.


