# Seller Number Project - CLAUDE.md

## Project Overview
Seller number reservation system built with PocketBase (backend, JS hooks) and React/Vite (frontend, served from `pb_public`). Sellers pick a variation, get a randomly assigned number reserved for a time-boxed session, then complete registration — which stores their details and triggers confirmation emails.

## Technology Stack
- **Backend**: PocketBase 0.30.0 (see `.pbversion`), JavaScript hooks in `pb_hooks/`
- **Frontend**: React 19, Vite 6, TanStack Router (hash history) + TanStack Query v5, TanStack Form
- **Validation**: Zod 3
- **Styling**: TailwindCSS 4.x, shadcn-style components in `src/components/ui`
- **Error tracking**: Sentry (`@sentry/react`, `src/sentry.ts`)
- **Database**: PocketBase (SQLite)
- **Package Manager**: npm (see `packageManager` in package.json), Node v22.19.0 (`.nvmrc`)

## Development Commands
```bash
# Install dependencies + download the matching PocketBase binary (postinstall)
npm install

# Start PocketBase + Vite concurrently
npm run dev

# Build frontend (tsc -b && vite build → outputs to pb_public/)
npm run build

# Type check only
npm run typecheck

# Serve production (PocketBase serves pb_public/)
npm start

# Lint
npm run lint

# Deploy over SSH (config in scripts/deploy-ssh/config/)
npm run deploy:ssh
```

### Environment
- `.env.development`: `VITE_POCKETBASE_URL=http://127.0.0.1:8090`
- `.env.production`: `VITE_POCKETBASE_URL=/` (frontend is served by PocketBase itself)
- PocketBase serves on port 8090; admin UI at http://localhost:8090/_/

## Database Collections

Schema below reflects the current state after all migrations in `pb_migrations/`.

### 1. eventCategories (`pbc_3505075978`)
| Field | Type | Notes |
|---|---|---|
| `eventCategoryName` | text | required |
| `introText` | editor | rich text shown on the landing page |
| `introTextUrl` | url | optional; resolved into `introText` client-side |
| `sessionTimeInSec` | number | reservation session timeout |
| `supportEmail` | email | recipient of registration notifications |
| `domain` | text | maps a host to a category (see EventCategoryIdContext) |
| `favicon` | file | drives dynamic favicon/title |

### 2. events (`pbc_1687431684`)
`eventCategory` (relation → eventCategories, required), `eventName` (text, required), `eventDate` (date, required)

### 3. sellerNumberVariations (`pbc_1269879477`)
`sellerNumberVariationName` (text, required), `eventCategory` (relation, required), `conditionsText` (editor), `conditionsTextUrl` (url), `additionalEmailText` (editor), `additionalEmailTextUrl` (url)

### 4. sellerNumberPools (`pbc_1981446857`)
`sellerNumberVariation` (relation, required), `event` (relation, required), `numbersAsJsonArray` (**text** holding a JSON string), `obtainableFrom` (date), `obtainableTo` (date)

> `numberFrom`/`numberTo` and the earlier `numbers` JSON field were removed by migrations. The current field is `numbersAsJsonArray`, a **text** field that must be `JSON.parse`d. Its parsed array accepts three entry shapes: `5`, `{ "from": 1, "to": 10 }`, or `[1, 10]`.

### 5. sellerNumbers (`pbc_492105405`)
`sellerNumberNumber` (number, required), `reservedAt` (date, required), `sellerNumberPool` (relation, required), `sellerDetails` (relation → sellerDetails, optional)

### 6. sellerDetails (`pbc_418131918`)
`sellerFirstName` (text, required), `sellerLastName` (text, required), `sellerEmail` (email, required), `sellerPhone` (text), `ipAddress` (text), `deviceUuid` (text)

## PocketBase API Patterns

### JavaScript Hooks Location
- `pb_hooks/` directory
- Route-registering files must end with `.pb.js`; plain `.js` files (`cache.js`, `email.js`) are shared modules loaded via ``require(`${__hooks}/name.js`)``

Current hook files:
| File | Contents |
|---|---|
| `reservation.pb.js` | POST `/api/seller-number/reservation` |
| `registration.pb.js` | POST `/api/seller-number/registration` |
| `csv-export.pb.js` | GET `/api/seller-number/export-csv` |
| `time.pb.js` | GET `/api/seller-number/now` |
| `cors-proxy.pb.js` | GET `/api/seller-number/cors-proxy` |
| `email.js` | shared module: `sendRegistrationEmails` |
| `cache.js` | shared in-memory cache, 10 min TTL |

### Correct API Usage
❌ **OLD/INCORRECT:**
```javascript
$app.dao().findFirstRecordByData()
$app.dao().saveRecord()
```

✅ **CORRECT:**
```javascript
$app.findRecordById('collection', 'id')
$app.findRecordsByFilter('collection', 'filter', 'sort', limit, offset, params)
$app.save(record)
$app.findCollectionByNameOrId('collection')
$app.runInTransaction((txApp) => { /* txApp.save/delete/findRecordsByFilter */ })
```

