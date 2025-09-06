routerAdd('POST', '/api/seller-number/reservation', (e) => {
  const data = new DynamicModel({
    sellerNumberVariationId: '',
  })
  e.bindBody(data)
  const sellerNumberVariationId = data.sellerNumberVariationId

  if (!sellerNumberVariationId) {
    return e.json(400, { error: 'sellerNumberVariationId is required' })
  }

  try {
    // Get the seller number variation
    let sellerNumberVariation
    try {
      sellerNumberVariation = $app.findRecordById(
        'sellerNumberVariations',
        sellerNumberVariationId
      )
    } catch (error) {
      return e.json(404, { error: 'Seller number variation not found' })
    }

    // Get the event category from the variation
    let eventCategory
    try {
      eventCategory = $app.findRecordById(
        'eventCategories',
        sellerNumberVariation.get('eventCategory')
      )
    } catch (error) {
      return e.json(404, { error: 'Event category not found' })
    }

    // Find the upcoming event for this category
    let events
    try {
      events = $app.findRecordsByFilter(
        'events',
        'eventCategory = {:eventCategoryId} && eventDate > {:now}',
        '-eventDate',
        1,
        0,
        {
          eventCategoryId: eventCategory.get('id'),
          now: new Date().toISOString(),
        }
      )
    } catch (error) {
      return e.json(404, { error: 'No upcoming event found' })
    }

    const event = events.length > 0 ? events[0] : null
    if (!event) {
      return e.json(404, { error: 'No upcoming event found' })
    }

    // Get all seller number pools for this variation and event
    let sellerNumberPools
    try {
      sellerNumberPools = $app.findRecordsByFilter(
        'sellerNumberPools',
        'sellerNumberVariation = {:sellerNumberVariationId} && event = {:eventId}',
        '',
        0,
        0,
        { sellerNumberVariationId, eventId: event.get('id') }
      )
    } catch (error) {
      return e.json(404, {
        error: 'No seller number pools found for this variation',
      })
    }

    if (!sellerNumberPools || sellerNumberPools.length === 0) {
      return e.json(404, {
        error: 'No seller number pools found for this variation',
      })
    }

    // Function to resolve numbers from pool data
    const resolveNumbers = (numberDatas) => {
      const resolved = []

      // Handle null, undefined, or non-array values
      if (!numberDatas || !Array.isArray(numberDatas)) {
        console.log('Invalid numberDatas:', numberDatas)
        return []
      }

      for (const numberData of numberDatas) {
        if (typeof numberData === 'number') {
          resolved.push(numberData)
        } else if (
          numberData &&
          typeof numberData === 'object' &&
          numberData.from &&
          numberData.to
        ) {
          for (let i = numberData.from; i <= numberData.to; i++) {
            resolved.push(i)
          }
        }
      }
      return [...new Set(resolved)]
    }

    // Get all existing seller numbers for these pools
    const poolIds = sellerNumberPools.map((pool) => pool.get('id'))
    let existingSellerNumbers = []
    if (poolIds.length > 0) {
      try {
        existingSellerNumbers = $app.findRecordsByFilter(
          'sellerNumbers',
          'sellerNumberPool = "' +
            poolIds.join('" || sellerNumberPool = "') +
            '"',
          '',
          0,
          0
        )
      } catch (error) {
        // No existing seller numbers found, continue with empty array
        existingSellerNumbers = []
      }
    }

    // Find all obtainable numbers
    const obtainableNumbers = []

    for (const pool of sellerNumberPools) {
      const resolvedNumbers = resolveNumbers(pool.get('numbers'))

      for (const resolvedNumber of resolvedNumbers) {
        const existingSellerNumber = existingSellerNumbers.find(
          (sn) =>
            sn.get('sellerNumberNumber') === resolvedNumber &&
            sn.get('sellerNumberPool') === pool.get('id')
        )

        if (!existingSellerNumber) {
          // Number doesn't exist, it's obtainable
          obtainableNumbers.push({
            number: resolvedNumber,
            poolId: pool.get('id'),
            sellerNumber: null,
          })
        } else {
          // Check if it's obtainable (not reserved or has seller details)
          const reservedAt = existingSellerNumber.get('reservedAt')
          const sellerDetails = existingSellerNumber.get('sellerDetails')

          let isObtainable = !sellerDetails

          if (reservedAt && eventCategory.get('sessionTimeInSec')) {
            const timeDiff =
              (new Date().getTime() - new Date(reservedAt).getTime()) / 1000
            isObtainable =
              isObtainable && timeDiff > eventCategory.get('sessionTimeInSec')
          }

          if (isObtainable) {
            obtainableNumbers.push({
              number: resolvedNumber,
              poolId: pool.get('id'),
              sellerNumber: existingSellerNumber,
            })
          }
        }
      }
    }

    if (obtainableNumbers.length === 0) {
      return e.json(404, { error: 'No obtainable numbers found' })
    }

    // Select the next obtainable number (first one)
    const selectedNumber = obtainableNumbers[0]

    let sellerNumberRecord

    if (selectedNumber.sellerNumber) {
      // Update existing record
      sellerNumberRecord = selectedNumber.sellerNumber
      sellerNumberRecord.set('reservedAt', new Date().toISOString())
      $app.save(sellerNumberRecord)
    } else {
      // Create new record
      const collection = $app.findCollectionByNameOrId('sellerNumbers')
      sellerNumberRecord = new Record(collection)
      sellerNumberRecord.set('sellerNumberNumber', selectedNumber.number)
      sellerNumberRecord.set('sellerNumberPool', selectedNumber.poolId)
      sellerNumberRecord.set('reservedAt', new Date().toISOString())
      sellerNumberRecord.set('sellerDetails', '')
      $app.save(sellerNumberRecord)
    }

    return e.json(200, { sellerNumberId: sellerNumberRecord.get('id') })
  } catch (error) {
    $app.logger().error('Error in reservation endpoint', 'error', error)
    return e.json(500, {
      error: 'Internal server error',
    })
  }
})
