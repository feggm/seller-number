# PocketBase Transactions (v0.30.0+)

## JavaScript Hooks Transaction API

### Correct Syntax (v0.30.0+)
```javascript
$app.runInTransaction((txApp) => {
  // Use txApp for all DB operations inside transaction
  const records = txApp.findRecordsByFilter('collection', 'filter', '', 0, 0)
  
  const collection = $app.findCollectionByNameOrId('collection')
  const record = new Record(collection)
  record.set('field', 'value')
  txApp.save(record)
  
  txApp.delete(existingRecord)
})
```

### WRONG Syntax (Pre-v0.30.0 or Go only)
```javascript
// ❌ Does NOT work in JavaScript hooks v0.30.0+
$app.dao().runInTransaction((txDao) => { ... })
```

### Key Points
- In `routerAdd` and other JavaScript hooks, use `$app.runInTransaction((txApp) => { ... })`
- The transaction callback receives `txApp` (NOT `txDao`)
- All DB operations inside transaction MUST use `txApp` (NOT `$app`)
- Transaction automatically commits on success or rolls back on error
- Variable scope: declare variables BEFORE transaction if needed outside:
  ```javascript
  let result
  $app.runInTransaction((txApp) => {
    result = txApp.save(record)
  })
  // Can use result here
  ```

## Use Cases

### Preventing Race Conditions
Wrap read-check-write operations in transaction to prevent concurrent modifications:

```javascript
routerAdd('POST', '/api/custom/endpoint', (e) => {
  let resultRecord
  
  $app.runInTransaction((txApp) => {
    // 1. Read current state
    const existing = txApp.findRecordsByFilter('collection', 'filter', '', 1, 0)
    
    // 2. Check condition
    if (existing.length === 0) {
      throw new BadRequestError('Not found')
    }
    
    // 3. Modify
    const record = existing[0]
    record.set('field', newValue)
    txApp.save(record)
    
    resultRecord = record
  })
  
  return e.json(200, { id: resultRecord.get('id') })
})
```

### Atomic Multi-Record Operations
Ensure all operations succeed or all fail:

```javascript
$app.runInTransaction((txApp) => {
  // Delete old record
  txApp.delete(oldRecord)
  
  // Create new record
  const collection = $app.findCollectionByNameOrId('collection')
  const newRecord = new Record(collection)
  newRecord.set('field', 'value')
  txApp.save(newRecord)
  
  // If any operation fails, entire transaction rolls back
})
```

## Error Handling

Throw errors to rollback transaction:
```javascript
$app.runInTransaction((txApp) => {
  // ... operations ...
  
  if (someCondition) {
    throw new BadRequestError('Validation failed') // Triggers rollback
  }
  
  // ... more operations ...
})
```

## Common Mistakes

1. **Using $app instead of txApp inside transaction**
   ```javascript
   ❌ $app.runInTransaction((txApp) => {
     $app.save(record) // WRONG - bypasses transaction
   })
   
   ✅ $app.runInTransaction((txApp) => {
     txApp.save(record) // CORRECT
   })
   ```

2. **Trying to use dao() method**
   ```javascript
   ❌ $app.dao().runInTransaction((txDao) => { ... }) // Does not exist
   ✅ $app.runInTransaction((txApp) => { ... })
   ```

3. **Variable scope issues**
   ```javascript
   ❌ $app.runInTransaction((txApp) => {
     let result = txApp.save(record)
   })
   console.log(result) // Undefined - out of scope
   
   ✅ let result
   $app.runInTransaction((txApp) => {
     result = txApp.save(record)
   })
   console.log(result) // Works
   ```
