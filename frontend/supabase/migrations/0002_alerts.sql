-- Health alerts that have been sent, so each problem is announced once (and re-sent at most
-- every ALERT_REPEAT_HOURS) and a "resolved" message goes out when it clears.
create table public.alert_log (
  key text primary key,
  severity text not null,
  message text not null,
  first_seen_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);

alter table public.alert_log enable row level security;
