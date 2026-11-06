-- Target: existing IG Network Lab tests (jvyzpxjqmymafjapprpp).
-- Campaign state is private; only the authenticated Edge Function's service client
-- can execute these RPCs. No poker, wallet, or wager relations are changed.
create schema ig_campaign_v1;
revoke all on schema ig_campaign_v1 from public, anon, authenticated;
grant usage on schema ig_campaign_v1 to service_role;

create table ig_campaign_v1.characters (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  creation_request_id uuid not null,
  creation_payload jsonb not null,
  name text not null check (char_length(name) between 1 and 32),
  rules_version text not null default 'imperial-d20-v1'
    check (rules_version = 'imperial-d20-v1'),
  character_data jsonb not null check (
    jsonb_typeof(character_data) = 'object' and
    octet_length(character_data::text) <= 16384
  ),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, creation_request_id)
);
comment on table ig_campaign_v1.characters is
  'Butcher lab characters. Backend-only practice data; no NFT ownership, currency, or wager authority.';
alter table ig_campaign_v1.characters enable row level security;
revoke all on table ig_campaign_v1.characters from public, anon, authenticated;
grant select, insert, update on table ig_campaign_v1.characters to service_role;
create policy campaign_characters_service_only on ig_campaign_v1.characters
  for all to service_role using (true) with check (true);
create index campaign_characters_owner_created_idx
  on ig_campaign_v1.characters(owner_user_id, created_at desc, id);

create function public.ig_campaign_characters_list_v1(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('characters', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'name', c.name, 'rulesVersion', c.rules_version,
      'characterData', c.character_data, 'revision', c.revision,
      'createdAt', c.created_at, 'updatedAt', c.updated_at
    ) order by c.created_at desc, c.id
  ), '[]'::jsonb))
  from ig_campaign_v1.characters c where c.owner_user_id = p_user_id;
$$;

create function public.ig_campaign_character_create_v1(
  p_user_id uuid, p_request_id uuid, p_character_data jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  c ig_campaign_v1.characters%rowtype;
begin
  if p_user_id is null or p_request_id is null or p_character_data is null
    or jsonb_typeof(p_character_data) <> 'object'
    or octet_length(p_character_data::text) > 16384
    or p_character_data->>'level' is distinct from '1'
    or p_character_data->>'name' is null
    or char_length(p_character_data->>'name') not between 1 and 32
  then raise exception 'Invalid character creation data' using errcode = '22023';
  end if;

  -- Serialize creation per account so parallel requests cannot exceed the cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('butcher:' || p_user_id::text, 0));
  select * into c from ig_campaign_v1.characters
    where owner_user_id = p_user_id and creation_request_id = p_request_id;
  if found then
    if c.creation_payload is distinct from p_character_data then
      raise exception 'Request ID reused with different data' using errcode = '22023';
    end if;
  else
    if (select count(*) from ig_campaign_v1.characters where owner_user_id = p_user_id) >= 10 then
      raise exception 'Character limit reached' using errcode = '23514';
    end if;
    insert into ig_campaign_v1.characters(owner_user_id, creation_request_id,
      creation_payload, name, character_data)
    values(p_user_id, p_request_id, p_character_data, p_character_data->>'name', p_character_data)
    returning * into c;
  end if;
  return jsonb_build_object('character', jsonb_build_object(
    'id', c.id, 'name', c.name, 'rulesVersion', c.rules_version,
    'characterData', c.character_data, 'revision', c.revision,
    'createdAt', c.created_at, 'updatedAt', c.updated_at
  ));
end;
$$;

revoke all on function public.ig_campaign_characters_list_v1(uuid) from public, anon, authenticated;
revoke all on function public.ig_campaign_character_create_v1(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.ig_campaign_characters_list_v1(uuid) to service_role;
grant execute on function public.ig_campaign_character_create_v1(uuid,uuid,jsonb) to service_role;
