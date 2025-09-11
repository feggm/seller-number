# PocketBase API Patterns

## Database Query Filtering Best Practices

### When to Filter at Database Level
- Static filters that don't change (e.g., event relationships)
- Large datasets where you want to minimize data transfer
- Filters that significantly reduce result size

### When to Filter at Application Level
- Time-based filters that need real-time updates
- Complex business logic that's easier to express in JavaScript
- When you need reactive UI updates based on changing conditions

## Filter Syntax Patterns
```javascript
// Simple filters
pb.filter('field = {:value}', { value })

// Time-based filters (when needed at DB level)
pb.filter('date <= {:now}', { now: new Date().toISOString() })

// Empty field handling
pb.filter('(field = "" || field <= {:now})', { now })
```

## Backend vs Frontend Time Handling
- **Backend**: Use `new Date()` directly (PocketBase is authoritative)
- **Frontend**: Use `getSyncedNow()` and `useCurrentTime` for consistency
- **Pattern**: Sync time on app initialization, then use reactive time hooks for UI updates

## Performance Considerations
- Database filters are more efficient for large datasets
- Client-side filters enable better UX for time-sensitive data
- Consider data size vs UX requirements when choosing approach