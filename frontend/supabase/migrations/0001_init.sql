-- MatchDay: fixtures from football-data.org and the on-chain matches created for them.

create table public.fixtures (
  id bigint primary key,                 -- football-data.org match id
  competition_code text not null,
  competition_name text not null,
  competition_emblem text,
  home_team text not null,
  home_short text,
  home_crest text,
  away_team text not null,
  away_short text,
  away_crest text,
  kickoff_at timestamptz not null,
  status text not null,                  -- football-data status (SCHEDULED, TIMED, FINISHED, ...)
  home_score int,                        -- score after regulation time
  away_score int,
  updated_at timestamptz not null default now()
);

create index fixtures_kickoff_idx on public.fixtures (kickoff_at);

-- One row per createMatch attempt. A fixture can get a new on-chain match
-- after a previous one was cancelled (e.g. postponed and rescheduled).
create table public.onchain_matches (
  id bigserial primary key,
  fixture_id bigint not null references public.fixtures (id),
  match_id bigint unique,                -- on-chain match id, null until createMatch is mined
  kickoff_at timestamptz not null,       -- kickoff passed to createMatch (when betting closes on-chain)
  state text not null check (state in ('creating', 'open', 'resolved', 'cancelled', 'failed')),
  create_tx_hash text,                   -- saved before broadcasting, so a crash never double-creates
  result smallint,                       -- Outcome enum once resolved
  settle_tx_hash text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one live (creating/open) on-chain match per fixture: this is the creation lock.
create unique index onchain_matches_one_active_per_fixture
  on public.onchain_matches (fixture_id)
  where state in ('creating', 'open');

create index onchain_matches_state_idx on public.onchain_matches (state);

create table public.keeper_runs (
  id bigserial primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  summary jsonb
);

-- The app talks to the database with the service role key from the server only.
-- RLS with no policies keeps the anon key from reading or writing anything.
alter table public.fixtures enable row level security;
alter table public.onchain_matches enable row level security;
alter table public.keeper_runs enable row level security;
