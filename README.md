# Morning Brief (MVP)

Weekday 6:00 AM PT digest: **Top 5**, **Core tech & engineering**, **Markets & investing** (news, today's
calendar and watchlist filings; no prices).
One Cloudflare Worker: cron → fetch → filter → dedupe → Workers AI score/summarize → render → D1 → email.

## Setup (once)

```bash
npm install
npx wrangler login
npx wrangler d1 create morning-brief        # paste database_id into wrangler.jsonc
npm run db:init                             # creates tables

npx wrangler secret put TWELVE_DATA_KEY     # optional: only for the earnings calendar (ClearLot key works)
npx wrangler secret put FRED_KEY            # free: fredaccount.stlouisfed.org
npx wrangler secret put SEC_USER_AGENT      # SEC requires "Name email@example.com"
npx wrangler secret put ACCESS_KEY          # any long random string
```

Email: enable **Email Routing** on a domain you have in Cloudflare and verify your inbox as a
destination address. Put that address in `send_email.destination_address` and `EMAIL_TO`, and a
sender on that domain in `EMAIL_FROM`. Set `BASE_URL` to the worker URL.

Runs on the **Workers Free** plan: the Worker only serves the app and `/api`. The weekday build runs in
GitHub Actions (`.github/workflows/brief.yml`, ~5 AM PT) via `scripts/run-brief.ts`, which reaches the same
D1 and Workers AI over Cloudflare's REST API. Repo secrets: `CF_ACCOUNT_ID`, `CF_API_TOKEN` (D1 Edit +
Workers AI Read), `FRED_KEY`, `SEC_USER_AGENT`, `ACCESS_KEY`, optional `TWELVE_DATA_KEY`; repo variable
`BASE_URL`. Run it now from the Actions tab ("Run workflow"). No email in this mode. Workers AI stays inside
the free 10k neurons/day at the default `maxLlmItems`.

```bash
npm run deploy
curl -X POST "$BASE_URL/run?k=$ACCESS_KEY"  # build + send one now, see what's missing
```

Open `$BASE_URL/api/config?k=$ACCESS_KEY` once in your browser to set the sign-in cookie, then go to `$BASE_URL/`.

## Reader app

`public/` is a static app (no build step) served by the same Worker: Today, Archive, Saved, Watchlist,
Sources & topics, Settings. It reads a JSON copy of each issue stored at send time, so past issues never change.

| Route | What |
|---|---|
| `GET /api/brief/latest`, `/api/brief/YYYY-MM-DD` | Issue JSON plus your saved/vote state |
| `GET /api/archive?q=` | Past issues, full-text search |
| `GET /api/saved` | Reading list |
| `POST /api/items/:id` | `{saved, read, vote: 1/-1/0, reason}` |
| `GET /api/config` | Watchlist, sources, topics (read-only; edit `src/config.ts`) |

Static files are public (they contain no data); every `/api`, `/run` and `/fb` call needs the access key.
AI & infrastructure, Industry, Deep read, sector notes and "Worth understanding" render as "not connected" until
the pipeline produces them.

`node scripts/preview.mjs` builds `dist/preview.html`: the app with fictional prototype data and a state switcher.

## Day to day

- Edit `src/config.ts` (sources, topics, muted, watchlist, thresholds, model), then `npm run deploy`.
- 👍/👎 nudge a source's score; **Save** marks items for the future weekend edition.
- Archive (in the app) searches past issues. Failed sources are listed at the top of each issue.
- If the 6:00 run hasn't sent by 6:20 PT you get an alert email.

## Tests

`npm test` (parsers, dedupe, DST gating, model-reply parsing) · `npm run typecheck`
