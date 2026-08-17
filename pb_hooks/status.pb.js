// GET /api/seller-number/status
//
// Read-only operational report: every event category, its upcoming events, their seller number
// variations and pools, with a per-pool breakdown of registered / reserved / available numbers.
// Applies the same obtainability rule as `reservation.pb.js` so the counts match what a seller
// would actually be offered.
//
// Superuser only. Emits counts, never seller PII — that stays the CSV export's job.
routerAdd('GET', '/api/seller-number/status', (e) => {
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  if (!authRecord || collectionName !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const { formatBerlin, berlinZoneInfo } = require(`${__hooks}/berlin-time.js`)

  // Keep in sync with `resolveNumbers` in `reservation.pb.js`. Deliberately duplicated rather
  // than extracted into a shared module: the reservation endpoint is the hot path and should
  // not be touched for a read-only feature.
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

  try {
    const now = new Date()
    const warnings = []

    // ---- load everything up front (5 queries, no per-pool round trips) ----

    const eventCategories = findRecords(
      'eventCategories',
      'id != ""',
      'eventCategoryName'
    )

    const events = findRecords('events', 'eventDate > {:now}', 'eventDate', {
      now: now.toISOString(),
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

    // sellerNumbers keyed by "<poolId>:<number>" so classification is O(1) per number.
    const sellerNumbersByPoolAndNumber = {}
    for (const sellerNumber of sellerNumbers) {
      const key = sellerNumber.get('sellerNumberPool') + ':' + sellerNumber.get('sellerNumberNumber')
      sellerNumbersByPoolAndNumber[key] = sellerNumber
    }

    const eventsByCategoryId = {}
    for (const event of events) {
      const categoryId = event.get('eventCategory')
      if (!eventsByCategoryId[categoryId]) eventsByCategoryId[categoryId] = []
      eventsByCategoryId[categoryId].push(event)
    }

    // ---- per-pool classification ----

    const classifyPool = (pool, sessionTimeInSec) => {
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

        const existing = sellerNumbersByPoolAndNumber[pool.get('id') + ':' + number]
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
          const ageInSec = (now.getTime() - new Date(String(reservedAt).replace(' ', 'T')).getTime()) / 1000
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

    const isObtainableNow = (pool) => {
      const obtainableFrom = pool.get('obtainableFrom')
      const obtainableTo = pool.get('obtainableTo')

      if (obtainableFrom && obtainableFrom !== '') {
        if (now < new Date(String(obtainableFrom).replace(' ', 'T'))) return false
      }
      if (obtainableTo && obtainableTo !== '') {
        if (now > new Date(String(obtainableTo).replace(' ', 'T'))) return false
      }
      return true
    }

    // ---- build the report ----

    const totals = {
      eventCategories: eventCategories.length,
      upcomingEvents: 0,
      pools: 0,
      numbers: emptyCounts(),
    }

    const eventCategoriesReport = eventCategories.map((category) => {
      const categoryId = category.get('id')
      const sessionTimeInSec = category.get('sessionTimeInSec')
      const categoryEvents = eventsByCategoryId[categoryId] || []

      if (!sessionTimeInSec) {
        warnings.push({
          scope: 'eventCategory',
          id: categoryId,
          message:
            'sessionTimeInSec is not set for "' +
            category.get('eventCategoryName') +
            '"; reservations never expire and stay blocked forever.',
        })
      }

      // `events` is sorted ascending, so index 0 is the nearest and the last is the furthest.
      const frontendTargetId = categoryEvents.length ? categoryEvents[0].get('id') : null
      const reservationTargetId = categoryEvents.length
        ? categoryEvents[categoryEvents.length - 1].get('id')
        : null

      if (frontendTargetId && reservationTargetId && frontendTargetId !== reservationTargetId) {
        warnings.push({
          scope: 'eventCategory',
          id: categoryId,
          message:
            'Category "' +
            category.get('eventCategoryName') +
            '" has ' +
            categoryEvents.length +
            ' upcoming events. The UI offers "' +
            categoryEvents[0].get('eventName') +
            '" (nearest) but reservation.pb.js creates reservations against "' +
            categoryEvents[categoryEvents.length - 1].get('eventName') +
            '" (furthest). See ToDo.md.',
        })
      }

      const categoryNumbers = emptyCounts()

      const upcomingEvents = categoryEvents.map((event) => {
        const eventId = event.get('id')
        const eventPools = poolsByEventId[eventId] || []
        const eventNumbers = emptyCounts()

        // group this event's pools by variation
        const poolsByVariationId = {}
        for (const pool of eventPools) {
          const variationId = pool.get('sellerNumberVariation')
          if (!poolsByVariationId[variationId]) poolsByVariationId[variationId] = []
          poolsByVariationId[variationId].push(pool)
        }

        const variationsReport = Object.keys(poolsByVariationId).map((variationId) => {
          const variation = variationsById[variationId]
          const variationNumbers = emptyCounts()

          const poolsReport = poolsByVariationId[variationId].map((pool) => {
            const counts = classifyPool(pool, sessionTimeInSec)
            addCounts(variationNumbers, counts)
            totals.pools++

            return {
              id: pool.get('id'),
              obtainableFrom: formatBerlin(pool.get('obtainableFrom')),
              obtainableTo: formatBerlin(pool.get('obtainableTo')),
              isObtainableNow: isObtainableNow(pool),
              numbersSpec: pool.get('numbersAsJsonArray'),
              numbers: counts,
            }
          })

          if (!variation) {
            warnings.push({
              scope: 'sellerNumberVariation',
              id: variationId,
              message:
                'Pools reference seller number variation "' +
                variationId +
                '", which could not be loaded.',
            })
          }

          addCounts(eventNumbers, variationNumbers)

          return {
            id: variationId,
            name: variation ? variation.get('sellerNumberVariationName') : null,
            numbers: variationNumbers,
            pools: poolsReport,
          }
        })

        if (eventPools.length === 0) {
          warnings.push({
            scope: 'event',
            id: eventId,
            message:
              'Event "' +
              event.get('eventName') +
              '" has no seller number pools; no number can be reserved for it.',
          })
        }

        addCounts(categoryNumbers, eventNumbers)
        totals.upcomingEvents++

        return {
          id: eventId,
          name: event.get('eventName'),
          eventDate: formatBerlin(event.get('eventDate'), { dateOnly: true }),
          isFrontendTarget: eventId === frontendTargetId,
          isReservationTarget: eventId === reservationTargetId,
          numbers: eventNumbers,
          variations: variationsReport,
        }
      })

      addCounts(totals.numbers, categoryNumbers)

      return {
        id: categoryId,
        name: category.get('eventCategoryName'),
        domain: category.get('domain'),
        sessionTimeInSec: sessionTimeInSec,
        supportEmail: category.get('supportEmail'),
        numbers: categoryNumbers,
        upcomingEvents: upcomingEvents,
      }
    })

    let server = { appName: null, appUrl: null }
    try {
      const settings = $app.settings()
      server = { appName: settings.meta.appName, appUrl: settings.meta.appURL }
    } catch (error) {
      $app.logger().warn('status: could not read app settings', 'error', error.message)
    }

    return e.json(200, {
      generatedAt: formatBerlin(now),
      timezone: berlinZoneInfo(now),
      server: server,
      totals: totals,
      eventCategories: eventCategoriesReport,
      warnings: warnings,
    })
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in status endpoint', 'error', {
      message: error.message,
      stack: error.stack,
    })
    return e.json(500, {
      error: 'Internal server error',
      details: error.message,
    })
  }
})
