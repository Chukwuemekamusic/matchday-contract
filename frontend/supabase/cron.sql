-- Schedules the keeper. Run once in the Supabase SQL editor AFTER deploying the app.
-- Replace the two placeholder values first.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-APP.vercel.app', 'matchday_app_url');
select vault.create_secret('YOUR_KEEPER_CRON_SECRET', 'matchday_cron_secret');

create or replace function public.call_keeper(path text)
returns bigint
language sql
security definer
set search_path = public
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'matchday_app_url') || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'matchday_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$;

revoke all on function public.call_keeper(text) from public, anon, authenticated;

-- Resolve / cancel finished matches every 10 minutes (also keeps the free project awake)
select cron.schedule('matchday-resolve', '*/10 * * * *', $$ select public.call_keeper('/api/keeper/resolve') $$);

-- Refresh fixtures four times a day
select cron.schedule('matchday-sync-fixtures', '7 */6 * * *', $$ select public.call_keeper('/api/keeper/sync-fixtures') $$);

-- Inspect: select * from cron.job_run_details order by start_time desc limit 20;
--          select * from net._http_response order by created desc limit 20;
