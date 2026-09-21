// registerLog helper — a change record for one request on the Dauernummer register.
//
// Plain module, `require`d from the request hooks in permanent-numbers.pb.js. Never throws: a
// log line that cannot be written must not undo the edit it describes.

// The fields worth a diff; hashes and timestamps are derived, not edited.
const LOGGED_FIELDS = {
  permanentNumbers: ['sellerNumberVariation', 'permanentNumberNumber', 'holder', 'status', 'heldSince', 'releasedAt', 'reviewDecision', 'reviewDecisionMarket', 'reviewNote'],
  permanentNumberHolders: ['holderFirstName', 'holderLastName', 'holderEmail', 'holderPhone', 'holderContactChannel', 'isStaff', 'holderNote', 'holderAliases'],
  // An event's registrations, when the Verwaltung page edits or frees them.
  sellerDetails: ['sellerFirstName', 'sellerLastName', 'sellerEmail', 'sellerPhone', 'isStaff', 'permanentNumberHolder'],
  sellerNumbers: ['sellerNumberNumber', 'sellerNumberPool', 'sellerDetails', 'reservedAt'],
}

const snapshot = (record, collectionName) => {
  const out = {}
  if (!record) return out
  for (const field of LOGGED_FIELDS[collectionName] || []) {
    let value = record.get(field)
    // A json field comes back as a Go value; compare it as text.
    if (field === 'holderAliases') {
      if (value && typeof value === 'object' && typeof value.string === 'function') value = value.string()
      value = value ? String(value) : ''
      if (value === '[]' || value === 'null') value = ''
    }
    out[field] = value === null || value === undefined ? '' : value
  }
  return out
}

const diff = (before, after) => {
  const changes = {}
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const field of fields) {
    const from = before[field] === undefined ? '' : before[field]
    const to = after[field] === undefined ? '' : after[field]
    if (String(from) !== String(to)) changes[field] = { from, to }
  }
  return changes
}

const actorLabel = (e) => {
  const authRecord = e && e.auth
  if (!authRecord) return ''
  const email = String(authRecord.get('email') || '')
  return email || authRecord.collection().name
}

const labelFor = (app, record, collectionName) => {
  try {
    if (collectionName === 'permanentNumberHolders') {
      return `${record.get('holderFirstName')} ${record.get('holderLastName')}`.trim()
    }
    if (collectionName === 'sellerDetails') {
      return `${record.get('sellerFirstName')} ${record.get('sellerLastName')}`.trim()
    }
    if (collectionName === 'sellerNumbers') {
      return `Nr. ${record.get('sellerNumberNumber')} im Event`
    }
    let variationName = ''
    try {
      variationName = app.findRecordById('sellerNumberVariations', record.get('sellerNumberVariation')).get('sellerNumberVariationName')
    } catch (error) {
      variationName = ''
    }
    return `Nr. ${record.get('permanentNumberNumber')}${variationName ? ` (${variationName})` : ''}`
  } catch (error) {
    return ''
  }
}

// writeRegisterLog(app, e, { collectionName, action, before, after }) — before/after are
// snapshots (see `snapshot`); either may be empty for create/delete.
const writeRegisterLog = (app, e, entry) => {
  try {
    const changes = entry.action === 'update' ? diff(entry.before, entry.after) : entry.action === 'create' ? diff({}, entry.after) : diff(entry.before, {})
    if (entry.action === 'update' && Object.keys(changes).length === 0) return null
    const collection = app.findCollectionByNameOrId('registerLog')
    const record = new Record(collection)
    record.set('targetCollection', entry.collectionName)
    record.set('recordId', entry.recordId)
    record.set('recordLabel', entry.recordLabel || '')
    record.set('action', entry.action)
    record.set('changes', changes)
    record.set('actor', actorLabel(e))
    record.set('ipAddress', e && typeof e.realIP === 'function' ? e.realIP() : '')
    app.save(record)
    return record.get('id')
  } catch (error) {
    app.logger().warn('registerLog: could not write entry', 'error', error && error.message)
    return null
  }
}

module.exports = { LOGGED_FIELDS, snapshot, diff, labelFor, writeRegisterLog }
