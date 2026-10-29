-- Dashboard data is accessible only to trusted server code. Apply in one transaction.
begin;
do $$
declare t text; p record;
begin
 foreach t in array array['conversations','messages','website_visitors','website_page_history'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
  execute format('grant all privileges on table public.%I to service_role', t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime drop table public.%I',t);
  end if;
 end loop;
end $$;
commit;
