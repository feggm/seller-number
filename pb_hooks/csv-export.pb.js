// GET /api/seller-number/export-csv?eventId=…&mode=kkm|azb
//
// Human download of the same assignment that `/api/seller-number/export-assignment` embeds:
// both render through export-core.js, so the file a person downloads is byte-identical to the
// `csv` the KKM admin pulls. Column layout and error payloads: CSV_EXPORT.md.
routerAdd('GET', '/api/seller-number/export-csv', (e) => {
  const core = require(`${__hooks}/export-core.js`)

  // Superuser or an apiClients record — the file contains names, phones and emails.
  if (!core.isExportClient(e)) {
    return e.json(401, { error: 'Unauthorized: Admin access required' })
  }

  const data = new DynamicModel({
    eventId: '',
    mode: 'kkm', // 'kkm' or 'azb'
  })
  e.bindBody(data)

  const eventId = e.request.url.query().get('eventId') || data.eventId
  const mode = e.request.url.query().get('mode') || data.mode || 'kkm'

  if (!eventId) {
    return e.json(400, { error: 'eventId is required' })
  }

  if (mode !== 'kkm' && mode !== 'azb') {
    return e.json(400, { error: 'mode must be either "kkm" or "azb"' })
  }

  try {
    const assignment = core.buildAssignment({ eventId, mode, now: new Date() })
    const csvContent = core.toCsv(assignment)

    // Set response headers for CSV download
    e.response.header().set('Content-Type', 'text/csv; charset=utf-8')
    e.response
      .header()
      .set(
        'Content-Disposition',
        'attachment; filename="seller-numbers-' +
          String(assignment.event.eventName || '').replace(/[^a-zA-Z0-9]/g, '-') +
          '-' +
          mode +
          '.csv"'
      )

    return e.string(200, csvContent)
  } catch (error) {
    if (error && error.status) {
      return e.json(error.status, { error: error.message })
    }
    $app.logger().error('Error in CSV export endpoint', 'error', error && error.message)
    return e.json(500, {
      error: 'Internal server error',
    })
  }
})
