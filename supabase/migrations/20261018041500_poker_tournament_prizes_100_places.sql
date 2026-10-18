-- Staging prize ladders: configurable 1..100 finish positions, no payment authorizations.
alter table public.ig_poker_tournament_presets
 add column if not exists payout_asset text not null default 'PRACTICE',
 add column if not exists payout_display_asset text not null default 'USD',
 add column if not exists paid_places integer not null default 0,
 add column if not exists payout_revision integer not null default 0;
alter table public.ig_poker_tournament_presets add constraint ig_poker_paid_places_range
 check(paid_places between 0 and 100 and paid_places<=seats_per_table*table_count);
alter table public.ig_poker_tournament_presets add constraint ig_poker_payout_assets_valid
 check(payout_asset in ('PRACTICE','IC','ID','IGD','IGN','USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','ADA','XRP','LTC','BNB','USDC','USDT','XMR','ARB','OP','POL','DOGE','ZEPH')
 and payout_display_asset in ('USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','USDC','USDT'));
create table if not exists public.ig_poker_tournament_awards(
 preset_id uuid not null references public.ig_poker_tournament_presets(id) on delete cascade,
 place integer not null check(place between 1 and 100),
 amount numeric(30,12) not null check(amount>0 and amount<=1000000000),
 asset text not null,
 primary key(preset_id,place)
);
create table if not exists public.ig_poker_tournament_award_audit(
 id bigint generated always as identity primary key,
 preset_id uuid not null references public.ig_poker_tournament_presets(id),
 edited_by uuid not null references auth.users(id),
 revision integer not null,
 edited_at timestamptz not null default now(),
 old_plan jsonb not null,
 new_plan jsonb not null,
 plan_hash text not null,
 constraint ig_poker_award_revision_unique unique(preset_id,revision)
);
alter table public.ig_poker_tournament_awards enable row level security;
alter table public.ig_poker_tournament_award_audit enable row level security;
revoke all on public.ig_poker_tournament_awards from public,anon,authenticated;
revoke all on public.ig_poker_tournament_award_audit from public,anon,authenticated;
grant select,insert,update,delete on public.ig_poker_tournament_awards to service_role;
grant select,insert on public.ig_poker_tournament_award_audit to service_role;
grant usage,select on sequence public.ig_poker_tournament_award_audit_id_seq to service_role;
create or replace function public.ig_poker_tournament_awards_save(
 p_actor uuid,p_preset uuid,p_payout_asset text,p_display_asset text,p_awards jsonb,
 p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ig_poker_tournament_presets%rowtype;
 v_role text;v_count int;v_i int:=0;v_amount numeric(30,12);v_place int;
 v_total numeric(34,12):=0; v_previous jsonb;v_hash text;v_entry record;
begin
 select ur.role::text into v_role from public.user_roles ur
 join public.profiles pr on pr.id=ur.user_id where ur.user_id=p_actor and pr.is_excluded=false;
 if v_role is distinct from 'superadmin' then raise exception 'SUPERADMIN_REQUIRED' using errcode='42501';end if;
 select * into p from public.ig_poker_tournament_presets where id=p_preset for update;
 if not found or p.status<>'draft' then raise exception 'PRESET_DRAFT_REQUIRED' using errcode='22023';end if;
 if p_expected_revision is distinct from p.payout_revision then raise exception 'PAYOUT_REVISION_CONFLICT' using errcode='40001';end if;
 if p_payout_asset not in ('PRACTICE','IC','ID','IGD','IGN','USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','ADA','XRP','LTC','BNB','USDC','USDT','XMR','ARB','OP','POL','DOGE','ZEPH')
 or p_display_asset not in ('USD','EUR','GBP','CAD','AUD','JPY','CHF','BTC','ETH','SOL','USDC','USDT')
 or jsonb_typeof(p_awards)<>'array' then raise exception 'INVALID_PAYOUT_SETTINGS' using errcode='22023';end if;
 v_count=jsonb_array_length(p_awards);
 if v_count>least(100,p.seats_per_table*p.table_count) then raise exception 'TOO_MANY_PAID_PLACES' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('position',place,'amount',amount::text,'asset',asset) order by place),'[]'::jsonb)
 into v_previous from public.ig_poker_tournament_awards where preset_id=p_preset;
 -- Arrays must be ordered, contiguous and one entry per finishing position.
 for v_entry in select value,ordinality from jsonb_array_elements(p_awards) with ordinality loop
  v_i:=v_i+1;
  if jsonb_typeof(v_entry.value)<>'object' then raise exception 'INVALID_AWARD_ROW' using errcode='22023';end if;
  v_place:=(v_entry.value->>'position')::integer;
  v_amount:=(v_entry.value->>'amount')::numeric;
  if v_place<>v_i or v_amount is null or v_amount<=0 or v_amount>1000000000
   or scale(v_amount)>12 then raise exception 'INVALID_AWARD_POSITION_OR_AMOUNT' using errcode='22023';end if;
  v_total:=v_total+v_amount;
 end loop;
 delete from public.ig_poker_tournament_awards where preset_id=p_preset;
 for v_entry in select value,ordinality from jsonb_array_elements(p_awards) with ordinality loop
  insert into public.ig_poker_tournament_awards(preset_id,place,amount,asset)
  values(p_preset,(v_entry.value->>'position')::int,(v_entry.value->>'amount')::numeric,p_payout_asset);
 end loop;
 update public.ig_poker_tournament_presets set payout_asset=p_payout_asset,
 payout_display_asset=p_display_asset,paid_places=v_count,payout_revision=payout_revision+1,updated_at=clock_timestamp()
 where id=p_preset returning * into p;
 v_hash:=encode(extensions.digest(p_awards::text||':'||p_payout_asset||':'||p_display_asset,'sha256'),'hex');
 insert into public.ig_poker_tournament_award_audit(preset_id,edited_by,revision,old_plan,new_plan,plan_hash)
 values(p_preset,p_actor,p.payout_revision,v_previous,p_awards,v_hash);
 return jsonb_build_object('presetId',p_preset,'paidPlaces',v_count,'payoutAsset',p_payout_asset,
 'displayAsset',p_display_asset,'totalAmount',v_total::text,'revision',p.payout_revision,
 'planHash',v_hash,'payoutsActivated',false,'practiceOnly',true);
end $$;
revoke all on function public.ig_poker_tournament_awards_save(uuid,uuid,text,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.ig_poker_tournament_awards_save(uuid,uuid,text,text,jsonb,integer) to service_role;
