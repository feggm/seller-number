# Architecture Reference

Full technical reference for the seller number system: database schema, API endpoints,
frontend structure, and how to exercise the API locally.

For a plain-language overview of what the app does, see [`../README.md`](../README.md).
For coding conventions and known pitfalls, see [`../CLAUDE.md`](../CLAUDE.md).
For the CSV export in detail, see [`../CSV_EXPORT.md`](../CSV_EXPORT.md).

## Environment

- `.env.development`: `VITE_POCKETBASE_URL=http://127.0.0.1:8090`
- `.env.production`: `VITE_POCKETBASE_URL=/` (frontend is served by PocketBase itself)
- PocketBase serves on port 8090; admin UI at http://localhost:8090/_/

## Database collections

Schema below reflects the current state after all migrations in `pb_migrations/`.

### 1. eventCategories (`pbc_3505075978`)

| Field | Type | Notes |
|---|---|---|
| `eventCategoryName` | text | required |
| `introText` | editor | rich text shown on the landing page |
| `introTextUrl` | url | optional; resolved into `introText` client-side (see [URL text fields](#url-text-fields)) |
| `sessionTimeInSec` | number | reservation session timeout |
| `supportEmail` | email | recipient of registration notifications |
| `domain` | text | maps a host to a category (see `EventCategoryIdContext`) |
| `favicon` | file | drives dynamic favicon/title |

### 2. events (`pbc_1687431684`)

`eventCategory` (relation → eventCategories, required), `eventName` (text, required),
`eventDate` (date, required)

### 3. sellerNumberVariations (`pbc_1269879477`)

`sellerNumberVariationName` (text, required), `eventCategory` (relation, required),
`conditionsText` (editor), `conditionsTextUrl` (url), `additionalEmailText` (editor),
`additionalEmailTextUrl` (url)

The two `*Url` fields hold an address whose content replaces the matching editor field — see
[URL text fields](#url-text-fields).

### 4. sellerNumberPools (`pbc_1981446857`)

`sellerNumberVariation` (relation, required), `event` (relation, required),
`numbersAsJsonArray` (**text** holding a JSON string), `obtainableFrom` (date),
`obtainableTo` (date)

> `numberFrom`/`numberTo` and the earlier `numbers` JSON field were removed by migrations.
> The current field is `numbersAsJsonArray`, a **text** field that must be `JSON.parse`d.
> Its parsed array accepts three entry shapes: `5`, `{ "from": 1, "to": 10 }`, or `[1, 10]`.

### 5. sellerNumbers (`pbc_492105405`)

`sellerNumberNumber` (number, required), `reservedAt` (date, required),
`sellerNumberPool` (relation, required), `sellerDetails` (relation → sellerDetails, optional)

### 6. sellerDetails (`pbc_418131918`)

`sellerFirstName` (text, required), `sellerLastName` (text, required),
`sellerEmail` (email, required), `sellerPhone` (text), `ipAddress` (text), `deviceUuid` (text)

### 7. statusSamples

`eventCategory` (relation → eventCategories, required, cascade delete), `bucketAt` (date,
required — bucket start, UTC), `connections` (number), `source` (text: `live` | `heartbeat`)

Append-only time series behind the public status page's connection curve. All API rules are
`null` (superuser only); the history is served through the endpoint. A unique index on
`(eventCategory, bucketAt)` is the dedupe mechanism, not an optimisation — see
[Status sampling](#status-sampling).

Only the connection count is stored. The number counts are exactly reconstructable from
`sellerDetails.created` + `sellerNumbers`, so persisting them would be a second, drift-prone
copy; the connection count exists only in Go process memory and is otherwise unrecoverable.

## Backend hooks

Route-registering files must end with `.pb.js`; plain `.js` files are shared modules loaded
via ``require(`${__hooks}/name.js`)``.

| File | Contents |
|---|---|
| `reservation.pb.js` | POST `/api/seller-number/reservation` |
| `registration.pb.js` | POST `/api/seller-number/registration` |
| `csv-export.pb.js` | GET `/api/seller-number/export-csv` |
| `status.pb.js` | GET `/api/seller-number/status` |
| `public-status.pb.js` | GET `/api/seller-number/public-status` and `…/public-status/history` |
| `status-sampler.pb.js` | route-free: the `statusHeartbeat` and `statusSamplesRetention` crons |
| `time.pb.js` | GET `/api/seller-number/now` |
| `cors-proxy.pb.js` | GET `/api/seller-number/cors-proxy` |
| `cache-headers.pb.js` | `routerUse` middleware: `Cache-Control` for the static frontend |
| `email.js` | shared module: `sendRegistrationEmails` |
| `cache.js` | shared in-memory cache, 10 min TTL |
| `berlin-time.js` | shared module: `formatBerlin`, `berlinZoneInfo` — UTC → Europe/Berlin |
| `status-core.js` | shared module: tree loading, per-pool classification, `toDbDate`, `countCategoryClients` |
| `status-samples.js` | shared module: bucketing, append-only sample I/O, retention sweep |

> **Handlers cannot see their file's module scope.** A function registered with `routerAdd` or
> `cronAdd` executes in isolation — a `const` declared at the top of the hook file is
> `undefined` at request time, and the request fails with PocketBase's generic 400 envelope
> rather than anything that names the cause. Every helper therefore lives *inside* its handler,
> and shared code is reached with `require()`, which does work there. This is why the hook files
> look repetitive; it is not a style choice.

> **Dates used as filter parameters need a space, not a `T`.** PocketBase stores dates as
> `2026-08-20 22:54:00.000Z` and compares them as strings in SQLite, so a raw `toISOString()`
> (with `T`, 0x54) sorts after every stored value of the same day (`" "`, 0x20) and silently
> matches nothing. `status-core.js` exports `toDbDate()` for this. `reservation.pb.js` still has
> the unfixed version — see [`../ToDo.md`](../ToDo.md).

### Static asset caching (`pb_hooks/cache-headers.pb.js`)

PocketBase serves `pb_public/` without a `Cache-Control` header, which leaves the policy to
whatever proxy sits in front of it. A global `routerUse` middleware sets it explicitly:

| Path | Header |
|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` — Vite content-hashes these filenames |
| everything else static | `no-cache` — revalidate on every load |
| `/api/*`, `/_/*` | untouched (PocketBase's own headers; `/api/realtime` is a long-lived SSE stream) |

`index.html` is the only file Vite does not content-hash, and it carries the references to the
hashed chunks. If it is cached, the browser keeps resolving the *previous* build's chunk names
out of its own cache and the old app keeps running after a deploy — so it must revalidate.

Production sits behind Cloudflare, which passes these headers through unchanged — verified
after deploying the hook:

```
$ curl -sI https://reg.kleidermarkt-gummersbach.de/
cache-control: no-cache
cf-cache-status: REVALIDATED
```

`REVALIDATED` is the desired state: Cloudflare still holds `index.html` at the edge but
revalidates it against the origin on every request, so a stale copy is never served. No
dashboard configuration is needed. Before this hook existed the origin sent no header at all,
and Cloudflare filled in `max-age=86400` — which is where the stale-build problem came from.

## API endpoints

### POST /api/seller-number/reservation

- **Input**: `{ "sellerNumberVariationId": "string" }`
- **Output**: `{ "sellerNumberId": "string" }`
- **Auth**: none
- **Logic**: resolves variation → event category → an event with `eventDate > now`, collects
  that event's pools for the variation, filters them by `obtainableFrom`/`obtainableTo`,
  expands `numbersAsJsonArray`, and reserves a **randomly selected** obtainable number inside
  `$app.runInTransaction`. If the chosen number has a stale `sellerNumbers` record, that record
  is deleted and a fresh one created.
- **Errors**: 400 missing id / `BadRequestError('No obtainable numbers found')`, 404 for
  missing variation, category, event, or pools, 500 otherwise.

### POST /api/seller-number/registration

- **Input**: `{ sellerNumberId, sellerFirstName, sellerLastName, sellerEmail, sellerPhone?, deviceUuid? }`
- **Output**: `{ "sellerDetailsId": "string", "sellerNumberId": "string" }`
- **Auth**: none
- **Logic**: validates the reservation is still within `sessionTimeInSec`, creates a
  `sellerDetails` record (recording `ipAddress` from `e.realIP()` and `deviceUuid`), sends
  registration emails, then links the details to the seller number.
- **Errors**: 400 missing fields / not reserved, 404 record lookups, 409 already registered,
  410 reservation expired.

### GET /api/seller-number/export-csv

- **Auth**: **superuser required** (`e.auth.collection().name === '_superusers'`), else 401
- **Query params**: `eventId` (required), `mode` = `"kkm"` | `"azb"` (default `"kkm"`)
- **Output**: CSV download; filename derived from `eventName`
- **Logic**: all seller numbers across the event's pools that have `sellerDetails` set.

Column layouts, response examples, and error payloads are documented in
[`../CSV_EXPORT.md`](../CSV_EXPORT.md). Only `nr`, `name`, `vorname`, `tel`, and `email` are
populated; every other column is emitted empty because no DB field backs it yet.

### GET /api/seller-number/status

- **Auth**: **superuser required** (same gate as the CSV export), else 401
- **Query params**: none
- **Output**: JSON operational report — every event category, its events with `eventDate > now`,
  their variations and pools, and per-pool number counts. Counts only, never seller PII.

Per pool, each resolved number falls into exactly one bucket, applying the *same* rule as
`reservation.pb.js` so the figures match what a seller would actually be offered:

| Bucket | Meaning |
|---|---|
| `registered` | a `sellerNumbers` record exists with `sellerDetails` set |
| `reserved` | held without `sellerDetails`, `reservedAt` age ≤ the category's `sessionTimeInSec` |
| `available` | no record at all, **or** a hold whose session has expired |
| `expiredHolds` | informational subset of `available` — stale holds that freed up |

`registered + reserved + available === total`. Counts roll up per variation, per event, per
category, and into a top-level `totals`.

Every timestamp is an object rather than a bare string, rendered in Europe/Berlin via
`berlin-time.js` (goja ships no `Intl`, so the EU DST rule is implemented directly):

```json
"obtainableFrom": {
  "local": "2026-01-15T18:00:00+01:00", "utc": "2026-01-15T17:00:00.000Z",
  "display": "15.01.2026, 18:00 Uhr", "offset": "+01:00", "abbreviation": "CET"
}
```

`eventDate` is passed with `dateOnlyAtMidnight`, which drops the time from `display` **only**
when the stored value is exactly midnight UTC — a date with no meaningful time of day, which
would otherwise read as `14.09.2026, 02:00 Uhr` once shifted to Berlin. An event that really
does start at 15:30 keeps its time (`25.09.2026, 15:30 Uhr`). `local` and `utc` always carry
the full timestamp either way.

Configuration problems are reported in a top-level `warnings` array rather than failing the
request — a pool whose `numbersAsJsonArray` is unparseable yields `"numbers": null` plus a
warning, and the rest of the report still renders. A category with no upcoming events warns
too: its domain cannot hand out a number at all, since reservations there fail with
`No upcoming event found`. Each event also carries `isFrontendTarget`
(nearest upcoming, what the UI offers) and `isReservationTarget` (furthest upcoming, what
`reservation.pb.js` actually reserves against); when they diverge the endpoint warns, surfacing
the sort mismatch tracked in [`../ToDo.md`](../ToDo.md).

Deliberately **not** cached — `cache.js` has a 10 minute TTL and stale counts would mislead.

### GET /api/seller-number/public-status

- **Auth**: none. **Query params**: `eventCategoryId` (required; 400 without, 404 if unknown)
- **Cache**: `Cache-Control: no-store` — the figures are live *and* the route has a write
  side-effect (sampling). `cache-headers.pb.js` leaves `/api/*` alone, so nothing else sets it.

Live snapshot for one event category, backing the status page at `/#/live`. Returns the same
`{ total, registered, reserved, available, expiredHolds }` counts as the admin report, rolled up
per variation and for the event as a whole, plus `release` (`isObtainableNow`, `obtainableFrom`,
`obtainableTo`, `nextOpensAt`) and `connections`.

Pools are rolled up into their variation and the pool layer is dropped — the public question is
"Damen: noch 120 von 400 frei", and pool ids and their individual windows are config detail.
`release.nextOpensAt` is the earliest `obtainableFrom` still in the future, i.e. the "when do
numbers open" answer in one field.

**Withheld**: `supportEmail`, `sessionTimeInSec`, `domain`, `numbersSpec`, `warnings[]`, app
settings, pool ids, and anything from `sellerDetails` beyond aggregate counts and bucketed
`created` timestamps.

> Hiding counts would be theatre, not confidentiality: `sellerNumberPools.listRule` and
> `sellerNumbers.listRule` are both `""` (migrations `1743201198` / `1743201088`), so the full
> number list is already public — `useObtainableNumbers.ts` computes availability in the browser
> and depends on it. The page therefore shows "noch X von Y frei" openly.

**Event selection.** Uses `sort: 'eventDate'` limit 1 — the *nearest* upcoming event, matching
`useUpcomingEventQuery` and the decision recorded in `ToDo.md`. `eventSelection` names the choice
in the payload and `reservationTargetMatches: false` flags when `reservation.pb.js` would pick a
different event, so the UI can say so instead of showing figures for another event.

Deliberately a separate file from `status.pb.js`: that endpoint's superuser gate is four
unconditional lines guarding an all-categories report, and making it conditional on a query param
would be the riskiest edit available here. Two files, two unconditional policies; the counting
logic they share lives in `status-core.js`.

### GET /api/seller-number/public-status/history

- **Auth**: none. **Query params**: `eventCategoryId` (required), `windowMinutes` (default 60,
  clamped to 1…1440). No write side-effect.

`{ bucketSeconds, from, to, registrations: [{t, n}], registrationsTotal, connections: [{t, c}] }`,
capped at 720 points per series (the bucket widens automatically for long windows).

The two series have **different provenance and different resolution**, which is why the page
draws them as two stacked facets sharing an x-axis rather than one plot with two y-scales:

| Series | Source | Resolution |
|---|---|---|
| `registrations` | `sellerDetails.created`, derived live on every request | exact; survives reload and deploy, reconstructable retroactively |
| `connections` | `statusSamples` | 5s while someone is watching, 60s heartbeat in the release window, nothing otherwise |

`sellerDetails` has no path back to a category — the only link is `sellerNumbers.sellerDetails` —
so the rows are loaded through their seller numbers and expanded with `$app.expandRecords`.

### Status sampling

The connection count lives only in Go process memory, so it must be written down as it happens.
Cron cannot do it alone: `cronAdd` takes a standard 5-field expression, so 60s is its floor, and
the JSVM has no `setInterval`. Two tiers instead:

1. **Opportunistic** (`status-samples.js`, called from the snapshot route): each response floors
   `now` into a 5s bucket and attempts one insert. The unique index makes dedupe atomic, so write
   load is capped at **one row per bucket regardless of viewer count** — 5 watchers or 500 cost
   the same ≈0.2 writes/s. This matters: without the cap, 500 visitors polling would put ~250
   INSERT/s on the same SQLite writer `reservation.pb.js` needs inside `runInTransaction`, in the
   exact minute reservations must not stall. A per-VM memo skips most attempts before they reach
   SQLite; it is a cache, not a counter, so the goja VM pool is harmless here — correctness lives
   in the index.
2. **Heartbeat** (`status-sampler.pb.js`), every minute, but only while `now` is inside
   `[min(obtainableFrom) − 15 min, +24 h]` for that category. Its purpose is to make a gap in the
   curve mean "nobody was watching" rather than "we lost data".

Retention: `statusSamplesRetention` sweeps rows older than 90 days nightly, batched in a
transaction.

> Hook files are evaluated once per goja VM, so `cronAdd` runs N times — PocketBase *replaces* a
> job reusing an existing id, so exactly one survives and fires. Verified: exactly one row per
> minute per category. Do not "fix" this with a registration guard.

### Presence — what `connections` actually counts

`$app.subscriptionsBroker()` is process-global across every domain the instance serves, so it is
filtered by topic: `useCategoryPresence.ts` opens an otherwise no-op subscription to
`eventCategories/<id>` from the root route, and the endpoint counts clients via
`hasSubscription()`. Additive on purpose — the existing `subscribe('*', …)` handlers in
`useEventCategoryQuery.ts` are untouched, and the by-domain one *must* stay `'*'` or it would
miss another category claiming the domain.

It counts **SSE connections, i.e. browser tabs** (`pb` is a module singleton), not people and not
devices. Two tabs on one device count twice; the status page counts itself; a client that fell
back to the 5s polling path is invisible; a phone that backgrounded the tab drops out; and
Cloudflare recycling idle streams shows up as brief dips while the SDK reconnects. The UI labels
it "Aktive Verbindungen" and says so — never "Personen".

### GET /api/seller-number/now

Returns `{ "now": "<ISO timestamp>" }`. Used by `src/lib/timeSync.ts` to compute a
client/server clock offset at startup so session countdowns don't drift.

### GET /api/seller-number/cors-proxy

- **Query params**: `url`
- Server-side GET of `url`, response JSON cached 10 minutes via `cache.js`. Used by
  `withUrlResolving` to pull remote `introText` / `conditionsText` content — see
  [URL text fields](#url-text-fields).
- **Auth**: none — this is an open proxy to any URL, with the caller's headers forwarded.
  Keep that in mind before extending it.

## Business logic

### Reservation

1. Validate `sellerNumberVariationId`
2. Look up variation → event category
3. Find an event for the category with `eventDate > now`
4. Load pools for (variation, event), drop pools outside their `obtainableFrom`/`obtainableTo` window
5. Expand `numbersAsJsonArray` into concrete numbers per pool
6. A number is obtainable when no `sellerNumbers` record exists for it, or the existing record
   has no `sellerDetails` **and** its `reservedAt` is older than `sessionTimeInSec`
7. Pick one at random, delete any stale record, create a new record with `reservedAt = now`
   (all inside a transaction)

> **Known inconsistency**: `reservation.pb.js` sorts events `-eventDate` with limit 1, so it
> picks the *furthest-future* event, while the frontend (`useUpcomingEventQuery`) sorts
> `eventDate` ascending and picks the *nearest* one. With more than one future event per
> category these disagree.

### Session management

- `reservedAt` timestamp + per-category `sessionTimeInSec`
- Expired reservations become obtainable again (server and client both apply this rule)
- Client uses `getSyncedNow()` (server-offset clock) for all expiry math

### URL text fields

Three fields hold an address rather than content: `eventCategories.introTextUrl`,
`sellerNumberVariations.conditionsTextUrl` and `sellerNumberVariations.additionalEmailTextUrl`.
Each is fetched at runtime and fills the editor field of the same name minus the `Url` suffix.
Leave one empty and the editor field is used as it stands.

| URL field | Fills | Consumed by |
|---|---|---|
| `introTextUrl` | `introText` | landing page (`useEventCategoryQuery`) |
| `conditionsTextUrl` | `conditionsText` | conditions page (`useSellerNumberVariationsQuery`) **and** the seller confirmation mail |
| `additionalEmailTextUrl` | `additionalEmailText` | seller confirmation mail only |

**What goes in the field** — an absolute http(s) URL, optionally with a hash fragment naming a
dot path into the JSON response:

```
https://cms.example.org/wp-json/wp/v2/pages/42#content.rendered   → nested pick
https://example.org/api/texts.json#terms.html                     → nested pick
https://example.org/api/text.json                                 → whole response
```

Without a hash the whole response body is used. The picked value is expected to be a **string of
HTML**: it is injected unescaped — client-side through `ProseText`'s `dangerouslySetInnerHTML`,
server-side straight into the mail body. A non-string value is `JSON.stringify`d, so a hash path
pointing at an object puts raw JSON in front of the seller.

**The response should be JSON.** There are two independent resolvers and they disagree on
non-JSON responses:

| | Frontend (`withUrlResolving.ts`) | Mail (`email.js`) |
|---|---|---|
| Transport | `GET /api/seller-number/cors-proxy` | `$http.send` directly, 10 s timeout |
| Body | `res.json` only — non-JSON yields nothing | `response.json \|\| response.raw`, so text/HTML works too |
| Hash pick | `lodash.get` | hand-rolled `get()`, same dot notation |
| On failure | keeps the editor field's value | falls back to the editor field (HTML part only) |

A URL serving plain HTML therefore reaches the mail but silently leaves the website on the editor
text. Serve JSON for `conditionsTextUrl` in particular, since both resolvers read it.

**Precedence differs per consumer** — worth knowing before filling in URL *and* editor field:

- Frontend: the URL wins, but only on success; an empty or failed fetch leaves the editor text
- Mail, HTML part: `resolveUrl(url) || text` — URL wins, editor field is the fallback
  (`email.js:221`, `email.js:232`)
- Mail, plain-text part: only the URL is consulted (`email.js:298`, `email.js:305`), so with just
  the editor field filled the section is missing from the `text/plain` alternative

> **Known inconsistencies**, both tracked in [`../ToDo.md`](../ToDo.md):
>
> 1. The plain-text mail part has no editor-field fallback. `const conditionsText =
>    resolveUrl(conditionsTextUrl)` inside the branch shadows the parameter of the same name, so a
>    variation with only `conditionsText` set sends its conditions in the HTML part and omits them
>    from `text/plain`.
> 2. The frontend accepts JSON only while the mail also accepts `response.raw`. A non-JSON URL
>    makes site and mail show different text, with no error raised on either side.

**Caching**: 10 minutes via `cache.js`, held separately by the proxy and by `email.js` (keyed
`resolveUrl:<url>`), so remote edits appear with a delay; a PocketBase restart clears both.
`email.js` caches failures as an empty string for the same 10 minutes and sends the mail without
the section rather than failing.

Check a URL without going through the UI — valid JSON containing your hash path means the field
will work in both consumers:

```bash
curl "http://localhost:8090/api/seller-number/cors-proxy?url=https://example.org/wp-json/wp/v2/pages/42"
```

### Registration emails (`pb_hooks/email.js`)

- **Support notification** → `eventCategories.supportEmail` (skipped with a warning when unset)
- **Seller confirmation** → the seller, including `conditionsText` and `additionalEmailText`
  (each optionally fetched from its `*Url` counterpart via `$http.send`, cached — see
  [URL text fields](#url-text-fields) for precedence and the plain-text gap)
- Both use `$app.newMailClient().send()` with `$app.settings().meta.senderAddress` /
  `senderName`; failures are logged, not thrown — registration still succeeds if mail fails
- All copy is German

## Frontend architecture

### Entry & routing

- `src/main.tsx` — `initSentry()`, then `await initializeTimeSync()` before rendering
- TanStack Router with **hash history**; routes in `src/routes/`, generated tree in
  `src/routeTree.gen.ts` (do not edit by hand)
- Flow: `index` → `variation.$variationId.sellerNumber.$sellerNumber/_withSessionCounter/{conditions,seller-details}`
  → `success`; `no-reservation` for the failure case
- `live` — the public status page at `/#/live`, not linked from anywhere. Obscurity, **not**
  access control: every figure on it is already fetchable unauthenticated from
  `sellerNumberPools` + `sellerNumbers`, so a secret path would buy nothing. It is code-split
  into its own ~12 kB chunk and loads only when visited.

### Event category resolution (`src/context/EventCategoryIdContext.tsx`)

`?eventCategoryId=` search param wins; otherwise the current `window.location.host` is matched
against `eventCategories.domain`. If neither resolves, `EventCategoryIdProvider` renders `null`
and the page appears blank.

### Realtime + polling (`src/clients/pocketbase.ts`, `src/clients/utils/polling.ts`)

Polling (5 s) is enabled by default and disabled once the realtime `PB_CONNECT` event arrives;
it is re-enabled on realtime disconnect. `pb.autoCancellation(false)` is set.

### Helpers

- `withUrlResolving(data, { resolverMap: { introTextUrl: 'introText' } })` — fetches URL fields
  through the cors-proxy and writes the result into the target field; supports a
  `#path.to.prop` hash to pick a nested JSON property. See
  [URL text fields](#url-text-fields).
- `gracefulArray(schema)` — parses an array, dropping entries that fail validation
- `useDeviceUuid()` — persistent per-device UUID in localStorage, sent with registration and
  registered with Sentry
- `useCurrentTime()` / `getSyncedNow()` — server-offset time
- Registration results are cached in localStorage under `sellerDetails_${sellerNumberId}`

### Status page (`src/routes/live.tsx`)

`usePublicStatusQuery` / `usePublicStatusHistoryQuery` in `src/clients/usePublicStatusQuery.ts`.

> **Documented exception to `staleTime: Infinity` + realtime invalidation.** The snapshot also
> carries `refetchInterval: 2000` (history: 10000), because `connections` is Go process state,
> not a projection of any record — there is no record event realtime could invalidate on. The
> `sellerNumbers` subscription still covers the counts, so those update faster than the poll.
> `refetchIntervalInBackground: false` stops a forgotten tab from polling and from inflating its
> own connection figure.
>
> Both queries pass `meta: { suppressErrorToast: true }`; `queryClient.ts` honours it. A 2s poll
> against a failing endpoint would otherwise fire the global toast every two seconds, which
> reads as broken rather than informative. Sentry still receives the error via
> `withErrorLogging`.

The page **cannot** opt out of the blocking `await initializeTimeSync()` in `main.tsx` — that
sits above `createRoot`, above the router. It avoids *depending* on it instead: the x-axis is
anchored on server-supplied timestamps and every displayed time comes from the server's
Berlin-formatted `display` string, so the page is correct even if time sync failed entirely.

Charts are hand-rolled inline SVG (`src/components/status/`), no charting dependency: the entry
chunk is already past the 500 kB warning, and this page's job is to be up instantly during a
rush over the Cloudflare→Uberspace path documented in [`CLOUDFLARE.md`](./CLOUDFLARE.md). Two
single-series plots with a known y-max do not justify ~100 kB gzip.

- `StatTile` — the four headline figures. Not charts; a one-bar chart for a scalar is noise.
- `RemainingMeter` — "noch X von Y frei" as a meter against a known limit. Blue ramp, *not*
  status green/amber/red: those mean good/warning/critical, never "how full is this".
- `TimeSeriesFacet` — one single-series plot. Registrations as an area with the y-domain fixed
  to `0…total` and a reference hairline at the ceiling; connections as a **step** line, because
  the samples are 5s buckets and a smoothed curve would imply resolution that does not exist.
  Two facets sharing an x-axis, **never** one plot with two y-scales.
- The x-axis domain ends at `max(snapshot time, newest sample)`. The snapshot and the history
  are separate queries on different intervals, so the history routinely carries samples a few
  seconds newer than the snapshot; anchoring on the snapshot alone draws them past the plot edge.

## Exercising the API locally

```bash
# Reserve a number
curl -X POST http://localhost:8090/api/seller-number/reservation \
  -H "Content-Type: application/json" \
  -d '{"sellerNumberVariationId": "your_id_here"}'

# Complete a registration
curl -X POST http://localhost:8090/api/seller-number/registration \
  -H "Content-Type: application/json" \
  -d '{"sellerNumberId":"...","sellerFirstName":"Max","sellerLastName":"Muster","sellerEmail":"max@example.com","sellerPhone":"0123","deviceUuid":"..."}'

# Server time
curl http://localhost:8090/api/seller-number/now

# CSV export — authenticate as superuser first
TOKEN=$(curl -s -X POST http://localhost:8090/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity": "admin@example.com", "password": "your_admin_password"}' | jq -r '.token')

curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id&mode=kkm" \
  -H "Authorization: Bearer $TOKEN" -o seller-numbers-kkm.csv

# Status report — same superuser token
curl -s http://localhost:8090/api/seller-number/status -H "Authorization: Bearer $TOKEN" | jq

# Just the headline numbers
curl -s http://localhost:8090/api/seller-number/status -H "Authorization: Bearer $TOKEN" \
  | jq '{totals, warnings}'

# Unauthenticated → {"error": "Unauthorized: Admin access required"}
curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id"

# Public status — no auth. Grab a category id first (eventCategories is publicly listable).
CAT=$(curl -s "http://localhost:8090/api/collections/eventCategories/records?perPage=1&fields=id" \
  | jq -r '.items[0].id')
curl -s "http://localhost:8090/api/seller-number/public-status?eventCategoryId=$CAT" | jq

# Confirm nothing internal leaks — must print nothing
curl -s "http://localhost:8090/api/seller-number/public-status?eventCategoryId=$CAT" \
  | jq -r 'paths(scalars) | join(".")' \
  | grep -Ei 'supportEmail|numbersSpec|warnings|appName|sessionTime|domain|Email|Phone|ipAddress|deviceUuid'

# History for the charts
curl -s "http://localhost:8090/api/seller-number/public-status/history?eventCategoryId=$CAT&windowMinutes=60" \
  | jq '{bucketSeconds, registrationsTotal, reg:(.registrations|length), conn:(.connections|length)}'

# Sampling dedupe: N requests over ~30s must yield rows == distinctBuckets ≈ elapsed/5
for i in $(seq 1 60); do
  curl -s "http://localhost:8090/api/seller-number/public-status?eventCategoryId=$CAT" >/dev/null
  sleep 0.5
done
curl -s "http://localhost:8090/api/collections/statusSamples/records?perPage=500&sort=-bucketAt" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{rows:(.items|length), distinctBuckets:([.items[].bucketAt]|unique|length)}'
```

To check that `connections` is category-scoped without opening browser tabs, open a raw SSE
client the way the SDK does — connect, read the `clientId` from the first event, then POST the
subscription:

```bash
curl -sN http://localhost:8090/api/realtime > /tmp/sse.txt &
CID=$(grep -o '"clientId":"[^"]*"' /tmp/sse.txt | head -1 | cut -d'"' -f4)
curl -s -X POST http://localhost:8090/api/realtime -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CID\",\"subscriptions\":[\"eventCategories/$CAT\"]}"

# → connections for $CAT goes up by one; another category's figure is unaffected
curl -s "http://localhost:8090/api/seller-number/public-status?eventCategoryId=$CAT" | jq .connections
```
