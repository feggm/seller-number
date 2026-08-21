// GET /api/seller-number/status
//
// Read-only operational report: every event category, its upcoming events, their seller number
// variations and pools, with a per-pool breakdown of registered / reserved / available numbers.
// Applies the same obtainability rule as `reservation.pb.js` so the counts match what a seller
// would actually be offered.
//
// Superuser only. Emits counts, never seller PII — that stays the CSV export's job.
//
// The tree loading and per-pool classification live in `status-core.js`, shared with the
// public per-category endpoint in `public-status.pb.js`.
routerAdd('GET', '/api/seller-number/status', (e) => {
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  if (!authRecord || collectionName !== '_superusers') {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const { formatBerlin, berlinZoneInfo } = require(`${__hooks}/berlin-time.js`)
  const {
    emptyCounts,
    addCounts,
    loadTree,
    classifyPool,
    isObtainableNow,
  } = require(`${__hooks}/status-core.js`)

  try {
    const now = new Date()
    const warnings = []

    // ---- load everything up front (5 queries, no per-pool round trips) ----

    const {
      eventCategories,
      variationsById,
      poolsByEventId,
      eventsByCategoryId,
      sellerNumbersByPoolAndNumber,
    } = loadTree({ now })

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

      if (categoryEvents.length === 0) {
        warnings.push({
          scope: 'eventCategory',
          id: categoryId,
          message:
            'Category "' +
            category.get('eventCategoryName') +
            '" has no upcoming event' +
            (category.get('domain') ? ' — ' + category.get('domain') : '') +
            ' cannot hand out a number; reservations fail with "No upcoming event found".',
        })
      }

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
            const counts = classifyPool(
              pool,
              sessionTimeInSec,
              sellerNumbersByPoolAndNumber,
              now,
              warnings
            )
            addCounts(variationNumbers, counts)
            totals.pools++

            return {
              id: pool.get('id'),
              obtainableFrom: formatBerlin(pool.get('obtainableFrom')),
              obtainableTo: formatBerlin(pool.get('obtainableTo')),
              isObtainableNow: isObtainableNow(pool, now),
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
          eventDate: formatBerlin(event.get('eventDate'), { dateOnlyAtMidnight: true }),
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
