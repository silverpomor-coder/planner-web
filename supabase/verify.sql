-- Read-only authorization checks; the transaction is rolled back.
-- Run after the owner has signed in and the private files have been imported.
begin;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select public.planner_is_owner() as anonymous_must_be_false;
select count(*) as anonymous_visible_objects_must_be_zero
from storage.objects where bucket_id = 'planner-private';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.planner_is_owner() as unrelated_user_must_be_false;
select count(*) as unrelated_visible_objects_must_be_zero
from storage.objects where bucket_id = 'planner-private';
reset role;
select set_config('request.jwt.claims', json_build_object('sub',identity.user_id::text,'role','authenticated')::text, true)
from auth.identities identity where provider = 'github' and provider_id = '279652106' limit 1;
set local role authenticated;
select public.planner_is_owner() as owner_must_be_true;
select count(*) as owner_visible_objects_must_be_61
from storage.objects where bucket_id = 'planner-private';
reset role;
rollback;
