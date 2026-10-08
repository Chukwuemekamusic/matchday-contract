# MatchDay frontend

Public web app for the MatchDayBet contract on Base: browse fixtures, bet, and claim winnings.
It also contains the **keeper** — server routes that create matches on-chain lazily and settle them.

```
Browser ──wagmi/viem──▶ MatchDayBet (Base)          ◀── keeper wallet (match manager)
   │                          ▲                              ▲
   ├──▶ Next.js server ───────┘ createMatch on first bet     │ batchResolve / batchCancel
   │       └─▶ Supabase Postgres (fixtures, on-chain map)    │
   └──▶ Subgraph ("My bets" list)          Supabase pg_cron ─┘ calls /api/keeper/* on a schedule
```

## How matches get on-chain

1. `sync-fixtures` (every 6h) stores the next two weeks of fixtures from football-data.org in `fixtures`.
2. The first bet on a fixture calls `POST /api/matches/ensure`. The server inserts a `creating` row in
   `onchain_matches` — a partial unique index makes that insert a per-fixture lock — signs `createMatch`,
   saves the tx hash **before** broadcasting, and returns the new match id. The browser then sends `placeBet`.
   Only supported competitions, bettable statuses, and kickoffs between 3 minutes and 15 days away are accepted,
   so the most it can ever spend is one `createMatch` per fixture.
3. `resolve` (every 10 min) reconciles interrupted creations, fetches results for kicked-off matches, and calls
   `batchResolveMatches` (after the contract's grace period) or `batchCancelMatches` (postponed, cancelled,
   awarded, or suspended for over a day). Matches settle on the **90-minute score** (`regularTime` when a tie
   went to extra time), then the DB is updated from what the contract reports.

## Setup

1. **Supabase** (free tier): create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
2. **Keeper wallet**: create a new wallet, fund it with a little ETH on Base, and from the owner wallet call
   `addMatchManager(<keeper address>)` on the contract. Remove old bot managers with `removeMatchManager`.
3. **football-data.org**: get a free API key.
4. **Deploy** to Vercel with the variables from `.env.example` (root directory `frontend`).
5. **Schedule the keeper**: edit the two placeholders in `supabase/cron.sql` (app URL and `KEEPER_CRON_SECRET`)
   and run it in the Supabase SQL editor. Trigger a first fixture sync with
   `curl -X POST -H "Authorization: Bearer $KEEPER_CRON_SECRET" https://YOUR-APP/api/keeper/sync-fixtures`.

Keeper runs are logged in the `keeper_runs` table; pg_cron history is in `cron.job_run_details`.

## Social layer: accounts, free picks, groups

Run `supabase/migrations/0003_social.sql`, then in the Supabase dashboard:

- **Auth → Providers → Google**: enable with a Google OAuth client; add
  `https://YOUR-APP/auth/callback` to the redirect URLs (Auth → URL Configuration), plus `http://localhost:3000/auth/callback`.
- **Email** magic links work out of the box (built-in mailer is rate limited; add SMTP for production).
- **Telegram**: set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` and `TELEGRAM_BOT_TOKEN`, and `/setdomain` in @BotFather.
  `/auth/telegram` verifies the widget's signature and turns it into a Supabase session (synthetic
  `telegram-<id>@telegram.example.com` user, created on first login).

How it fits together:

- **Free picks** (`picks`): signed-in users pick home/draw/away, changeable until kickoff. The resolve run settles
  them from fixture results — 3 points for a correct result, +2 when under a third of 3+ pickers called it, void for
  postponed/cancelled. Independent of the contract.
- **Profiles** `/u/<username>` (style label, streak, head-to-head with the viewer); wallets are linked in Settings by
  signing a message, so ETH bets show under the person. Stake amounts are never shown publicly.
- **Pick cards** `/pick/<fixture>/<username>` with a generated preview image — what gets shared to WhatsApp/Telegram.
- **Groups** with invite codes (`/join/<code>`) and members-only weekly/all-time tables.
- **Telegram channel** (`TELEGRAM_CHANNEL_ID`): round digest from the fixture sync, results and Monday recap from the
  resolve run, each posted once (`channel_posts`).

## Monitoring

- `GET /api/health` checks the keeper wallet balance, that the resolve job ran in the last 30 min and the fixture
  sync in the last 13 h, matches overdue for settlement (6 h warn, 24 h critical), and stuck or failed match
  creations. It returns **503 when anything is critical** — point a free uptime monitor (UptimeRobot,
  Better Stack, …) at it. That's what catches pg_cron stopping, since nothing else would run.
- Set `ALERT_WEBHOOK_URL` (Discord or Slack) to get each problem pushed after resolve runs, repeated at most every
  `ALERT_REPEAT_HOURS`, plus a ✅ when it clears. Run `supabase/migrations/0002_alerts.sql` first.
- `/admin?token=<KEEPER_CRON_SECRET>` shows the same checks with details, recent runs and failed creations.

## Development

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
npm test          # domain logic (payouts, match phases, result mapping)
npm run typecheck
npm run lint
npm run sync-abi  # after the contract ABI changes (reads ../subgraph/abis/MatchDayBet.json)
```

The app is installable (web manifest + generated icons in `src/app/icon.tsx`); phones get a dismissible
"add to home screen" card.

Pages: `/` fixtures in weekend (Fri–Mon) / midweek (Tue–Thu) rounds, by day then competition, in local time, `/match/[fixtureId]`, `/me` (bets + claim all),
`/leaderboard` (subgraph, cached 60s), `/how-it-works`. Match pages have generated share images
(`opengraph-image.tsx`); set `NEXT_PUBLIC_SITE_URL` if the app isn't on its Vercel production URL.

Notes:
- Next.js 16 builds with Turbopack. `next.config.ts` aliases optional `@x402/*` imports from Coinbase's SDK
  (pulled in by RainbowKit's Base Account connector) to an empty shim.
- Matches created by the old Towns bot have no fixture row; they're reachable at `/m/<matchId>` from "My bets".
