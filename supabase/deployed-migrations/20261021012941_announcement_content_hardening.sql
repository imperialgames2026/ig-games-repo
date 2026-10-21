-- Pending: preserve existing rows and published migration checksums.
alter table public.ig_announcements alter column is_active set default false;

-- Validate inserts, changed links, and publication transitions. Unchanged legacy
-- URLs remain archivable/editable without rewriting stored content.
create function internal.validate_announcement_content() returns trigger
language plpgsql security invoker set search_path='' as $$
declare value text; authority text; host text; port text; label text; character text; code integer; parts text[];
begin
 if TG_OP='UPDATE' then
  if new.link_url is not distinct from old.link_url and not(new.is_active and not old.is_active) then return new; end if;
 end if;
 value:=new.link_url;
 if value is null then return new; end if;
 if length(value)>2048 or position(chr(92) in value)>0 then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 foreach character in array regexp_split_to_array(value,'') loop
  code:=ascii(character);
  if code between 0 and 32 or code=127 or code in (160,5760,8232,8233,8239,8287,12288,65279) or code between 8192 and 8202 then
   raise exception 'Invalid announcement link' using errcode='23514';
  end if;
 end loop;
 if value ~ '^/($|[A-Za-z0-9])' then return new; end if;
 authority:=substring(value from '^https://([^/?#]+)(?:[/?#].*)?$');
 if authority is null then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 parts:=string_to_array(authority,':');
 if cardinality(parts)>2 then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 host:=parts[1]; port:=parts[2];
 if length(host)>253 then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 foreach label in array string_to_array(host,'.') loop
  if label !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$' then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 end loop;
 if label !~ '[A-Za-z]' then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 if port is not null then
  if port !~ '^[0-9]{1,5}$' then raise exception 'Invalid announcement link' using errcode='23514'; end if;
  if port::integer>65535 then raise exception 'Invalid announcement link' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function internal.validate_announcement_content() from public,anon,authenticated;
create trigger announcement_content_validation before insert or update on public.ig_announcements
for each row execute function internal.validate_announcement_content();
notify pgrst,'reload schema';
