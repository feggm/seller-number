# Time-Based Filtering Patterns

## Problem: Real-time UI Updates vs Database Filtering

When implementing time-based availability windows (obtainableFrom/obtainableTo), there's a tradeoff between:
- **Database-level filtering**: Efficient but prevents real-time updates
- **Client-side filtering**: Enables real-time updates but requires fetching all data

## Solution Pattern: Hybrid Approach

### Backend (PocketBase)
- Fetch all relevant records without time filtering
- Apply time-based filtering in JavaScript after database query
- Use standard `new Date()` since PocketBase is the authoritative time source

### Frontend (React)
- Use `useCurrentTime` hook for synced, reactive time updates
- Apply same filtering logic client-side with live time
- Include `nowDate` in useMemo dependencies for automatic re-filtering

## Key Benefits
1. **Real-time updates**: UI automatically shows newly available items when time windows open
2. **Time synchronization**: Consistent time handling across backend/frontend
3. **No manual refresh needed**: useCurrentTime updates every second
4. **Consistent logic**: Same filtering rules applied in both places

## Code Pattern
```javascript
// Frontend filtering with live updates
const { nowDate } = useCurrentTime()
const availableItems = useMemo(() => {
  return allItems?.filter(item => {
    if (item.availableFrom && nowDate < item.availableFrom) return false
    if (item.availableTo && nowDate > item.availableTo) return false
    return true
  })
}, [allItems, nowDate])
```

This pattern is particularly valuable for any time-sensitive business logic like reservations, sales windows, or scheduled content.