// Shared status/reporting core.
//
// Loads the event tree and classifies every seller number into
// registered / reserved / available, applying the *same* obtainability rule as
// `reservation.pb.js` so the counts match what a seller would actually be offered.
//
// Consumed by `status.pb.js` (superuser operational report, all categories) and
// `public-status.pb.js` (public per-category snapshot). Plain `.js` module — it registers
// no routes and is pulled in via `require(`${__hooks}/status-core.js`)`.
//
// NOTE: `reservation.pb.js` keeps its own copy of `resolveNumbers` on purpose — it is the
// hot path and is not touched for read-only features. The two must stay in sync; see the
// caveat on `resolveNumbers` below.

// Keep in sync with `resolveNumbers` in `reservation.pb.js`.
//
// KNOWN BUG, DELIBERATELY PRESERVED: the object branch tests `numberData.from` for
// truthiness, so a pool entry `{ "from": 0, "to": 10 }` is silently dropped because 0 is
// falsy. `reservation.pb.js` has the identical check, so both agree today. Fixing it here
// alone would make the status endpoints count numbers that reservations never hand out.
// Tracked in ToDo.md — fix both copies together or not at all.
const resolveNumbers = (numberDatas) => {
  const resolved = []

  if (!numberDatas || !Array.isArray(numberDatas)) return []

  for (const numberData of numberDatas) {
    if (typeof numberData === 'number') {
      resolved.push(numberData)
    } else if (
      numberData &&
      typeof numberData === 'object' &&
      !Array.isArray(numberData) &&
      numberData.from &&
      numberData.to
    ) {
      for (let i = numberData.from; i <= numberData.to; i++) {
        resolved.push(i)
      }
    } else if (Array.isArray(numberData) && numberData.length === 2) {
      const [from, to] = numberData
      if (typeof from === 'number' && typeof to === 'number') {
        for (let i = from; i <= to; i++) {
          resolved.push(i)
        }
      }
    }
  }

  return [...new Set(resolved)]
}

// The `in` operator is unsupported, and the id count is dynamic, so the filter is built by
// concatenation (same approach as `reservation.pb.js` / `csv-export.pb.js`).
const orFilterForIds = (field, ids) =>
  field + ' = "' + ids.join('" || ' + field + ' = "') + '"'

// Query errors degrade to an empty result plus a log line rather than failing the report.
const findRecords = (collection, filter, sort, params) => {
  try {
    return $app.findRecordsByFilter(collection, filter, sort || '', 0, 0, params) || []
  } catch (error) {
    $app.logger().warn('status: query failed', 'collection', collection, 'error', error.message)
    return []
  }
}

const emptyCounts = () => ({
  total: 0,
  registered: 0,
  reserved: 0,
  available: 0,
  expiredHolds: 0,
})

const addCounts = (target, source) => {
  if (!source) return target
  target.total += source.total
  target.registered += source.registered
  target.reserved += source.reserved
  target.available += source.available
  target.expiredHolds += source.expiredHolds
  return target
}

// PocketBase date fields come back as "2026-01-15 17:00:00.000Z"; `new Date()` needs the T.
const parseDbDate = (value) => new Date(String(value).replace(' ', 'T'))

// The inverse, and it matters more than it looks: date comparisons in a filter are STRING
// comparisons in SQLite, and PocketBase stores dates with a space separator. Passing a raw
// `toISOString()` (which uses "T", 0x54) as a bound parameter therefore sorts *after* every
// stored value of the same day (" ", 0x20), so a filter like `bucketAt >= {:from}` silently
// matches nothing whenever `from` is within the same day.
//
// Always run a date through this before using it as a filter parameter.
const toDbDate = (date) => date.toISOString().replace('T', ' ')

