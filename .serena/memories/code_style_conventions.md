# Code Style and Conventions

## PocketBase API Patterns (CRITICAL)

### Correct API Usage (Updated 2025)
✅ **CORRECT:**
```javascript
$app.findRecordById('collection', 'id')
$app.findRecordsByFilter('collection', 'filter', 'sort', limit, offset, params)
$app.save(record)
$app.findCollectionByNameOrId('collection')
```

### Request Body Handling
✅ **CORRECT:**
```javascript
const data = new DynamicModel({ field: '' })
e.bindBody(data)
const field = data.field
```

### Filter Syntax
✅ **CORRECT:**
```javascript
'field = "val1" || field = "val2"'  // Use OR conditions instead of IN operator
```

## Frontend Patterns

### Query Structure (TanStack Query)
- Define Zod schemas for validation
- API functions with error logging using `withErrorLogging`
- Use `pb.collection()` for CRUD, `pb.send()` for custom endpoints
- Always validate with Zod on request/response

### File Structure
- PocketBase hooks in `pb_hooks/` directory, files end with `.pb.js`
- Frontend source in `src/` with organized subdirectories