// Public status endpoints for the live status page (`/#/live`).
//
//   GET /api/seller-number/public-status?eventCategoryId=<id>
//   GET /api/seller-number/public-status/history?eventCategoryId=<id>&windowMinutes=60
//
// No auth. Scoped to ONE event category, which the frontend resolves from the domain and
// passes in — the same `?eventCategoryId=` convention `EventCategoryIdContext` already uses.
// Nothing is lost by taking the id from the caller: eventCategories.listRule is "", so every
// id and domain is already publicly listable.
//
// Deliberately NOT the same handler as `status.pb.js`. That endpoint's superuser gate is four
// unconditional lines guarding an all-categories report that includes supportEmail, raw
// numbersSpec and config warnings. Making that gate conditional would be the single riskiest
// edit in this repo. Two files, two unconditional policies. The counting logic they share
// lives in `status-core.js`.
//
// Emits counts and release times. Never emits: supportEmail, sessionTimeInSec, domain, the
// raw numbersAsJsonArray, config warnings, app settings, pool ids — or anything at all from
// sellerDetails beyond aggregate counts and bucketed `created` timestamps.
//
// NB: every helper and constant lives INSIDE its handler. Handlers registered with routerAdd
// execute in an isolated scope and cannot see the file's module scope — a helper defined at
// the top of this file is simply undefined at request time. Shared code goes through
// `require()` (which does work inside a handler), never through an outer binding.

