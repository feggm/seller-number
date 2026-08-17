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
| `introTextUrl` | url | optional; resolved into `introText` client-side |
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

## Backend hooks

Route-registering files must end with `.pb.js`; plain `.js` files are shared modules loaded
via ``require(`${__hooks}/name.js`)``.

| File | Contents |
|---|---|
| `reservation.pb.js` | POST `/api/seller-number/reservation` |
| `registration.pb.js` | POST `/api/seller-number/registration` |
| `csv-export.pb.js` | GET `/api/seller-number/export-csv` |
| `status.pb.js` | GET `/api/seller-number/status` |
| `time.pb.js` | GET `/api/seller-number/now` |
| `cors-proxy.pb.js` | GET `/api/seller-number/cors-proxy` |
| `cache-headers.pb.js` | `routerUse` middleware: `Cache-Control` for the static frontend |
| `email.js` | shared module: `sendRegistrationEmails` |
| `cache.js` | shared in-memory cache, 10 min TTL |
| `berlin-time.js` | shared module: `formatBerlin`, `berlinZoneInfo` — UTC → Europe/Berlin |

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

`eventDate` is stored at midnight UTC, so its `display` is date-only (`14.09.2026`) to avoid
rendering as `02:00 Uhr`.

Configuration problems are reported in a top-level `warnings` array rather than failing the
request — a pool whose `numbersAsJsonArray` is unparseable yields `"numbers": null` plus a
warning, and the rest of the report still renders. Each event also carries `isFrontendTarget`
(nearest upcoming, what the UI offers) and `isReservationTarget` (furthest upcoming, what
`reservation.pb.js` actually reserves against); when they diverge the endpoint warns, surfacing
the sort mismatch tracked in [`../ToDo.md`](../ToDo.md).

Deliberately **not** cached — `cache.js` has a 10 minute TTL and stale counts would mislead.

### GET /api/seller-number/now

Returns `{ "now": "<ISO timestamp>" }`. Used by `src/lib/timeSync.ts` to compute a
client/server clock offset at startup so session countdowns don't drift.

### GET /api/seller-number/cors-proxy

- **Query params**: `url`
- Server-side GET of `url`, response JSON cached 10 minutes via `cache.js`. Used by
  `withUrlResolving` to pull remote `introText` / `conditionsText` content.
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

### Registration emails (`pb_hooks/email.js`)

- **Support notification** → `eventCategories.supportEmail` (skipped with a warning when unset)
- **Seller confirmation** → the seller, including `conditionsText` and `additionalEmailText`
  (each optionally fetched from its `*Url` counterpart via `$http.send`, cached)
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
  `#path.to.prop` hash to pick a nested JSON property
- `gracefulArray(schema)` — parses an array, dropping entries that fail validation
- `useDeviceUuid()` — persistent per-device UUID in localStorage, sent with registration and
  registered with Sentry
- `useCurrentTime()` / `getSyncedNow()` — server-offset time
- Registration results are cached in localStorage under `sellerDetails_${sellerNumberId}`

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
```
