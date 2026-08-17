# Seller Number

A self-service web app for handing out **seller numbers** (Verkäufernummern) at consignment
sales and flea-market style events — the kind where each seller gets a unique number that tags
their goods and tracks their earnings.

Instead of an organiser assigning numbers by hand from a spreadsheet, sellers open the site,
pick the kind of number they want, and the system assigns them a free one on the spot. The
number is held for a few minutes while they read the terms and enter their contact details,
then it's theirs and a confirmation email goes out.

## How it works for a seller

1. **Landing page** — shows the organiser's intro text and a button per number variation
   (e.g. "regular" vs. "helper"), each with a live count of how many numbers are still free.
2. **Pick a variation** — the server immediately reserves a random free number and starts a
   countdown. A timer stays visible in the header for the rest of the flow.
3. **Conditions** — the seller reads and accepts the terms for that variation.
4. **Details** — name, email, optional phone number.
5. **Done** — the number is permanently theirs. The seller gets a confirmation email with their
   number and the terms; the organiser's support address gets a notification.

If the countdown runs out before step 5, the number is released back into the pool and the
seller is sent back to the start. If nothing is free at all, they land on a "no numbers left,
try again" page — the last one often gets snapped up by someone else mid-flow.

The entire UI is in German.

## How it works underneath

- Numbers live in **pools** attached to an event. A pool holds a list of numbers (individual
  values or `from`–`to` ranges) and can optionally only be handed out inside a time window —
  useful for releasing a batch of numbers at a specific date.
- A number counts as **free** if nobody holds it, or if the previous holder's reservation
  expired without them finishing registration. Assignment picks randomly among the free ones
  and runs inside a database transaction, so two people clicking at the same instant can't
  land on the same number.
- The frontend keeps its number counts live via PocketBase **realtime subscriptions**, with a
  5-second polling fallback if the realtime connection drops. Countdowns run off a
  **server-synced clock** so a wrong device clock can't extend or shorten a session.
- One deployment can serve **multiple organisers**: the event category is resolved from the
  hostname (or an `?eventCategoryId=` parameter), and each category brings its own intro text,
  favicon, page title, session length and support email.
- Organisers export the finished registrations as **CSV** (two column layouts, `kkm` and
  `azb`) from an admin-only endpoint.
- An admin-only **status endpoint** reports the whole configuration as JSON — every upcoming
  event, its pools, and how many numbers are registered, currently held, or still available —
  with all times in local Berlin time.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | PocketBase 0.30 — SQLite, admin UI, realtime, and custom JS endpoints in `pb_hooks/` |
| Frontend | React 19 + Vite, TanStack Router / Query / Form, Zod for all I/O validation |
| Styling | TailwindCSS 4 with shadcn-style components |
| Errors | Sentry |

Production is a single PocketBase process: the built frontend is written to `pb_public/` and
served by the same binary that serves the API.

## Getting started

```bash
nvm use              # Node 22 (see .nvmrc)
npm install          # also downloads the matching PocketBase binary
npm run dev          # PocketBase on :8090 + Vite dev server
```

Open the PocketBase admin UI at http://localhost:8090/_/ to create a superuser, then set up at
least one event category, an event with a future date, a number variation, and a number pool —
the frontend needs all four before it can show anything.

### Building for production

```bash
npm run build        # tsc -b && vite build → pb_public/
npm start            # PocketBase on :8090, serving pb_public/ and the API
```

`npm run build` type-checks the project and writes the bundled frontend into `pb_public/`.
There is no separate frontend server in production: `npm start` runs the same PocketBase binary
that serves the API and hands out the files from `pb_public/`. Run the build before starting —
`npm start` serves whatever is in `pb_public/` at that moment, including a stale build.

`npm run deploy:ssh` does not use your local build: it connects to the configured host, pulls
the latest commit, installs dependencies, runs `npm run build` **there**, and restarts the app
via supervisor.

Other commands: `npm run typecheck`, `npm run lint`.

## Repository layout

```
pb_hooks/         custom API endpoints (reservation, registration, CSV export, status, time, proxy)
pb_migrations/    PocketBase schema history
pb_public/        build output — served by PocketBase in production
src/clients/      PocketBase access: one file per query/mutation, Zod-validated
src/routes/       TanStack Router file-based routes (the seller flow)
scripts/          PocketBase installer + SSH deploy
```

## Further reading

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — full technical reference: collection
  schema, every endpoint, business logic, frontend structure, local API testing
- [`CSV_EXPORT.md`](./CSV_EXPORT.md) — CSV export columns and usage
- [`CLAUDE.md`](./CLAUDE.md) — coding conventions and PocketBase pitfalls (written for AI
  agents, but the gotchas apply to everyone)
- [`ToDo.md`](./ToDo.md) — known issues