### Request Body Handling
❌ **INCORRECT:**
```javascript
const { field } = e.request.body.json()
```

✅ **CORRECT:**
```javascript
const data = new DynamicModel({ field: '' })
e.bindBody(data)
const field = data.field
```

Query params: `e.request.url.query().get('name')`. Client IP: `e.realIP()`.

### Filter Syntax
❌ **INCORRECT:**
```javascript
'field in ("val1","val2")'  // "in" operator not supported
```

✅ **CORRECT:**
```javascript
'field = "val1" || field = "val2"'  // Use OR conditions
```

Prefer bound params (`'event = {:eventId}'` + a params object) over string concatenation; the multi-id OR filters in `reservation.pb.js` / `csv-export.pb.js` are built by concatenation because the param count is dynamic.

## API Endpoints

### POST /api/seller-number/reservation
- **Input**: `{ "sellerNumberVariationId": "string" }`
- **Output**: `{ "sellerNumberId": "string" }`
- **Auth**: none
- **Logic**: resolves variation → event category → an event with `eventDate > now`, collects that event's pools for the variation, filters them by `obtainableFrom`/`obtainableTo`, expands `numbersAsJsonArray`, and reserves a **randomly selected** obtainable number inside `$app.runInTransaction`. If the chosen number has a stale `sellerNumbers` record, that record is deleted and a fresh one created.
- **Errors**: 400 missing id / `BadRequestError('No obtainable numbers found')`, 404 for missing variation, category, event, or pools, 500 otherwise.

### POST /api/seller-number/registration
- **Input**: `{ sellerNumberId, sellerFirstName, sellerLastName, sellerEmail, sellerPhone?, deviceUuid? }`
- **Output**: `{ "sellerDetailsId": "string", "sellerNumberId": "string" }`
- **Auth**: none
- **Logic**: validates the reservation is still within `sessionTimeInSec`, creates a `sellerDetails` record (recording `ipAddress` from `e.realIP()` and `deviceUuid`), sends registration emails, then links the details to the seller number.
- **Errors**: 400 missing fields / not reserved, 404 record lookups, 409 already registered, 410 reservation expired.

### GET /api/seller-number/export-csv
- **Auth**: **superuser required** (`e.auth.collection().name === '_superusers'`), else 401
- **Query params**: `eventId` (required), `mode` = `"kkm"` | `"azb"` (default `"kkm"`)
- **Output**: CSV download; filename derived from `eventName`
- **CSV headers**:
  - `kkm`: `nr`, `dnr`, `babynr`, `name`, `vorname`, `Strasse`, `plz`, `ort`, `tel`, `email`, `interesse_dnr`, `neu`, `ma`
  - `azb`: `nr`, `name`, `vorname`, `ab-status`, `tel`, `email`, `ma`
- **Populated columns**: `nr`, `name`, `vorname`, `tel`, `email`. All others are emitted empty — no DB field backs them yet.
- **Logic**: all seller numbers across the event's pools that have `sellerDetails` set. See `CSV_EXPORT.md` for the long-form doc.

### GET /api/seller-number/now
- Returns `{ "now": "<ISO timestamp>" }`. Used by `src/lib/timeSync.ts` to compute a client/server clock offset at startup so session countdowns don't drift.

### GET /api/seller-number/cors-proxy
- **Query params**: `url`
- Server-side GET of `url`, response JSON cached 10 minutes via `cache.js`. Used by `withUrlResolving` to pull remote `introText` / `conditionsText` content.
- **Auth**: none — this is an open proxy to any URL, with the caller's headers forwarded. Keep that in mind before extending it.

## Key Business Logic

### Reservation
1. Validate `sellerNumberVariationId`
2. Look up variation → event category
3. Find an event for the category with `eventDate > now`
4. Load pools for (variation, event), drop pools outside their `obtainableFrom`/`obtainableTo` window
5. Expand `numbersAsJsonArray` into concrete numbers per pool
6. A number is obtainable when no `sellerNumbers` record exists for it, or the existing record has no `sellerDetails` **and** its `reservedAt` is older than `sessionTimeInSec`
7. Pick one at random, delete any stale record, create a new record with `reservedAt = now` (all inside a transaction)

> **Known inconsistency**: `reservation.pb.js` sorts events `-eventDate` with limit 1, so it picks the *furthest-future* event, while the frontend (`useUpcomingEventQuery`) sorts `eventDate` ascending and picks the *nearest* one. With more than one future event per category these disagree.

### Session Management
- `reservedAt` timestamp + per-category `sessionTimeInSec`
- Expired reservations become obtainable again (server and client both apply this rule)
- Client uses `getSyncedNow()` (server-offset clock) for all expiry math

