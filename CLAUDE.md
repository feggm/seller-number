# Seller Number Project - CLAUDE.md

## Project Overview
This is a seller number reservation system built with PocketBase (backend) and React/Vite (frontend). The system manages seller number allocations for events, with time-based reservations and session management.

## Technology Stack
- **Backend**: PocketBase (JavaScript hooks)
- **Frontend**: React 19, Vite, TanStack Router, TanStack Query
- **Styling**: TailwindCSS 4.x
- **Database**: PocketBase (SQLite)
- **Package Manager**: npm

## Development Commands
```bash
# Install dependencies and PocketBase binary
npm install

# Start development (runs both PocketBase and Vite)
npm run dev

# Build production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Database Collections

### Core Collections:
1. **eventCategories**
   - Fields: `categoryName`, `sessionTimeInSec`
   - Purpose: Event categories with session timeout settings

2. **events**
   - Fields: `eventName`, `eventDate`, `eventCategory` (relation)
   - Purpose: Individual events linked to categories

3. **sellerNumberVariations**
   - Fields: `variationName`, `eventCategory` (relation)
   - Purpose: Different seller number types/variations

4. **sellerNumberPools**
   - Fields: `numbers` (JSON array), `sellerNumberVariation` (relation), `event` (relation)
   - Purpose: Available number ranges for specific variations and events

5. **sellerNumbers**
   - Fields: `sellerNumberNumber`, `sellerNumberPool` (relation), `reservedAt`, `sellerDetails` (relation)
   - Purpose: Individual allocated seller numbers

6. **sellerDetails**
   - Fields: User/seller information
   - Purpose: Store seller contact/details

## PocketBase API Patterns

### JavaScript Hooks Location
- `pb_hooks/` directory
- Files must end with `.pb.js`

### Correct API Usage (Updated 2025)
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

### Filter Syntax
❌ **INCORRECT:**
```javascript
'field in ("val1","val2")'  // "in" operator not supported
```

✅ **CORRECT:**
```javascript
'field = "val1" || field = "val2"'  // Use OR conditions
```

## API Endpoints

### POST /api/seller-number/reservation
- **Purpose**: Reserve the next available seller number
- **Input**: `{ "sellerNumberVariationId": "string" }`
- **Output**: `{ "sellerNumberId": "string" }` or error
- **Logic**: Finds upcoming event, checks available numbers, reserves first obtainable one

### GET /api/seller-number/export-csv
- **Purpose**: Export seller numbers with details as CSV file
- **Authentication**: **Required** - Admin authentication only
- **Query Parameters**:
  - `eventId` (required): The event ID to export data for
  - `mode` (optional): Export mode - either `"kkm"` or `"azb"` (default: `"kkm"`)
- **Output**: CSV file download
- **CSV Headers**:
  - **kkm mode**: `nr`, `dnr`, `babynr`, `name`, `vorname`, `Strasse`, `plz`, `ort`, `tel`, `email`, `interesse_dnr`, `neu`, `ma`
  - **azb mode**: `nr`, `name`, `vorname`, `ab-status`, `tel`, `ma`
- **Available Data**: Currently exports `nr` (seller number), `name` (last name), `vorname` (first name), `tel` (phone), `email`. Other fields are left empty as they are not yet implemented in the database.
- **Security**: This endpoint contains sensitive personal data (names, phone numbers, emails) and requires admin authentication. Returns 401 Unauthorized if not authenticated as admin.
- **Logic**: Fetches all seller numbers for an event that have completed registration (associated seller details), formats as CSV

## Key Business Logic

### Number Reservation Process:
1. Validate `sellerNumberVariationId`
2. Get seller number variation and event category
3. Find next upcoming event for the category
4. Get all seller number pools for variation/event
5. Resolve number ranges from pool data
6. Check existing reservations and session timeouts
7. Reserve first available number

### Session Management:
- Numbers are reserved with `reservedAt` timestamp
- Session timeout configured per event category (`sessionTimeInSec`)
- Expired reservations become available again

## Important Notes

### Database Field Names:
- Events use `eventDate` not `startDate`
- All collections have standard `created`/`updated` fields

### Development:
- PocketBase serves on port 8090 by default
- Frontend development server on different port (Vite default)
- Use `npm run dev` to run both concurrently

### Testing:
```bash
# Test reservation endpoint
curl -X POST http://localhost:8090/api/seller-number/reservation \
  -H "Content-Type: application/json" \
  -d '{"sellerNumberVariationId": "your_id_here"}'

