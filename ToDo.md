# ToDo

## Fix event sort mismatch — use the nearest upcoming event

**Status:** open

The backend and frontend disagree on which event they consider "upcoming" whenever an
event category has more than one future event.

| Side | File | Query | Picks |
|---|---|---|---|
| Backend | `pb_hooks/reservation.pb.js` | `findRecordsByFilter('events', 'eventCategory = {:eventCategoryId} && eventDate > {:now}', '-eventDate', 1, 0)` | **furthest-future** event (descending sort, limit 1) |
| Frontend | `src/clients/useUpcomingEventQuery.ts` | `getList(1, 1, { sort: 'eventDate' })` | **nearest** upcoming event (ascending sort) |

### Impact
With two or more future events per category, the reservation endpoint resolves pools for a
different event than the one the UI displays and validates against. The seller can be handed a
number from the wrong event's pool, and the number lists shown in the UI won't match what the
server considers reserved.

### Decision
**The nearest upcoming event is correct** — the backend is wrong.

### Fix
Change the sort in `pb_hooks/reservation.pb.js` from `'-eventDate'` to `'eventDate'` so it
matches the frontend.

### Verification
- Create an event category with two future events, each with its own `sellerNumberPools`.
- Call `POST /api/seller-number/reservation` and confirm the returned seller number belongs to a
  pool of the **nearer** event.
- Confirm the reserved number appears in the frontend's number list (it currently would not).
- Check for any other `events` query that assumes a different ordering.

## Date filter params in hooks use the wrong separator

**Status:** open — reproduced, user-facing.

PocketBase stores dates as `2026-08-20 22:54:00.000Z` (**space**), and a date comparison in a
filter is a plain **string** comparison in SQLite. Hooks that pass `new Date().toISOString()`
as a bound parameter send `2026-08-20T20:54:00.000Z` (**`T`**, 0x54), which sorts *after* every
stored value of the same day (`" "`, 0x20). Any same-day comparison therefore silently
mismatches.

| Side | Code | Serialises to | Correct? |
|---|---|---|---|
| Frontend | `useUpcomingEventQuery.ts` → `pb.filter(…, { now: getSyncedNow() })` | SDK does `toISOString().replace("T"," ")` for `Date` values | **yes** |
| Backend | `pb_hooks/reservation.pb.js:47` — `now: new Date().toISOString()` | keeps the `T` | **no** |

### Impact

On the day of an event, before the event's time of day, `reservation.pb.js` cannot see it:

```
now:   2026-08-20 20:54:00.000Z
event: 2026-08-20 22:54:00.000Z   (same day, two hours out)

POST /api/seller-number/reservation  →  {"error":"No upcoming event found"}
```

Because the frontend serialises correctly, it *does* find the event: the landing page shows the
event and renders enabled variation buttons with counts, and pressing one fails. Bounded — it
only bites on the event day itself, and only for events stored with a meaningful time of day
(one at midnight UTC is already in the past by then) — but the failure mode is a visibly working
button that errors.

### Fix

In `reservation.pb.js`, pass `new Date().toISOString().replace('T', ' ')`. `status-core.js`
exports `toDbDate()` for exactly this; the status endpoints already use it. Audit any other
hook that binds a date — `csv-export.pb.js` binds only ids, so it is unaffected.

### Verification
- Create a category whose only event is later **today**, with a pool.
- `POST /api/seller-number/reservation` must return a number, not `No upcoming event found`.
- Re-check `GET /api/seller-number/status`: the event must appear under `upcomingEvents`.

## `resolveNumbers` drops pool entries starting at 0

**Status:** open — latent, consistent across both copies.

`pb_hooks/reservation.pb.js:126` and `pb_hooks/status-core.js` both gate the object branch on
`numberData.from && numberData.to`. A pool entry `{ "from": 0, "to": 10 }` is silently dropped,
because `0` is falsy — the pool contributes no numbers at all and no warning is raised.

The two copies agree today, which is the only reason nothing is visibly broken. **Fix both
together or neither**: fixing only `status-core.js` would make `/api/seller-number/status` and
`/api/seller-number/public-status` count numbers that `reservation.pb.js` will never hand out.

### Fix
Test for `typeof numberData.from === 'number'` in both places. The array branch
(`[from, to]`) already does exactly that and handles 0 correctly.

### Verification
- A pool with `numbersAsJsonArray` = `[{"from":0,"to":10}]` must report `total: 11`.
- Reserve repeatedly against it and confirm `0` can actually be handed out.

## Make `*Url` text resolution consistent

**Status:** open — two independent defects in how `introTextUrl` / `conditionsTextUrl` /
`additionalEmailTextUrl` are resolved. Background: ["URL text
fields"](./docs/ARCHITECTURE.md#url-text-fields).

### 1. The plain-text mail part has no editor-field fallback

`pb_hooks/email.js` resolves each field twice, and the two paths disagree:

| Part | Code | Behaviour |
|---|---|---|
| HTML | `email.js:221`, `email.js:232` — `resolveUrl(url) \|\| text` | URL wins, editor field is the fallback |
| Plain text | `email.js:298`, `email.js:305` — `if (url) { … }` | editor field is never consulted |

Inside the plain-text branch, `const conditionsText = resolveUrl(conditionsTextUrl)` shadows the
`conditionsText` parameter, so the editor value is not merely unused — it is unreachable.

**Impact:** a variation configured with only `conditionsText` / `additionalEmailText` (no URL)
sends the conditions in the HTML part but omits them from the `text/plain` alternative. Any client
that renders the plain-text alternative shows a confirmation mail without the terms the seller
just accepted.

**Proposed fix:** compute `finalConditionsText` / `finalAdditionalEmailText` once above the HTML
block and use those same values in both bodies. That also removes the duplicate `resolveUrl`
calls (currently harmless only because `cache.js` absorbs the second one).

### 2. The two resolvers disagree on non-JSON responses

| Resolver | Path | Accepts |
|---|---|---|
| Frontend | `withUrlResolving.ts` → `GET /api/seller-number/cors-proxy` | JSON only — `cors-proxy.pb.js:20` returns `res.json` |
| Mail | `email.js:58` | `response.json \|\| response.raw`, so text/HTML works |

**Impact:** a `conditionsTextUrl` pointing at a plain HTML page silently resolves to nothing in
the browser (the editor field's value is kept) while the mail shows the fetched content. The
website and the confirmation mail then state different terms, with no error anywhere — the
frontend cannot distinguish "not JSON" from "empty".

**Proposed fix:** decide on one contract. Either have `cors-proxy.pb.js` fall back to
`res.raw` like `email.js` does, or keep JSON-only and make the proxy answer with a 4xx/5xx so
`withUrlResolving`'s error path fires and the failure is visible in Sentry. The two resolvers
duplicate `stringify` / `get` / hash-splitting logic in general; consolidating the contract is
the point, not sharing the code across the goja/browser boundary.

### Verification
- Variation with `conditionsText` filled and `conditionsTextUrl` empty → register and confirm the
  conditions appear in **both** the HTML and the plain-text part of the seller mail.
- Variation with `conditionsTextUrl` pointing at a non-JSON URL → confirm site and mail agree, or
  that the failure is reported rather than silently swallowed.
- Both with a fresh PocketBase start, since `cache.js` holds results for 10 minutes.
