// GET /api/seller-number/export-assignment?eventId=…&mode=kkm|azb[&limit=N&offset=N]
//
// The machine-readable export the KKM cash-desk admin pulls: the assignment rows of one event
// (for a diff on the consumer side), the exact CSV its importer will read, and a sha256 over
// that CSV that ties the two together. One request, one artefact, one checksum — there is
// deliberately no separate CSV fetch, because two fetches would be two points in time.
//
// Auth: superuser or an `apiClients` record (see export-core.js `isExportClient`). Contains
// seller names, phones and emails — never widen the gate.
//
// `limit`/`offset` are accepted so paging can be added without a schema bump; the current
// consumer refuses a truncated envelope, so the default (everything) is the only mode in use.
routerAdd('GET', '/api/seller-number/export-assignment', (e) => {
  const core = require(`${__hooks}/export-core.js`)

  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const query = e.request.url.query()
  const eventId = query.get('eventId') || ''
  const mode = query.get('mode') || 'kkm'

  // Bounded integers or nothing — the values reach Array.slice, nothing else.
  const parseBounded = (raw, max) => {
    if (raw === '' || raw === null || raw === undefined) return 0
    if (!/^[0-9]{1,6}$/.test(raw)) return null
    const value = parseInt(raw, 10)
    return value > max ? null : value
  }
  const limit = parseBounded(query.get('limit'), core.MAX_LIMIT)
  const offset = parseBounded(query.get('offset'), 1000000)
  if (limit === null || offset === null) {
    return e.json(400, {
      error: 'limit must be an integer between 0 and ' + core.MAX_LIMIT + ', offset a non-negative integer',
    })
  }

  try {
    const assignment = core.buildAssignment({
      eventId,
      mode,
      now: new Date(),
      limit,
      offset,
    })
    return e.json(200, core.toEnvelope(assignment))
  } catch (error) {
    if (error && error.status) {
      return e.json(error.status, { error: error.message })
    }
    // Message only — never the row data.
    $app.logger().error('Error in export-assignment endpoint', 'error', error && error.message)
    return e.json(500, { error: 'Internal server error' })
  }
})