routerAdd('GET', '/api/seller-number/public-status', (e) => {
  const { formatBerlin, berlinZoneInfo } = require(`${__hooks}/berlin-time.js`)
  const {
    emptyCounts,
    addCounts,
    loadTree,
    classifyPool,
    isObtainableNow,
    parseDbDate,
    countCategoryClients,
  } = require(`${__hooks}/status-core.js`)
  const { recordSample } = require(`${__hooks}/status-samples.js`)

  // Not cacheable: the figures are live, and this route has a write side-effect (sampling).
  // `cache-headers.pb.js` leaves /api/* alone, so nothing else would set this.
  e.response.header().set('Cache-Control', 'no-store')

  const eventCategoryId = e.request.url.query().get('eventCategoryId')
  if (!eventCategoryId) {
    return e.json(400, { error: 'eventCategoryId is required' })
  }

  let category
  try {
    category = $app.findRecordById('eventCategories', eventCategoryId)
  } catch (error) {
    return e.json(404, { error: 'Event category not found' })
  }

  try {
    const now = new Date()
    const categoryId = category.get('id')
    const sessionTimeInSec = category.get('sessionTimeInSec')

    const { eventsByCategoryId, poolsByEventId, variationsById, sellerNumbersByPoolAndNumber } =
      loadTree({ now, eventCategoryIds: [categoryId] })

    const categoryEvents = eventsByCategoryId[categoryId] || []

    // `events` comes back sorted ascending, so index 0 is the NEAREST upcoming event — the one
    // `useUpcomingEventQuery` offers. `reservation.pb.js` sorts '-eventDate' and would pick the
    // furthest instead; ToDo.md records the frontend behaviour as the correct one. The choice
    // is in the payload so the page can say which event the figures describe.
    const targetEvent = categoryEvents.length ? categoryEvents[0] : null
    const reservationTarget = categoryEvents.length
      ? categoryEvents[categoryEvents.length - 1]
      : null

    const connections = countCategoryClients(categoryId)

    // Sample the connection count. Deduped per 5s bucket by a unique index, so this stays at
    // one write per bucket no matter how many people have the page open. Never throws.
    recordSample({ eventCategoryId: categoryId, connections, source: 'live', now })

    // Collects the release window across a set of pools. `nextOpensAt` is the earliest
    // obtainableFrom still in the future — that is the "wann werden Nummern freigeschaltet"
    // answer, in one field.
    const collectRelease = (pools) => {
      let open = false
      let earliestFrom = null
      let latestTo = null
      let nextOpensAt = null

      for (const pool of pools) {
        if (isObtainableNow(pool, now)) open = true

        const from = pool.get('obtainableFrom')
        if (from && from !== '') {
          const fromDate = parseDbDate(from)
          if (!earliestFrom || fromDate < earliestFrom) earliestFrom = fromDate
          if (fromDate > now && (!nextOpensAt || fromDate < nextOpensAt)) nextOpensAt = fromDate
        }

        const to = pool.get('obtainableTo')
        if (to && to !== '') {
          const toDate = parseDbDate(to)
          if (!latestTo || toDate > latestTo) latestTo = toDate
        }
      }

      return {
        isObtainableNow: open,
        obtainableFrom: earliestFrom ? formatBerlin(earliestFrom) : null,
        obtainableTo: latestTo ? formatBerlin(latestTo) : null,
        nextOpensAt: nextOpensAt ? formatBerlin(nextOpensAt) : null,
      }
    }

    if (!targetEvent) {
      return e.json(200, {
        generatedAt: formatBerlin(now),
        timezone: berlinZoneInfo(now),
        eventCategory: { id: categoryId, name: category.get('eventCategoryName') },
        event: null,
        eventSelection: 'nearestUpcoming',
        reservationTargetMatches: true,
        numbers: emptyCounts(),
        variations: [],
        release: {
          isObtainableNow: false,
          obtainableFrom: null,
          obtainableTo: null,
          nextOpensAt: null,
        },
        connections,
      })
    }

    const eventId = targetEvent.get('id')
    const eventPools = poolsByEventId[eventId] || []

    // group this event's pools by variation
    const poolsByVariationId = {}
    for (const pool of eventPools) {
      const variationId = pool.get('sellerNumberVariation')
      if (!poolsByVariationId[variationId]) poolsByVariationId[variationId] = []
      poolsByVariationId[variationId].push(pool)
    }

    const eventNumbers = emptyCounts()
    const throwawayWarnings = []

    // Pools are rolled up into their variation and the pool layer is dropped entirely: the
    // public question is "Damen: noch 120 von 400 frei", and pool ids plus their individual
    // windows are configuration detail.
    const variations = Object.keys(poolsByVariationId).map((variationId) => {
      const variation = variationsById[variationId]
      const variationPools = poolsByVariationId[variationId]
      const variationNumbers = emptyCounts()

      for (const pool of variationPools) {
        addCounts(
          variationNumbers,
          classifyPool(
            pool,
            sessionTimeInSec,
            sellerNumbersByPoolAndNumber,
            now,
            throwawayWarnings
          )
        )
      }

      addCounts(eventNumbers, variationNumbers)

      return {
        id: variationId,
        name: variation ? variation.get('sellerNumberVariationName') : null,
        numbers: variationNumbers,
        release: collectRelease(variationPools),
      }
    })

    return e.json(200, {
      generatedAt: formatBerlin(now),
      timezone: berlinZoneInfo(now),
      eventCategory: { id: categoryId, name: category.get('eventCategoryName') },
      event: {
        id: eventId,
        name: targetEvent.get('eventName'),
        eventDate: formatBerlin(targetEvent.get('eventDate'), { dateOnlyAtMidnight: true }),
      },
      eventSelection: 'nearestUpcoming',
      reservationTargetMatches: reservationTarget ? reservationTarget.get('id') === eventId : true,
      numbers: eventNumbers,
      variations,
      release: collectRelease(eventPools),
      connections,
    })
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in public-status endpoint', 'error', {
      message: error.message,
      stack: error.stack,
    })
    return e.json(500, { error: 'Internal server error' })
  }
})

