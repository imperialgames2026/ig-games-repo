-- Configuration only. No customer accounts, balances, history or XP are imported.
create table public.ig_vip_catalog (
 id smallint primary key check (id=1),
 levels jsonb not null,
 revision bigint not null default 1 check (revision>0),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.ig_vip_catalog enable row level security;
revoke all on public.ig_vip_catalog from public,anon,authenticated;
grant select(id,levels,revision,updated_at) on public.ig_vip_catalog to anon,authenticated;
grant update(levels) on public.ig_vip_catalog to authenticated;
grant all on public.ig_vip_catalog to service_role;
create policy vip_catalog_read on public.ig_vip_catalog for select to anon,authenticated using (true);
create policy vip_catalog_superadmin_update on public.ig_vip_catalog for update to authenticated
 using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

-- Private immutable revision history. Actor IDs are not part of the public catalog.
create table internal.vip_catalog_history (
 revision bigint primary key,
 levels jsonb not null,
 changed_at timestamptz not null,
 changed_by uuid
);
alter table internal.vip_catalog_history enable row level security;
revoke all on internal.vip_catalog_history from public,anon,authenticated;
create policy vip_history_backend_only on internal.vip_catalog_history as restrictive for all
 to anon,authenticated using (false) with check (false);
grant select on internal.vip_catalog_history to service_role;

create function internal.validate_and_audit_vip_catalog() returns trigger
language plpgsql security definer set search_path=''
as $function$
declare item jsonb; position integer:=0; previous_xp numeric:=-1; xp numeric;
begin
 if jsonb_typeof(new.levels) is distinct from 'array' then
  raise exception 'VIP schedule must be an array' using errcode='23514';
 end if;
 if jsonb_array_length(new.levels)<>34 then
  raise exception 'VIP schedule must have 34 levels' using errcode='23514';
 end if;
 for item in select value from jsonb_array_elements(new.levels) loop
  position:=position+1;
  if jsonb_typeof(item) is distinct from 'object' then
   raise exception 'Invalid VIP level' using errcode='23514';
  end if;
  if not (item ?& array['level','name','tier','xp_required']) or
   item-array['level','name','tier','xp_required']<>'{}'::jsonb or
   jsonb_typeof(item->'level') is distinct from 'number' or
   item->'level'<>to_jsonb(position) or
   jsonb_typeof(item->'name') is distinct from 'string' or
   (item->>'name') !~ '^[A-Za-z][A-Za-z0-9 ]{0,79}$' or
   item->>'name'<>btrim(item->>'name') or
   jsonb_typeof(item->'tier') is distinct from 'string' or
   item->>'tier' not in ('Beginner','Bronze','Silver','Gold','Platinum','Diamond','Eternal') or
   jsonb_typeof(item->'xp_required') is distinct from 'number' then
   raise exception 'Invalid VIP level fields' using errcode='23514';
  end if;
  xp:=(item->>'xp_required')::numeric;
  if xp<>trunc(xp) or xp<=previous_xp or xp>9007199254740991 or (position=1 and xp<>0) then
   raise exception 'VIP XP must be increasing whole numbers starting at zero' using errcode='23514';
  end if;
  previous_xp:=xp;
 end loop;
 if tg_op='UPDATE' then new.revision:=old.revision+1; else new.revision:=1; end if;
 new.updated_at:=clock_timestamp();
 new.updated_by:=auth.uid();
 insert into internal.vip_catalog_history(revision,levels,changed_at,changed_by)
 values(new.revision,new.levels,new.updated_at,new.updated_by);
 return new;
end;
$function$;
revoke all on function internal.validate_and_audit_vip_catalog() from public,anon,authenticated,service_role;
create trigger vip_catalog_validate_audit before insert or update on public.ig_vip_catalog
 for each row execute function internal.validate_and_audit_vip_catalog();

insert into public.ig_vip_catalog(id,levels) values (1,$seed$[{"level":1,"name":"Beginner","xp_required":0,"tier":"Beginner"},{"level":2,"name":"Bronze I","xp_required":1000,"tier":"Bronze"},{"level":3,"name":"Bronze II","xp_required":3000,"tier":"Bronze"},{"level":4,"name":"Bronze III","xp_required":7000,"tier":"Bronze"},{"level":5,"name":"Bronze IV","xp_required":15000,"tier":"Bronze"},{"level":6,"name":"Silver I","xp_required":30000,"tier":"Silver"},{"level":7,"name":"Silver II","xp_required":60000,"tier":"Silver"},{"level":8,"name":"Silver III","xp_required":120000,"tier":"Silver"},{"level":9,"name":"Silver IV","xp_required":240000,"tier":"Silver"},{"level":10,"name":"Gold I","xp_required":500000,"tier":"Gold"},{"level":11,"name":"Gold II","xp_required":1000000,"tier":"Gold"},{"level":12,"name":"Gold III","xp_required":2000000,"tier":"Gold"},{"level":13,"name":"Gold IV","xp_required":3500000,"tier":"Gold"},{"level":14,"name":"Platinum I","xp_required":6000000,"tier":"Platinum"},{"level":15,"name":"Platinum II","xp_required":8500000,"tier":"Platinum"},{"level":16,"name":"Platinum III","xp_required":11000000,"tier":"Platinum"},{"level":17,"name":"Platinum IV","xp_required":15000000,"tier":"Platinum"},{"level":18,"name":"Diamond I","xp_required":25000000,"tier":"Diamond"},{"level":19,"name":"Diamond II","xp_required":40000000,"tier":"Diamond"},{"level":20,"name":"Diamond III","xp_required":65000000,"tier":"Diamond"},{"level":21,"name":"Diamond IV","xp_required":110000000,"tier":"Diamond"},{"level":22,"name":"Diamond V","xp_required":200000000,"tier":"Diamond"},{"level":23,"name":"Diamond VI","xp_required":400000000,"tier":"Diamond"},{"level":24,"name":"Diamond VII","xp_required":1000000000,"tier":"Diamond"},{"level":25,"name":"Eternal I","xp_required":1500000000,"tier":"Eternal"},{"level":26,"name":"Eternal II","xp_required":2200000000,"tier":"Eternal"},{"level":27,"name":"Eternal III","xp_required":3200000000,"tier":"Eternal"},{"level":28,"name":"Eternal IV","xp_required":4500000000,"tier":"Eternal"},{"level":29,"name":"Eternal V","xp_required":6000000000,"tier":"Eternal"},{"level":30,"name":"Eternal VI","xp_required":7200000000,"tier":"Eternal"},{"level":31,"name":"Eternal VII","xp_required":8300000000,"tier":"Eternal"},{"level":32,"name":"Eternal VIII","xp_required":9000000000,"tier":"Eternal"},{"level":33,"name":"Eternal IX","xp_required":9500000000,"tier":"Eternal"},{"level":34,"name":"Eternal X","xp_required":10000000000,"tier":"Eternal"}]$seed$::jsonb);