// Loads the whole tree in 5 bulk queries, no per-pool round trips, and returns it together
// with the indexes needed for O(1) in-memory joins.
//
// `eventCategoryIds` is optional: when given, the `events` query is narrowed to those
// categories and everything downstream narrows with it.
const loadTree = ({ now, eventCategoryIds }) => {
  const eventCategories = eventCategoryIds && eventCategoryIds.length
    ? findRecords(
        'eventCategories',
        orFilterForIds('id', eventCategoryIds),
        'eventCategoryName'
      )
    : findRecords('eventCategories', 'id != ""', 'eventCategoryName')

  const eventsFilter =
    eventCategoryIds && eventCategoryIds.length
      ? 'eventDate > {:now} && (' + orFilterForIds('eventCategory', eventCategoryIds) + ')'
      : 'eventDate > {:now}'

  const events = findRecords('events', eventsFilter, 'eventDate', {
    now: toDbDate(now),
  })

  const eventIds = events.map((event) => event.get('id'))
  const pools = eventIds.length
    ? findRecords('sellerNumberPools', orFilterForIds('event', eventIds))
    : []

  const variationIds = [...new Set(pools.map((pool) => pool.get('sellerNumberVariation')))].filter(
    (id) => !!id
  )
  const variations = variationIds.length
    ? findRecords(
        'sellerNumberVariations',
        orFilterForIds('id', variationIds),
        'sellerNumberVariationName'
      )
    : []

  const poolIds = pools.map((pool) => pool.get('id'))
  const sellerNumbers = poolIds.length
    ? findRecords('sellerNumbers', orFilterForIds('sellerNumberPool', poolIds))
    : []

  // ---- index for in-memory joins ----

  const variationsById = {}
  for (const variation of variations) {
    variationsById[variation.get('id')] = variation
  }

  const poolsByEventId = {}
  for (const pool of pools) {
    const eventId = pool.get('event')
    if (!poolsByEventId[eventId]) poolsByEventId[eventId] = []
    poolsByEventId[eventId].push(pool)
  }

  const eventsByCategoryId = {}
  for (const event of events) {
    const categoryId = event.get('eventCategory')
    if (!eventsByCategoryId[categoryId]) eventsByCategoryId[categoryId] = []
    eventsByCategoryId[categoryId].push(event)
  }

  return {
    eventCategories,
    events,
    pools,
    variations,
    sellerNumbers,
    poolIds,
    variationsById,
    poolsByEventId,
    eventsByCategoryId,
    sellerNumbersByPoolAndNumber: indexSellerNumbers(sellerNumbers),
  }
}

// sellerNumbers keyed by "<poolId>:<number>" so classification is O(1) per number.
const indexSellerNumbers = (sellerNumbers) => {
  const index = {}
  for (const sellerNumber of sellerNumbers) {
    const key = sellerNumber.get('sellerNumberPool') + ':' + sellerNumber.get('sellerNumberNumber')
    index[key] = sellerNumber
  }
  return index
}

// Returns the counts for one pool, or null when `numbersAsJsonArray` is unparseable — in
// which case a warning is pushed onto `warnings` and the caller keeps going.
//
// `warnings` may be a throwaway array when the caller does not surface warnings.
const classifyPool = (pool, sessionTimeInSec, index, now, warnings) => {
  let parsed
  try {
    parsed = JSON.parse(pool.get('numbersAsJsonArray'))
  } catch (error) {
    warnings.push({
      scope: 'pool',
      id: pool.get('id'),
      message:
        'numbersAsJsonArray is not valid JSON, the pool contributes no numbers: ' +
        error.message,
    })
    return null
  }

  const counts = emptyCounts()

  for (const number of resolveNumbers(parsed)) {
    counts.total++

    const existing = index[pool.get('id') + ':' + number]
    if (!existing) {
      counts.available++
      continue
    }

    if (existing.get('sellerDetails')) {
      counts.registered++
      continue
    }

    // Held but not registered. `reservation.pb.js` only applies the expiry check when
    // sessionTimeInSec is truthy — without it a hold never expires.
    const reservedAt = existing.get('reservedAt')
    let isExpired = false
    if (reservedAt && sessionTimeInSec) {
      const ageInSec = (now.getTime() - parseDbDate(reservedAt).getTime()) / 1000
      isExpired = ageInSec > sessionTimeInSec
    }

    if (isExpired) {
      counts.available++
      counts.expiredHolds++
    } else {
      counts.reserved++
    }
  }

  return counts
}

const isObtainableNow = (pool, now) => {
  const obtainableFrom = pool.get('obtainableFrom')
  const obtainableTo = pool.get('obtainableTo')

  if (obtainableFrom && obtainableFrom !== '') {
    if (now < parseDbDate(obtainableFrom)) return false
  }
  if (obtainableTo && obtainableTo !== '') {
    if (now > parseDbDate(obtainableTo)) return false
  }
  return true
}

// Counts realtime clients subscribed to one category's tag topic.
//
// `totalClients()` is process-global across every domain this PocketBase serves, so it must be
// filtered by topic. The tag is an otherwise no-op subscription the frontend opens in
// `useCategoryPresence.ts`; exact match is enough because it carries no `?options=` suffix.
// (If options are ever added, switch to `client.subscriptions(topic).length > 0`, which is
// prefix-tolerant but iterates a dict.)
//
// This counts SSE CONNECTIONS — one per browser tab, since `pb` is a module singleton — not
// people and not devices. Label it accordingly in the UI.
const countCategoryClients = (eventCategoryId) => {
  const topic = 'eventCategories/' + eventCategoryId
  let count = 0

  try {
    const chunks = $app.subscriptionsBroker().chunkedClients(500)
    for (const chunk of chunks) {
      for (const client of chunk) {
        if (client.isDiscarded()) continue
        if (client.hasSubscription(topic)) count++
      }
    }
  } catch (error) {
    $app.logger().warn('status: client count failed', 'error', error.message)
    return 0
  }

  return count
}

module.exports = {
  resolveNumbers,
  orFilterForIds,
  findRecords,
  countCategoryClients,
  emptyCounts,
  addCounts,
  parseDbDate,
  toDbDate,
  loadTree,
  indexSellerNumbers,
  classifyPool,
  isObtainableNow,
}
