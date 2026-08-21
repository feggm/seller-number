// Cron jobs for the public status page's connection curve.
//
// Route-free, but the filename must end in `.pb.js` — only those are loaded as hook entry
// points; plain `.js` files are `require`d modules.
//
// NB: hook files are evaluated once per goja VM, so `cronAdd` runs N times. PocketBase
// REPLACES a job that reuses an existing id, so exactly one job survives and fires. This is
// correct as written — do not "fix" it by guarding the registration.
//
// Every helper lives INSIDE the callback: like route handlers, cron callbacks execute in an
// isolated scope and cannot see this file's module scope.

// Heartbeat — the floor under the opportunistic 5s sampling in public-status.pb.js.
//
// Cron cannot do seconds: the expression is the standard 5-field form, so 60s is the finest
// it offers, and the JSVM has no setInterval. That is fine, because this job is not what
// makes the curve dense — the status page's own polling is. This exists so that a gap in the
// curve means "nobody was watching" instead of "we lost data".
//
// Gated to the release window so it writes nothing for most of the year.
cronAdd('statusHeartbeat', '* * * * *', () => {
  const { parseDbDate, findRecords, toDbDate, countCategoryClients } =
    require(`${__hooks}/status-core.js`)
  const { recordSample } = require(`${__hooks}/status-samples.js`)

  const LEAD_MINUTES = 15
  const TRAIL_HOURS = 24

  try {
    const now = new Date()

    const events = findRecords('events', 'eventDate > {:now}', 'eventDate', {
      now: toDbDate(now),
    })
    if (events.length === 0) return

    const eventIds = events.map((event) => event.get('id'))
    const categoryByEventId = {}
    for (const event of events) {
      categoryByEventId[event.get('id')] = event.get('eventCategory')
    }

    const { orFilterForIds } = require(`${__hooks}/status-core.js`)
    const pools = findRecords('sellerNumberPools', orFilterForIds('event', eventIds))
    if (pools.length === 0) return

    // Earliest obtainableFrom per category. A pool without one is open immediately, which
    // counts as "the window is now".
    const earliestByCategory = {}
    for (const pool of pools) {
      const categoryId = categoryByEventId[pool.get('event')]
      if (!categoryId) continue

      const from = pool.get('obtainableFrom')
      const fromDate = from && from !== '' ? parseDbDate(from) : now

      if (!earliestByCategory[categoryId] || fromDate < earliestByCategory[categoryId]) {
        earliestByCategory[categoryId] = fromDate
      }
    }

    for (const categoryId of Object.keys(earliestByCategory)) {
      const releaseAt = earliestByCategory[categoryId]
      const windowStart = new Date(releaseAt.getTime() - LEAD_MINUTES * 60 * 1000)
      const windowEnd = new Date(releaseAt.getTime() + TRAIL_HOURS * 60 * 60 * 1000)

      if (now < windowStart || now > windowEnd) continue

      recordSample({
        eventCategoryId: categoryId,
        connections: countCategoryClients(categoryId),
        source: 'heartbeat',
        now,
      })
    }
  } catch (error) {
    $app.logger().warn('statusHeartbeat: failed', 'error', error.message)
  }
})

// Retention sweep. Volumes are tiny (at most ~1440 heartbeat rows plus the sampled bursts per
// category per event cycle), so a flat cutoff is enough — no downsampling tier needed.
cronAdd('statusSamplesRetention', '17 4 * * *', () => {
  const { pruneSamples } = require(`${__hooks}/status-samples.js`)

  const RETENTION_DAYS = 90

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const removed = pruneSamples(cutoff)
    if (removed > 0) {
      $app.logger().info('statusSamples: retention sweep', 'removed', removed)
    }
  } catch (error) {
    $app.logger().warn('statusSamplesRetention: failed', 'error', error.message)
  }
})
