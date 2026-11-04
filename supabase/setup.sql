-- Run in the SQL Editor of the dedicated planner-web Supabase project.
-- This script contains no personal trip data and no secrets.
begin;
create or replace function public.planner_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.identities as identity
    where identity.user_id = (select auth.uid())
      and identity.provider = 'github'
      and identity.provider_id = '279652106'
  );
$$;
revoke all on function public.planner_is_owner() from public;
grant execute on function public.planner_is_owner() to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('planner-private', 'planner-private', false, 52428800)
on conflict (id) do update set public = false;

-- A restrictive policy also blocks an unrelated broad permissive policy.
drop policy if exists planner_bucket_guard on storage.objects;
create policy planner_bucket_guard on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'planner-private' or (select public.planner_is_owner()))
with check (bucket_id <> 'planner-private' or (select public.planner_is_owner()));

drop policy if exists planner_owner_read on storage.objects;
create policy planner_owner_read on storage.objects
for select to authenticated
using (bucket_id = 'planner-private' and (select public.planner_is_owner()));

drop policy if exists planner_owner_insert on storage.objects;
create policy planner_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'planner-private' and (select public.planner_is_owner()));

drop policy if exists planner_owner_update on storage.objects;
create policy planner_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'planner-private' and (select public.planner_is_owner()))
with check (bucket_id = 'planner-private' and (select public.planner_is_owner()));
commit;