### Registration emails (`pb_hooks/email.js`)
- **Support notification** → `eventCategories.supportEmail` (skipped with a warning when unset)
- **Seller confirmation** → the seller, including `conditionsText` and `additionalEmailText` (each optionally fetched from its `*Url` counterpart via `$http.send`, cached)
- Both use `$app.newMailClient().send()` with `$app.settings().meta.senderAddress` / `senderName`; failures are logged, not thrown — registration still succeeds if mail fails
- All copy is German

## Frontend Architecture

### Entry & routing
- `src/main.tsx` — `initSentry()`, then `await initializeTimeSync()` before rendering
- TanStack Router with **hash history**; routes in `src/routes/`, generated tree in `src/routeTree.gen.ts` (do not edit by hand)
- Flow: `index` → `variation.$variationId.sellerNumber.$sellerNumber/_withSessionCounter/{conditions,seller-details}` → `success`; `no-reservation` for the failure case

### Event category resolution (`src/context/EventCategoryIdContext.tsx`)
`?eventCategoryId=` search param wins; otherwise the current `window.location.host` is matched against `eventCategories.domain`.

### Realtime + polling (`src/clients/pocketbase.ts`, `src/clients/utils/polling.ts`)
Polling (5 s) is enabled by default and disabled once the realtime `PB_CONNECT` event arrives; it is re-enabled on realtime disconnect. `pb.autoCancellation(false)` is set.

### Query Structure (TanStack Query)
```typescript
// 1. Zod schema — its keys double as the PocketBase `fields` selection
const DataSchema = z.object({ id: z.string(), name: z.string() })

// 2. API function
const getData = async (params: string) =>
  DataSchema.array().parse(
    await pb.collection('collection').getFullList({
      filter: pb.filter('field = {:param}', { param: params }),
      fields: Object.keys(DataSchema.shape).join(','),
    })
  )

// 3. Hook
export const useDataQuery = () =>
  useQuery({
    queryKey: ['data', params],
    queryFn: withErrorLogging(async function getDataQuery() { return getData(params) }),
    staleTime: Infinity,
  })

// 4. Module-level realtime subscription invalidates the cache
void pb.collection('collection').subscribe('*', () => {
  void queryClient.invalidateQueries({ queryKey: ['data'] })
})
```
- `staleTime: Infinity` everywhere — freshness comes from realtime/polling invalidation, not refetch intervals
- Name the `queryFn` (`async function getDataQuery()`) — `withErrorLogging` uses the function name in its log output
- `useSellerNumbersQuery` is the exception: its subscription patches the cache directly per `create`/`update`/`delete` action instead of invalidating, falling back to invalidation on parse failure

### Mutation Structure
```typescript
const response = await pb.send<unknown>('/api/seller-number/endpoint', {
  method: 'POST',
  body: RequestSchema.parse(request),
})
return ResponseSchema.parse(response)
```
Wrap the mutationFn in `withErrorLogging`.

### Helpers
- `withUrlResolving(data, { resolverMap: { introTextUrl: 'introText' } })` — fetches URL fields through the cors-proxy and writes the result into the target field; supports a `#path.to.prop` hash to pick a nested JSON property
- `gracefulArray(schema)` — parses an array, dropping entries that fail validation
- `useDeviceUuid()` — persistent per-device UUID in localStorage, sent with registration and registered with Sentry
- `useCurrentTime()` / `getSyncedNow()` — server-offset time
- Registration results are cached in localStorage under `sellerDetails_${sellerNumberId}`

### API Call Best Practices
- **`pb.send<unknown>`** for custom endpoints, then Zod-parse the response
- **`pb.collection()`** for standard CRUD
- **Always validate** requests and responses with Zod
- **Always wrap** query/mutation functions in `withErrorLogging`

## Authentication

Only the CSV export requires auth. In PocketBase 0.30.0+ admins are "superusers" in the `_superusers` collection.

```javascript
routerAdd('GET', '/api/custom/endpoint', (e) => {
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  if (!authRecord || collectionName !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }
  // ...
})
```

## Testing

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

# Unauthenticated → {"error": "Unauthorized: Admin access required"}
curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id"
```

## Common Issues & Solutions

1. **"Object has no member 'dao'"** → Use `$app.findRecordById()` instead of `$app.dao()`
2. **"Object has no member 'json'"** → Use `DynamicModel` and `e.bindBody()`
3. **"invalid filter expression: expected a sign operator, got 'in'"** → Use OR conditions instead of IN
4. **`numbersAsJsonArray` is not an array** → It is a *text* field; `JSON.parse` it first
5. **"unknown field 'categoryName' / 'variationName' / 'numbers'"** → Correct names are `eventCategoryName`, `sellerNumberVariationName`, `numbersAsJsonArray`
6. **"Unauthorized: Admin access required"** → Authenticate against `_superusers` and send the `Authorization` header
7. **Blank page / no category resolved** → No `?eventCategoryId=` and no `eventCategories.domain` matching the current host; `EventCategoryIdProvider` renders `null` in that case