routerAdd('GET', '/api/seller-number/public-status/history', (e) => {
  const { formatBerlin } = require(`${__hooks}/berlin-time.js`)
  const { loadTree, parseDbDate, orFilterForIds, findRecords } =
    require(`${__hooks}/status-core.js`)
  const { BUCKET_SECONDS, bucketStart, readSamples } = require(`${__hooks}/status-samples.js`)

  const HISTORY_MAX_POINTS = 720
  const HISTORY_DEFAULT_WINDOW_MINUTES = 60
  const HISTORY_MAX_WINDOW_MINUTES = 24 * 60

  e.response.header().set('Cache-Control', 'no-store')

  const eventCategoryId = e.request.url.query().get('eventCategoryId')
  if (!eventCategoryId) {
    return e.json(400, { error: 'eventCategoryId is required' })
  }

  let category
  try {
    category = $app.findRecordById('eventCategories', eventCategoryId)
  } catch (error) {
    return e.json(404, { error: 'Event category not found' })
  }

  try {
    const now = new Date()
    const categoryId = category.get('id')

    const requestedWindow = parseInt(e.request.url.query().get('windowMinutes'), 10)
    const windowMinutes = Math.min(
      Math.max(
        Number.isFinite(requestedWindow) ? requestedWindow : HISTORY_DEFAULT_WINDOW_MINUTES,
        1
      ),
      HISTORY_MAX_WINDOW_MINUTES
    )
    const from = new Date(now.getTime() - windowMinutes * 60 * 1000)

    // Widen the bucket when the window is long enough that 5s would blow the point budget.
    const bucketSeconds = Math.max(
      BUCKET_SECONDS,
      Math.ceil((windowMinutes * 60) / HISTORY_MAX_POINTS / BUCKET_SECONDS) * BUCKET_SECONDS
    )

    // ---- connections: read the persisted samples ----

    const connectionBuckets = new Map()
    for (const sample of readSamples({ eventCategoryId: categoryId, from, limit: 0 })) {
      const t = bucketStart(parseDbDate(sample.get('bucketAt')), bucketSeconds).toISOString()
      // Several 5s samples can fall into one widened bucket; keep the peak, which is the
      // honest summary for a concurrency figure.
      const current = connectionBuckets.get(t)
      const value = sample.get('connections') || 0
      if (current === undefined || value > current) connectionBuckets.set(t, value)
    }

    // ---- registrations: derived live, never sampled ----
    //
    // sellerDetails carries a real `created` timestamp per registration, so this curve is
    // exact, survives reload and deploy, and needs no storage. sellerDetails has no path back
    // to a category — the only link is sellerNumbers.sellerDetails — so the rows are loaded
    // via their seller numbers and expanded.
    //
    // (`sellerNumbers.updated` would be the registration instant too, and free, but it breaks
    // silently the moment anyone edits a row in the admin UI. It is kept only as a fallback
    // for rows whose expand comes up empty.)

    const { poolsByEventId, eventsByCategoryId } = loadTree({
      now,
      eventCategoryIds: [categoryId],
    })

    const categoryEvents = eventsByCategoryId[categoryId] || []
    const targetEvent = categoryEvents.length ? categoryEvents[0] : null
    const eventPools = targetEvent ? poolsByEventId[targetEvent.get('id')] || [] : []
    const poolIds = eventPools.map((pool) => pool.get('id'))

    const registrationBuckets = new Map()
    let registrationsTotal = 0

    if (poolIds.length) {
      const registered = findRecords(
        'sellerNumbers',
        '(' + orFilterForIds('sellerNumberPool', poolIds) + ') && sellerDetails != ""',
        'created'
      )

      if (registered.length) {
        try {
          $app.expandRecords(registered, ['sellerDetails'], null)
        } catch (error) {
          $app.logger().warn('public-status: expand failed', 'error', error.message)
        }

        for (const row of registered) {
          let createdAt = null
          try {
            const details = row.expandedOne('sellerDetails')
            if (details) createdAt = parseDbDate(details.get('created'))
          } catch (error) {
            createdAt = null
          }
          if (!createdAt || isNaN(createdAt.getTime())) {
            createdAt = parseDbDate(row.get('updated'))
          }
          if (!createdAt || isNaN(createdAt.getTime())) continue

          registrationsTotal++
          if (createdAt < from) continue

          const t = bucketStart(createdAt, bucketSeconds).toISOString()
          registrationBuckets.set(t, (registrationBuckets.get(t) || 0) + 1)
        }
      }
    }

    const toSeries = (map, key) =>
      [...map.keys()]
        .sort()
        .slice(-HISTORY_MAX_POINTS)
        .map((t) => {
          const point = { t }
          point[key] = map.get(t)
          return point
        })

    return e.json(200, {
      bucketSeconds,
      from: formatBerlin(from),
      to: formatBerlin(now),
      registrations: toSeries(registrationBuckets, 'n'),
      registrationsTotal,
      connections: toSeries(connectionBuckets, 'c'),
    })
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in public-status history endpoint', 'error', {
      message: error.message,
      stack: error.stack,
    })
    return e.json(500, { error: 'Internal server error' })
  }
})
