# Seller Number Project - CLAUDE.md

Seller number reservation system: PocketBase (backend, JS hooks in `pb_hooks/`) + React/Vite
frontend (built into `pb_public/`, served by the same PocketBase binary). Sellers pick a
variation, get a randomly assigned number reserved for a time-boxed session, then complete
registration — which stores their details and triggers confirmation emails. All UI copy is German.

**Reference docs** — read these instead of re-deriving from source:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — collection schema, every endpoint,
  business logic, frontend structure, local API testing commands
- [`CSV_EXPORT.md`](./CSV_EXPORT.md) — CSV export columns, auth, error payloads
- [`README.md`](./README.md) — what the app does, getting started, repo layout
- [`ToDo.md`](./ToDo.md) — known issues

## Stack

PocketBase 0.30.0 (`.pbversion`) · React 19 · Vite 6 · TanStack Router (hash history) / Query v5
/ Form · Zod 3 · TailwindCSS 4 with shadcn-style components in `src/components/ui` · Sentry ·
npm, Node 22 (`.nvmrc`)

```bash
npm install       # deps + downloads the matching PocketBase binary (postinstall)
npm run dev       # PocketBase :8090 + Vite
npm run build     # tsc -b && vite build → pb_public/
npm run typecheck
npm run lint
npm start         # production: PocketBase serves pb_public/
npm run deploy:ssh
```

## PocketBase hook conventions

Route-registering files must end with `.pb.js`; plain `.js` files (`cache.js`, `email.js`) are
shared modules loaded via ``require(`${__hooks}/name.js`)``.

**API usage** — the `dao()` API is gone in 0.30:

```javascript
// ❌ OLD                          // ✅ CORRECT
$app.dao().findFirstRecordByData() $app.findRecordById('collection', 'id')
$app.dao().saveRecord()            $app.findRecordsByFilter('collection', 'filter', 'sort', limit, offset, params)
                                   $app.save(record)
                                   $app.findCollectionByNameOrId('collection')
                                   $app.runInTransaction((txApp) => { /* txApp.save/delete/... */ })
```

**Request bodies** — `e.request.body.json()` does not exist:

```javascript
const data = new DynamicModel({ field: '' })
e.bindBody(data)
const field = data.field
```

Query params: `e.request.url.query().get('name')`. Client IP: `e.realIP()`.

**Filters** — the `in` operator is unsupported; use OR conditions:

```javascript
'field = "val1" || field = "val2"'
```

Prefer bound params (`'event = {:eventId}'` + a params object) over string concatenation. The
multi-id OR filters in `reservation.pb.js` / `csv-export.pb.js` are built by concatenation
because the param count is dynamic.

**Auth** — only the CSV export requires it. In 0.30.0+ admins are "superusers":

```javascript
const authRecord = e.auth
const collectionName = authRecord ? authRecord.collection().name : null
if (!authRecord || collectionName !== '_superusers') {
  return e.json(401, { error: 'Unauthorized: Admin access required' })
}
```

## Frontend conventions

**Query structure** (TanStack Query):

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

- `staleTime: Infinity` everywhere — freshness comes from realtime/polling invalidation, not
  refetch intervals
- Name the `queryFn` (`async function getDataQuery()`) — `withErrorLogging` uses the function
  name in its log output
- `useSellerNumbersQuery` is the exception: its subscription patches the cache directly per
  `create`/`update`/`delete` action instead of invalidating, falling back to invalidation on
  parse failure

**Mutation structure:**

```typescript
const response = await pb.send<unknown>('/api/seller-number/endpoint', {
  method: 'POST',
  body: RequestSchema.parse(request),
})
return ResponseSchema.parse(response)
```

Wrap the mutationFn in `withErrorLogging`.

**API calls:** `pb.send<unknown>` for custom endpoints, then Zod-parse the response;
`pb.collection()` for standard CRUD. Always validate both directions with Zod, and always wrap
query/mutation functions in `withErrorLogging`.

## Common issues

1. **"Object has no member 'dao'"** → Use `$app.findRecordById()` instead of `$app.dao()`
2. **"Object has no member 'json'"** → Use `DynamicModel` and `e.bindBody()`
3. **"invalid filter expression: expected a sign operator, got 'in'"** → Use OR conditions
4. **`numbersAsJsonArray` is not an array** → It is a *text* field; `JSON.parse` it first.
   Entries may be `5`, `{ "from": 1, "to": 10 }`, or `[1, 10]`
5. **"unknown field 'categoryName' / 'variationName' / 'numbers'"** → Correct names are
   `eventCategoryName`, `sellerNumberVariationName`, `numbersAsJsonArray`
6. **"Unauthorized: Admin access required"** → Authenticate against `_superusers` and send the
   `Authorization` header
7. **Blank page / no category resolved** → No `?eventCategoryId=` and no
   `eventCategories.domain` matching the current host; `EventCategoryIdProvider` renders `null`
8. **Reservation picks an unexpected event** → `reservation.pb.js` sorts `-eventDate` (furthest
   future) while `useUpcomingEventQuery` sorts ascending (nearest). See `docs/ARCHITECTURE.md`
