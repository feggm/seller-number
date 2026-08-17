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
