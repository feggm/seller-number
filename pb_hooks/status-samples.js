// Append-only sampling for the public status page's connection curve.
//
// Why this exists: the realtime connection count lives only in Go process memory
// (`$app.subscriptionsBroker()`), so it cannot be reconstructed after the fact the way the
// registration curve can be (that one is derived from sellerDetails.created and needs no
// sampling at all). If it is not written down as it happens, it is gone.
//
// Resolution strategy — cron alone cannot do this. `cronAdd` takes a standard cron
// expression, so its floor is 60s, and the JSVM has no setInterval. Instead:
//
//   1. Opportunistic sampling (this module, called from public-status.pb.js): every snapshot
//      response floors `now` into a BUCKET_SECONDS bucket and tries one insert. The unique
//      index on (eventCategory, bucketAt) makes dedupe atomic, so write load is capped at one
//      row per bucket *regardless of how many people are watching* — 5 viewers or 500 cost
//      the same. During a rush someone is always watching, which is exactly when the curve
//      needs to be dense.
//   2. A 60s cron heartbeat (status-sampler.pb.js) as the floor, so a gap in the curve means
//      "nobody was watching" rather than "we lost data".
//
// Plain `.js` module — registers no routes, pulled in via require(`${__hooks}/status-samples.js`).

const { toDbDate } = require(`${__hooks}/status-core.js`)

const BUCKET_SECONDS = 5

// Per-VM memo of the last bucket we already tried to write, keyed by category id. PocketBase
// runs a POOL of goja VMs, so this is not shared across them — that is fine here. It is a
// cache, not a counter: a miss costs at most one redundant INSERT that the unique index
// rejects. Correctness lives in the index, never in this map.
const lastBucketByCategory = new Map()

// Floors a date into a bucket of `seconds` width. Returns a Date at the bucket start, UTC.
const bucketStart = (date, seconds) => {
  const ms = (seconds || BUCKET_SECONDS) * 1000
  return new Date(Math.floor(date.getTime() / ms) * ms)
}

// Writes one sample, deduped by bucket. Never throws — a failed sample must not take the
// response down with it.
//
// Returns true when a row was actually written, false when it was skipped or lost the race.
const recordSample = ({ eventCategoryId, connections, source, now }) => {
  if (!eventCategoryId) return false

  try {
    const bucketAt = bucketStart(now || new Date(), BUCKET_SECONDS)
    const bucketIso = bucketAt.toISOString()

    // Cheap path: this VM already handled this bucket.
    if (lastBucketByCategory.get(eventCategoryId) === bucketIso) return false
    lastBucketByCategory.set(eventCategoryId, bucketIso)

    const collection = $app.findCollectionByNameOrId('statusSamples')
    const record = new Record(collection)
    record.set('eventCategory', eventCategoryId)
    record.set('bucketAt', bucketIso)
    record.set('connections', connections)
    record.set('source', source || 'live')
    $app.save(record)

    return true
  } catch (error) {
    // Expected and harmless: a unique-index violation means another VM (or the heartbeat)
    // already claimed this bucket. Anything else is logged but still swallowed.
    const message = error && error.message ? String(error.message) : ''
    if (!/unique|UNIQUE|constraint/i.test(message)) {
      $app
        .logger()
        .warn('statusSamples: could not record sample', 'error', message)
    }
    return false
  }
}

// Reads samples for one category from `from` onwards, oldest first.
const readSamples = ({ eventCategoryId, from, limit }) => {
  try {
    return (
      $app.findRecordsByFilter(
        'statusSamples',
        'eventCategory = {:eventCategoryId} && bucketAt >= {:from}',
        'bucketAt',
        limit || 0,
        0,
        { eventCategoryId, from: toDbDate(from) }
      ) || []
    )
  } catch (error) {
    $app.logger().warn('statusSamples: read failed', 'error', error.message)
    return []
  }
}

// Deletes everything older than `cutoff`, in batches. Returns the number of rows removed.
const pruneSamples = (cutoff, batchSize) => {
  const size = batchSize || 2000
  let removed = 0

  for (;;) {
    let batch = []
    try {
      batch =
        $app.findRecordsByFilter(
          'statusSamples',
          'bucketAt < {:cutoff}',
          'bucketAt',
          size,
          0,
          { cutoff: toDbDate(cutoff) }
        ) || []
    } catch (error) {
      $app.logger().warn('statusSamples: prune query failed', 'error', error.message)
      break
    }

    if (batch.length === 0) break

    try {
      $app.runInTransaction((txApp) => {
        for (const record of batch) {
          txApp.delete(record)
        }
      })
      removed += batch.length
    } catch (error) {
      $app.logger().warn('statusSamples: prune delete failed', 'error', error.message)
      break
    }

    if (batch.length < size) break
  }

  return removed
}

module.exports = {
  BUCKET_SECONDS,
  bucketStart,
  recordSample,
  readSamples,
  pruneSamples,
}
