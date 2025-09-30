const cache = require(`${__hooks}/cache.js`)

/**
 * Stringify a value properly
 * @param {any} value - The value to stringify
 * @returns {string} - The stringified value
 */
const stringify = (value) => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Get nested object property using dot notation
 * @param {object} obj - The object to get property from
 * @param {string} path - The dot notation path (e.g., 'content.rendered')
 * @returns {any} - The property value
 */
const get = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Resolves URL fields by fetching their content with caching
 * @param {string} url - The URL to resolve
 * @returns {string} - The resolved content or empty string if failed
 */
const resolveUrl = (url) => {
  if (!url) return ''

  // Check cache first
  const cached = cache.get(`resolveUrl:${url}`)
  if (cached !== null) {
    return cached
  }

  try {
    // Parse URL to extract hash fragment
    let hash = ''
    let cleanUrl = url
    if (url.includes('#')) {
      const parts = url.split('#')
      cleanUrl = parts[0]
      hash = parts[1]
    }

    const response = $http.send({
      url: url,
      method: 'GET',
      timeout: 10, // 10 seconds timeout
    })

    if (response.statusCode === 200) {
      let content = response.json || response.raw

      // If there's a hash fragment, extract the specific property
      if (hash && typeof content === 'object') {
        content = get(content, hash)
      }

      // Stringify the final content
      const stringifiedContent = content ? stringify(content) : ''
      cache.set(`resolveUrl:${url}`, stringifiedContent)
      return stringifiedContent
    }
  } catch (error) {
    $app.logger().error('Failed to resolve URL', 'url', url, 'error', error)
  }

  // Cache empty result to avoid repeated failed requests
  cache.set(`resolveUrl:${url}`, '')
  return ''
}

/**
 * Sends email notification to support team
 * @param {Object} params - Email parameters
 * @param {string} params.supportEmail - Support team email address
 * @param {string} params.eventCategoryName - Event category name
 * @param {string} params.sellerFirstName - Seller's first name
 * @param {string} params.sellerLastName - Seller's last name
 * @param {string} params.sellerPhone - Seller's phone number
 * @param {string} params.sellerEmail - Seller's email address
 * @param {string} params.sellerNumberNumber - Seller number
 */
