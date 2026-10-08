-- Accounts, free picks, groups and Telegram channel bookkeeping.
-- All tables are accessed only by the app server (service role); RLS without policies keeps
-- the public (publishable) key from reading or writing them.

-- ---------- Profiles (one per Supabase Auth user) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Create a profile for every new user (Google, email or Telegram sign-in)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'telegram_username', ''),
    case when new.email like '%@telegram.example.com' then null else split_part(new.email, '@', 1) end,
    'Fan'
  );
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'fan_' || substr(replace(new.id::text, '-', ''), 1, 8),
    left(name, 30),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Wallets linked to an account (proved by signature) ----------
create table public.wallets (
  address text primary key check (address ~ '^0x[0-9a-f]{40}$'), -- lowercase
  user_id uuid not null references public.profiles (id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index wallets_user_idx on public.wallets (user_id);

-- ---------- Free picks ----------
create table public.picks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  fixture_id bigint not null references public.fixtures (id),
  prediction smallint not null check (prediction between 1 and 3), -- 1 home, 2 draw, 3 away
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  result text check (result in ('won', 'lost', 'void')),
  points int,
  settled_at timestamptz,
  primary key (user_id, fixture_id)
);
create index picks_fixture_idx on public.picks (fixture_id);
create index picks_unsettled_idx on public.picks (fixture_id) where settled_at is null;
create index picks_user_settled_idx on public.picks (user_id, settled_at desc);

-- Pick counts per fixture and outcome (social proof on lists and match pages)
create or replace function public.fixture_pick_counts(fixture_ids bigint[])
returns table (fixture_id bigint, prediction smallint, picks bigint)
language sql stable
set search_path = public
as $$
  select p.fixture_id, p.prediction, count(*)
  from picks p
  where p.fixture_id = any (fixture_ids)
  group by 1, 2
$$;

-- ---------- Groups ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  invite_code text not null unique,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Points table for settled free picks, optionally since a date and/or within a group
create or replace function public.points_table(since timestamptz default null, member_of uuid default null, max_rows int default 100)
returns table (user_id uuid, username text, display_name text, avatar_url text, points bigint, played bigint, won bigint)
language sql stable
set search_path = public
as $$
  select p.user_id, pr.username, pr.display_name, pr.avatar_url,
         sum(p.points), count(*), count(*) filter (where p.result = 'won')
  from picks p
  join profiles pr on pr.id = p.user_id
  where p.settled_at is not null
    and p.result <> 'void'
    and (since is null or p.settled_at >= since)
    and (member_of is null or exists (
      select 1 from group_members gm where gm.group_id = member_of and gm.user_id = p.user_id))
  group by 1, 2, 3, 4
  order by 5 desc, 7 desc, 6 asc, 2 asc
  limit max_rows
$$;

-- ---------- Telegram channel posts already sent (dedupe) ----------
create table public.channel_posts (
  key text primary key,
  posted_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.picks enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.channel_posts enable row level security;

-- Functions are for the app server only
revoke all on function public.fixture_pick_counts(bigint[]) from public, anon, authenticated;
revoke all on function public.points_table(timestamptz, uuid, int) from public, anon, authenticated;
