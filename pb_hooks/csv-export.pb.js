routerAdd('GET', '/api/seller-number/export-csv', (e) => {
  // Require superuser authentication (PocketBase 0.30.0+)
  const authRecord = e.auth
  const collectionName = authRecord ? authRecord.collection().name : null
  if (!authRecord || collectionName !== '_superusers') {
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
    // Get the event
    let event
    try {
      event = $app.findRecordById('events', eventId)
    } catch (error) {
      return e.json(404, { error: 'Event not found' })
    }

    // Get all seller number pools for this event
    let sellerNumberPools
    try {
      sellerNumberPools = $app.findRecordsByFilter(
        'sellerNumberPools',
        'event = {:eventId}',
        '',
        0,
        0,
        { eventId }
      )
    } catch (error) {
      return e.json(404, {
        error: 'No seller number pools found for this event',
      })
    }

    if (!sellerNumberPools || sellerNumberPools.length === 0) {
      return e.json(404, {
        error: 'No seller number pools found for this event',
      })
    }

    // Get all seller numbers for these pools
    const poolIds = sellerNumberPools.map((pool) => pool.get('id'))
    let sellerNumbers = []
    if (poolIds.length > 0) {
      try {
        sellerNumbers = $app.findRecordsByFilter(
          'sellerNumbers',
          'sellerNumberPool = "' +
            poolIds.join('" || sellerNumberPool = "') +
            '"',
          'sellerNumberNumber',
          0,
          0
        )
      } catch (error) {
        // No seller numbers found, return empty CSV
        sellerNumbers = []
      }
    }

    // Filter only seller numbers with associated seller details
    const completedSellerNumbers = sellerNumbers.filter((sn) =>
      sn.get('sellerDetails')
    )

    // Build CSV content
    let csvContent = ''
    let headers = []

    if (mode === 'kkm') {
      headers = [
        'nr',
        'dnr',
        'babynr',
        'name',
        'vorname',
        'Strasse',
        'plz',
        'ort',
        'tel',
        'email',
        'interesse_dnr',
        'neu',
        'ma',
      ]
    } else if (mode === 'azb') {
      headers = ['nr', 'name', 'vorname', 'ab-status', 'tel', 'ma']
    }

    // Add CSV header row
    csvContent += headers.join(',') + '\n'

    // Add data rows
    for (const sellerNumber of completedSellerNumbers) {
      const sellerDetailsId = sellerNumber.get('sellerDetails')
      if (!sellerDetailsId) continue

      let sellerDetails
      try {
        sellerDetails = $app.findRecordById('sellerDetails', sellerDetailsId)
      } catch (error) {
        continue
      }

      const row = []
      const nr = sellerNumber.get('sellerNumberNumber') || ''
      const lastName = sellerDetails.get('sellerLastName') || ''
      const firstName = sellerDetails.get('sellerFirstName') || ''
      const phone = sellerDetails.get('sellerPhone') || ''
      const email = sellerDetails.get('sellerEmail') || ''

      // Escape CSV values (handle commas, quotes, and newlines)
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return ''
        const stringValue = String(value)
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return '"' + stringValue.replace(/"/g, '""') + '"'
        }
        return stringValue
      }

      if (mode === 'kkm') {
        row.push(escapeCSV(nr)) // nr
        row.push('') // dnr (not available)
        row.push('') // babynr (not available)
        row.push(escapeCSV(lastName)) // name
        row.push(escapeCSV(firstName)) // vorname
        row.push('') // Strasse (not available)
        row.push('') // plz (not available)
        row.push('') // ort (not available)
        row.push(escapeCSV(phone)) // tel
        row.push(escapeCSV(email)) // email
        row.push('') // interesse_dnr (not available)
        row.push('') // neu (not available)
        row.push('') // ma (not available)
      } else if (mode === 'azb') {
        row.push(escapeCSV(nr)) // nr
        row.push(escapeCSV(lastName)) // name
        row.push(escapeCSV(firstName)) // vorname
        row.push('') // ab-status (not available)
        row.push(escapeCSV(phone)) // tel
        row.push('') // ma (not available)
      }

      csvContent += row.join(',') + '\n'
    }

    // Set response headers for CSV download
    e.response.header().set('Content-Type', 'text/csv; charset=utf-8')
    e.response
      .header()
      .set(
        'Content-Disposition',
        'attachment; filename="seller-numbers-' +
          event.get('eventName').replace(/[^a-zA-Z0-9]/g, '-') +
          '-' +
          mode +
          '.csv"'
      )

    // Return CSV content
    return e.string(200, csvContent)
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in CSV export endpoint', 'error', error)
    return e.json(500, {
      error: 'Internal server error',
    })
  }
})
