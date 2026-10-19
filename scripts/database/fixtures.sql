-- Local database fixtures only. Wrapped in a transaction and rolled back by the runner.
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();p uuid:=gen_random_uuid();t uuid:=gen_random_uuid();begin
 insert into auth.users(id,email,role,aud) values(a,'sql-super-'||a||'@example.invalid','authenticated','authenticated'),(b,'sql-admin-'||b||'@example.invalid','authenticated','authenticated'),(p,'sql-player-'||p||'@example.invalid','authenticated','authenticated'),(t,'sql-tester-'||t||'@example.invalid','authenticated','authenticated');
 update public.profiles set role='superadmin' where id=a;
 update public.profiles set role='admin' where id=b;
 update public.profiles set role='tester' where id=t;
 update public.user_roles set role='superadmin' where user_id=a;
 update public.user_roles set role='admin' where user_id=b;
 update public.user_roles set role='tester' where user_id=t;
end $$;
