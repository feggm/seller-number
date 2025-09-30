routerAdd('POST', '/api/seller-number/registration', (e) => {
  const data = new DynamicModel({
    sellerNumberId: '',
    sellerFirstName: '',
    sellerLastName: '',
    sellerEmail: '',
    sellerPhone: '',
    deviceUuid: '',
  })
  e.bindBody(data)

  const sellerNumberId = data.sellerNumberId
  const sellerFirstName = data.sellerFirstName
  const sellerLastName = data.sellerLastName
  const sellerEmail = data.sellerEmail
  const sellerPhone = data.sellerPhone
  const deviceUuid = data.deviceUuid

  // Get IP address from request
  const ipAddress = e.realIP() || ''

  if (!sellerNumberId) {
    return e.json(400, { error: 'sellerNumberId is required' })
  }

  if (!sellerFirstName || !sellerLastName || !sellerEmail) {
    return e.json(400, {
      error: 'sellerFirstName, sellerLastName, and sellerEmail are required',
    })
  }

  try {
    // Get the seller number record
    let sellerNumber
    try {
      sellerNumber = $app.findRecordById('sellerNumbers', sellerNumberId)
    } catch (error) {
      return e.json(404, { error: 'Seller number not found' })
    }

    // Check if seller number already has seller details
    if (sellerNumber.get('sellerDetails')) {
      return e.json(409, {
        error: 'Seller number already has associated seller details',
      })
    }

    // Get the seller number pool to access the event category
    let sellerNumberPool
    try {
      sellerNumberPool = $app.findRecordById(
        'sellerNumberPools',
        sellerNumber.get('sellerNumberPool')
      )
    } catch (error) {
      return e.json(404, { error: 'Seller number pool not found' })
    }

    // Get the seller number variation to access the event category
    let sellerNumberVariation
    try {
      sellerNumberVariation = $app.findRecordById(
        'sellerNumberVariations',
        sellerNumberPool.get('sellerNumberVariation')
      )
    } catch (error) {
      return e.json(404, { error: 'Seller number variation not found' })
    }

    // Get the event category to check session timeout
    let eventCategory
    try {
      eventCategory = $app.findRecordById(
        'eventCategories',
        sellerNumberVariation.get('eventCategory')
      )
    } catch (error) {
      return e.json(404, { error: 'Event category not found' })
    }

    // Check if reservation is still valid
    const reservedAt = sellerNumber.get('reservedAt')
    if (!reservedAt) {
      return e.json(400, { error: 'Seller number is not reserved' })
    }

    const sessionTimeInSec = eventCategory.get('sessionTimeInSec')
    if (sessionTimeInSec) {
      const timeDiff =
        (new Date().getTime() - new Date(reservedAt).getTime()) / 1000
      if (timeDiff > sessionTimeInSec) {
        return e.json(410, { error: 'Reservation has expired' })
      }
    }

    // Create seller details record
    const sellerDetailsCollection =
      $app.findCollectionByNameOrId('sellerDetails')
    const sellerDetailsRecord = new Record(sellerDetailsCollection)
    sellerDetailsRecord.set('sellerFirstName', sellerFirstName)
    sellerDetailsRecord.set('sellerLastName', sellerLastName)
    sellerDetailsRecord.set('sellerEmail', sellerEmail)
    sellerDetailsRecord.set('sellerPhone', sellerPhone || '')
    sellerDetailsRecord.set('deviceUuid', deviceUuid || '')
    sellerDetailsRecord.set('ipAddress', ipAddress)
    $app.save(sellerDetailsRecord)

    const { sendRegistrationEmails } = require(`${__hooks}/email.js`)
    // Send registration emails
    sendRegistrationEmails({
      sellerNumberId: sellerNumber.get('id'),
      sellerFirstName,
      sellerLastName,
      sellerEmail,
      sellerPhone,
    })

    // Associate seller details with seller number
    sellerNumber.set('sellerDetails', sellerDetailsRecord.get('id'))
    $app.save(sellerNumber)

    return e.json(200, {
      sellerDetailsId: sellerDetailsRecord.get('id'),
      sellerNumberId: sellerNumber.get('id'),
    })
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in registration endpoint', 'error', error)
    return e.json(500, {
      error: 'Internal server error',
    })
  }
})