# Test CSV export endpoint (requires admin authentication)
# First, authenticate as admin and get the token
curl -X POST http://localhost:8090/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity": "admin@example.com", "password": "your_admin_password"}' \
  | jq -r '.token'

# Then use the token to access the CSV export endpoint (kkm mode)
curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id&mode=kkm" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -o seller-numbers-kkm.csv

# CSV export with azb mode
curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id&mode=azb" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -o seller-numbers-azb.csv

# Without authentication, you'll get a 401 error
curl "http://localhost:8090/api/seller-number/export-csv?eventId=your_event_id" \
  # Returns: {"error": "Unauthorized: Admin access required"}
```

## Frontend Client Patterns

### Query Structure (TanStack Query)
All query files follow this pattern:
```typescript
// 1. Define Zod schemas for validation
const DataSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// 2. API function with error logging
const getData = async (params: string) => {
  return DataSchema.parse(
    await pb.collection('collection').getFullList({
      filter: pb.filter('field = {:param}', { param: params }),
      fields: Object.keys(DataSchema.shape).join(','),
    })
  )
}

// 3. Hook with query options
export const useDataQuery = () => {
  return useQuery({
    queryKey: ['data', params],
    queryFn: withErrorLogging(() => getData(params)),
    staleTime: Infinity,
  })
}
```

### Mutation Structure (TanStack Query)
For custom API endpoints (like reservation):
```typescript
// 1. Define request/response schemas
const RequestSchema = z.object({
  field: z.string(),
})

const ResponseSchema = z.object({
  result: z.string(),
})

// 2. API function using pb.send
const apiCall = async (request: z.infer<typeof RequestSchema>) => {
  const validatedRequest = RequestSchema.parse(request)

  const response = await pb.send<unknown>('/api/custom/endpoint', {
    method: 'POST',
    body: validatedRequest,
  })

  return ResponseSchema.parse(response)
}

// 3. Mutation hook
export const useApiMutation = () => {
  return useMutation({
    mutationFn: withErrorLogging(apiCall),
  })
}
```

### API Call Best Practices
- **Use `pb.send<unknown>`** for custom endpoints (not typed generics)
- **Always validate** with Zod schemas on both request and response
- **Use `withErrorLogging`** wrapper for consistent error handling
- **Use `pb.collection()`** for standard CRUD operations
- **Use `pb.send()`** for custom hook endpoints

## Authentication

### Admin Authentication
Some endpoints require admin authentication for security:
- **CSV Export** (`/api/seller-number/export-csv`) - Contains sensitive personal data

To authenticate:
1. Use the PocketBase admin panel (http://localhost:8090/_/) to create an admin account
2. Authenticate via `/api/collections/_superusers/auth-with-password` endpoint (PocketBase 0.30.0+)
3. Include the returned token in the `Authorization: Bearer <token>` header

**Note**: In PocketBase 0.30.0+, admins are now called "superusers" and stored in the `_superusers` collection.

### Authentication in JavaScript Hooks
Check authentication in custom endpoints (PocketBase 0.30.0+):
```javascript
routerAdd('GET', '/api/custom/endpoint', (e) => {
  // Require superuser authentication (PocketBase 0.30.0+)
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  if (!authRecord || collectionName !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  // Your endpoint logic here
})
```

## Common Issues & Solutions

1. **"Object has no member 'dao'"** → Use `$app.findRecordById()` instead of `$app.dao()`
2. **"Object has no member 'json'"** → Use `DynamicModel` and `e.bindBody()`
3. **"invalid filter expression: expected a sign operator, got 'in'"** → Use OR conditions instead of IN
4. **"unknown field 'startDate'"** → Use correct field name `eventDate`
5. **"Unauthorized: Admin access required"** → Ensure you're authenticated as admin and include the Authorization header
