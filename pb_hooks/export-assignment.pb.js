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
  const syncLog = require(`${__hooks}/sync-log.js`)

  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }
  const startedAt = new Date()

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

  const logEntry = (extra) =>
    syncLog.writeSyncLog(
      $app,
      Object.assign(
        {
          direction: 'out',
          kind: 'export-assignment',
          eventId: /^[a-z0-9]{15}$/.test(eventId) ? eventId : '',
          client: syncLog.clientLabel(e),
          mode,
          ipAddress: e.realIP(),
          startedAt,
        },
        extra
      )
    )

  try {
    const assignment = core.buildAssignment({
      eventId,
      mode,
      now: startedAt,
      limit,
      offset,
    })
    const envelope = core.toEnvelope(assignment)
    logEntry({
      status: 'ok',
      checksum: envelope.checksum,
      rowCount: envelope.rowCount,
      summary: { truncated: envelope.truncated, warnings: envelope.warnings.length },
    })
    return e.json(200, envelope)
  } catch (error) {
    if (error && error.status) {
      logEntry({ status: 'error', summary: { httpStatus: error.status, error: error.message } })
      return e.json(error.status, { error: error.message })
    }
    // Message only — never the row data.
    $app.logger().error('Error in export-assignment endpoint', 'error', error && error.message)
    logEntry({ status: 'error', summary: { httpStatus: 500, error: 'internal error' } })
    return e.json(500, { error: 'Internal server error' })
  }
})

// GET /api/seller-number/export-events
//
// The picker behind the envelope: every event, newest first, with category, derived yearMonth
// and the number of completed registrations. Same gate as the envelope; counts only.
routerAdd('GET', '/api/seller-number/export-events', (e) => {
  const core = require(`${__hooks}/export-core.js`)
  const syncLog = require(`${__hooks}/sync-log.js`)

  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }
  const startedAt = new Date()

  try {
    const events = core.listExportEvents({ now: startedAt })
    syncLog.writeSyncLog($app, {
      direction: 'out',
      kind: 'export-events',
      client: syncLog.clientLabel(e),
      rowCount: events.length,
      status: 'ok',
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(200, {
      generatedAt: startedAt.toISOString(),
      events,
    })
  } catch (error) {
    $app.logger().error('Error in export-events endpoint', 'error', error && error.message)
    syncLog.writeSyncLog($app, {
      direction: 'out',
      kind: 'export-events',
      client: syncLog.clientLabel(e),
      status: 'error',
      summary: { error: 'internal error' },
      ipAddress: e.realIP(),
      startedAt,
    })
    return e.json(500, { error: 'Internal server error' })
  }
})

// POST /api/seller-number/export-ack
//
// The consumer saying "this checksum is now the market's file". A pull is not a sync; the
// cash-desk side's commit is, and this is how PocketBase learns about it. Same gate as the
// export. The only route on which the apiClients account writes anything — and all it can
// write is one syncLog row with validated fields.
routerAdd('POST', '/api/seller-number/export-ack', (e) => {
  const core = require(`${__hooks}/export-core.js`)
  const syncLog = require(`${__hooks}/sync-log.js`)

  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const body = new DynamicModel({ eventId: '', mode: '', checksum: '', rowCount: 0, yearMonth: '', committedAt: '' })
  try {
    e.bindBody(body)
  } catch (error) {
    return e.json(400, { error: 'Body must be JSON: { eventId, mode, checksum, rowCount, yearMonth, committedAt }' })
  }

  const eventId = String(body.eventId || '')
  const mode = String(body.mode || '')
  const checksum = String(body.checksum || '').toLowerCase()
  const rowCount = Number(body.rowCount)
  const yearMonth = String(body.yearMonth || '')
  const committedAt = String(body.committedAt || '')

  if (!/^[a-z0-9]{15}$/.test(eventId)) return e.json(400, { error: 'eventId is required' })
  if (mode !== 'kkm' && mode !== 'azb') return e.json(400, { error: 'mode must be either "kkm" or "azb"' })
  if (!/^[a-f0-9]{64}$/.test(checksum)) return e.json(400, { error: 'checksum must be 64 hex characters' })
  if (!Number.isInteger(rowCount) || rowCount < 0 || rowCount > 1000000) return e.json(400, { error: 'rowCount must be a non-negative integer' })
  if (!/^[0-9]{4}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(yearMonth)) return e.json(400, { error: 'yearMonth must be YYYY-Mon' })
  const committed = new Date(committedAt)
  if (!committedAt || isNaN(committed.getTime())) return e.json(400, { error: 'committedAt must be an ISO timestamp' })
  try {
    $app.findRecordById('events', eventId)
  } catch (error) {
    return e.json(404, { error: 'Event not found' })
  }

  const id = syncLog.writeSyncLog($app, {
    direction: 'in',
    kind: 'export-ack',
    eventId,
    client: syncLog.clientLabel(e),
    mode,
    checksum,
    rowCount,
    status: 'ok',
    summary: { yearMonth },
    ipAddress: e.realIP(),
    startedAt: committed,
    finishedAt: new Date(),
  })
  if (!id) return e.json(500, { error: 'ack could not be recorded' })
  return e.json(200, { acknowledged: true, id })
})

// GET /api/seller-number/sync-status[?eventId=]
//
// The newest syncLog entry per kind — what a status widget shows as "last export / last
// commit / last import". Same gate as the export; the full history stays in the admin UI.
routerAdd('GET', '/api/seller-number/sync-status', (e) => {
  const core = require(`${__hooks}/export-core.js`)
  const syncLog = require(`${__hooks}/sync-log.js`)

  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }
  const eventId = e.request.url.query().get('eventId') || ''
  if (eventId && !/^[a-z0-9]{15}$/.test(eventId)) {
    return e.json(400, { error: 'eventId must be a record id' })
  }
  return e.json(200, {
    generatedAt: new Date().toISOString(),
    eventId: eventId || null,
    latest: syncLog.latestPerKind($app, eventId),
  })
})