const sendSupportNotification = (params) => {
  const {
    supportEmail,
    eventCategoryName,
    sellerFirstName,
    sellerLastName,
    sellerPhone,
    sellerEmail,
    sellerNumberNumber,
  } = params

  if (!supportEmail) {
    $app
      .logger()
      .warn(
        'No support email configured for event category',
        'eventCategoryName',
        eventCategoryName
      )
    return
  }

  const subject = `[${eventCategoryName}] Registrierung: ${sellerFirstName} ${sellerLastName}`

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            Neue Verkaufsnummer vergeben
          </h2>

          <p>Hallo,</p>
          <p>soeben wurde folgende Verkaufsnummer vergeben:</p>

          <table style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 150px;">Name:</td>
              <td style="padding: 8px 0;">${sellerFirstName} ${sellerLastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Telefonnummer:</td>
              <td style="padding: 8px 0;">${sellerPhone || 'Nicht angegeben'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${sellerEmail}" style="color: #3498db;">${sellerEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Verkäufernummer:</td>
              <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #e74c3c;">${sellerNumberNumber}</td>
            </tr>
          </table>

          <p style="margin-top: 20px; color: #7f8c8d; font-size: 14px;">
            Diese E-Mail wurde automatisch vom Verkaufsnummer-System generiert.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `Hallo,
Soeben wurde folgende Verkaufsnummer vergeben:

Name: ${sellerFirstName} ${sellerLastName}
Telefonnumer: ${sellerPhone || 'Nicht angegeben'}
Email: ${sellerEmail}
Verkäufernummer: ${sellerNumberNumber}`

  try {
    const message = $app.newMailClient().send({
      from: {
        address: $app.settings().meta.senderAddress || 'noreply@localhost',
        name: $app.settings().meta.senderName || 'Seller Number System',
      },
      to: [{ address: supportEmail }],
      subject: subject,
      html: htmlBody,
      text: textBody,
    })
    $app
      .logger()
      .info(
        'Support notification sent successfully',
        'supportEmail',
        supportEmail
      )
  } catch (error) {
    $app.logger().error('Failed to send support notification', 'error', error)
    // Log more details about the error
    if (error.message) {
      $app.logger().error('Error details', 'message', error.message)
    }
  }
}

/**
 * Sends confirmation email to seller
 * @param {Object} params - Email parameters
 * @param {string} params.sellerEmail - Seller's email address
 * @param {string} params.eventCategoryName - Event category name
 * @param {string} params.sellerFirstName - Seller's first name
 * @param {string} params.sellerLastName - Seller's last name
 * @param {string} params.sellerPhone - Seller's phone number
 * @param {string} params.sellerNumberNumber - Seller number
 * @param {string} params.conditionsTextUrl - URL to conditions text (optional)
 * @param {string} params.conditionsText - conditions text (optional)
 * @param {string} params.additionalEmailTextUrl - URL to additional email text (optional)
 * @param {string} params.additionalEmailText - Additional email text (optional)
 */
const sendSellerConfirmation = (params) => {
  const {
    sellerEmail,
    eventCategoryName,
    sellerFirstName,
    sellerLastName,
    sellerPhone,
    sellerNumberNumber,
    conditionsTextUrl,
    conditionsText,
    additionalEmailTextUrl,
    additionalEmailText,
  } = params

  const subject = `Deine Verkaufsnummer für ${eventCategoryName}`

  // Resolve URL content for HTML formatting
  let conditionsHtml = ''
  let additionalEmailHtml = ''

  const finalConditionsText = resolveUrl(conditionsTextUrl) || conditionsText
  if (finalConditionsText) {
    conditionsHtml = `
      <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #3498db; border-radius: 0 5px 5px 0;">
        <h3 style="color: #2c3e50; margin-top: 0;">Richtlinien</h3>
        <div>${finalConditionsText}</div>
      </div>
    `
  }

  const finalAdditionalEmailText =
    resolveUrl(additionalEmailTextUrl) || additionalEmailText
  if (finalAdditionalEmailText) {
    additionalEmailHtml = `
      <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 0 5px 5px 0;">
        <h3 style="color: #856404; margin-top: 0;">Weitere Informationen</h3>
        <div>${finalAdditionalEmailText}</div>
      </div>
    `
  }

  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
            Deine Verkaufsnummer für ${eventCategoryName}
          </h2>

          <p>Hallo ${sellerFirstName} ${sellerLastName},</p>
          <p>vielen Dank für deine Registrierung als Verkäufer für <strong>${eventCategoryName}</strong>.</p>
          <p>Hier noch einmal die Daten, mit denen du dich registriert hast:</p>

          <table style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 150px;">Name:</td>
              <td style="padding: 8px 0;">${sellerFirstName} ${sellerLastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;">${sellerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Telefonnummer:</td>
              <td style="padding: 8px 0;">${sellerPhone || 'Nicht angegeben'}</td>
            </tr>
            <tr style="background-color: #d4edda;">
              <td style="padding: 12px 0; font-weight: bold;">Deine Verkäufernummer:</td>
              <td style="padding: 12px 0; font-size: 24px; font-weight: bold; color: #27ae60;">${sellerNumberNumber}</td>
            </tr>
          </table>

          <p><strong>Hier noch mal alle Daten, die du für den weiteren Verlauf brauchst:</strong></p>

          ${conditionsHtml}
          ${additionalEmailHtml}

          <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px;">
            Diese E-Mail wurde automatisch vom Verkaufsnummer-System generiert.<br>
            Bei Fragen wende dich bitte an das Support-Team.
          </p>
        </div>
      </body>
    </html>
  `

  let textBody = `Hallo ${sellerFirstName} ${sellerLastName},
vielen Dank für deine Registrierung als Verkäufer für ${eventCategoryName}. Hier noch einmal die Daten, mit denen du dich registriert hast:

Name: ${sellerFirstName} ${sellerLastName}
Email: ${sellerEmail}
Telefonnumer: ${sellerPhone || 'Nicht angegeben'}
Deine Verkäufernummer: ${sellerNumberNumber}

Hier noch mal alle Daten, die du für den weiteren Verlauf brauchst.`

  // Add resolved text content for plain text version
  if (conditionsTextUrl) {
    const conditionsText = resolveUrl(conditionsTextUrl)
    if (conditionsText) {
      textBody += `\n\n--- Richtlinien ---\n${conditionsText}`
    }
  }

  if (additionalEmailTextUrl) {
    const additionalEmailText = resolveUrl(additionalEmailTextUrl)
    if (additionalEmailText) {
      textBody += `\n\n--- Weitere Informationen ---\n${additionalEmailText}`
    }
  }

  try {
    const message = $app.newMailClient().send({
      from: {
        address: $app.settings().meta.senderAddress || 'noreply@localhost',
        name: $app.settings().meta.senderName || 'Seller Number System',
      },
      to: [{ address: sellerEmail }],
      subject: subject,
      html: htmlBody,
      text: textBody,
    })
    $app
      .logger()
      .info('Seller confirmation sent successfully', 'sellerEmail', sellerEmail)
  } catch (error) {
    $app.logger().error('Failed to send seller confirmation', 'error', error)
    // Log more details about the error
    if (error.message) {
      $app.logger().error('Error details', 'message', error.message)
    }
  }
}

/**
 * Main function to send registration emails
 * @param {Object} registrationData - Registration data containing all necessary information
 * @param {string} registrationData.sellerNumberId - ID of the seller number
 * @param {string} registrationData.sellerFirstName - Seller's first name
 * @param {string} registrationData.sellerLastName - Seller's last name
 * @param {string} registrationData.sellerEmail - Seller's email address
 * @param {string} registrationData.sellerPhone - Seller's phone number
 */
const sendRegistrationEmails = (registrationData) => {
  const {
    sellerNumberId,
    sellerFirstName,
    sellerLastName,
    sellerEmail,
    sellerPhone,
  } = registrationData

  try {
    // Get the seller number record
    const sellerNumber = $app.findRecordById('sellerNumbers', sellerNumberId)
    const sellerNumberNumber = sellerNumber.get('sellerNumberNumber')

    // Get the seller number pool
    const sellerNumberPool = $app.findRecordById(
      'sellerNumberPools',
      sellerNumber.get('sellerNumberPool')
    )

    // Get the seller number variation
    const sellerNumberVariation = $app.findRecordById(
      'sellerNumberVariations',
      sellerNumberPool.get('sellerNumberVariation')
    )

    // Get the event category
    const eventCategoryId = sellerNumberVariation.get('eventCategory')
    const eventCategory = $app.findRecordById(
      'eventCategories',
      eventCategoryId
    )

    // Debug the eventCategory record
    $app
      .logger()
      .debug(
        'EventCategory debug',
        'eventCategoryId',
        eventCategoryId,
        'eventCategory.id',
        eventCategory.get('id'),
        'eventCategory.eventCategoryName',
        eventCategory.get('eventCategoryName'),
        'eventCategory.supportEmail',
        eventCategory.get('supportEmail')
      )

    const eventCategoryName = eventCategory.get('eventCategoryName')
    const supportEmail = eventCategory.get('supportEmail')
    const conditionsTextUrl = sellerNumberVariation.get('conditionsTextUrl')
    const conditionsText = sellerNumberVariation.get('conditionsText')
    const additionalEmailTextUrl = sellerNumberVariation.get(
      'additionalEmailTextUrl'
    )
    const additionalEmailText = sellerNumberVariation.get('additionalEmailText')

    // Debug logging
    $app
      .logger()
      .debug(
        'Email debug info',
        'eventCategoryName',
        eventCategoryName,
        'supportEmail',
        supportEmail,
        'conditionsTextUrl',
        conditionsTextUrl,
        'conditionsText',
        conditionsText,
        'additionalEmailTextUrl',
        additionalEmailTextUrl,
        'additionalEmailText',
        additionalEmailText
      )

    // Send support notification
    sendSupportNotification({
      supportEmail,
      eventCategoryName,
      sellerFirstName,
      sellerLastName,
      sellerPhone,
      sellerEmail,
      sellerNumberNumber,
    })

    // Send seller confirmation
    sendSellerConfirmation({
      sellerEmail,
      eventCategoryName,
      sellerFirstName,
      sellerLastName,
      sellerPhone,
      sellerNumberNumber,
      conditionsTextUrl,
      conditionsText,
      additionalEmailTextUrl,
      additionalEmailText,
    })
  } catch (error) {
    $app.logger().error('Error sending registration emails', 'error', error)
  }
}

module.exports = {
  sendRegistrationEmails,
}
