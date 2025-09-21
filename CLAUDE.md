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

## Common Issues & Solutions

1. **"Object has no member 'dao'"** → Use `$app.findRecordById()` instead of `$app.dao()`
2. **"Object has no member 'json'"** → Use `DynamicModel` and `e.bindBody()`
3. **"invalid filter expression: expected a sign operator, got 'in'"** → Use OR conditions instead of IN
4. **"unknown field 'startDate'"** → Use correct field name `eventDate`
